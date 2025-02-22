/* eslint-disable no-inner-declarations */
/* eslint-disable react/jsx-props-no-spreading */
import type { FormEvent } from 'react';
import type { RefObject } from '../../../lib/teact/teact';
import {
  memo,
  useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import React from '../../../lib/teact/teactn';

import type { TelegramObjectModel, TelegramObjectModelNode } from '../../../lib/MarkdownParser';
import { ApiMessageEntityTypes } from '../../../api/types';

import { MarkdownParser } from '../../../lib/MarkdownParser';

import useForceUpdate from '../../../hooks/useForceUpdate';

import Blockquote from '../../common/Blockquote';
import CodeBlock from '../../common/code/CodeBlock';

function getNextNode(node) {
  if (node.firstChild) return node.firstChild;
  while (node) {
    if (node.nextSibling) return node.nextSibling;
    node = node.parentNode;
  }
}

function getNodesInRange(range: Range) {
  const start = range.startContainer;
  const end = range.endContainer;
  const commonAncestor = range.commonAncestorContainer;
  const nodes = new Set<Node>();
  let node;

  // walk parent nodes from start to common ancestor
  for (node = start.parentNode; node; node = node.parentNode) {
    nodes.add(node);
    if (node === commonAncestor) break;
  }

  // walk children and siblings from start until end is found
  for (node = start; node; node = getNextNode(node)) {
    nodes.add(node);
    if (node === end) break;
  }
  if (range.endOffset === range.endContainer.textContent?.length) {
    if (range.endContainer.nextSibling) {
      nodes.add(range.endContainer.nextSibling);
    } else if (range.endContainer.parentNode?.nextSibling) {
      nodes.add(range.endContainer.parentNode.nextSibling);
    }
  }

  if (range.startOffset === 0) {
    if (range.startContainer.previousSibling) {
      nodes.add(range.startContainer.previousSibling);
    } else if (range.startContainer.parentNode?.previousSibling) {
      nodes.add(range.startContainer.parentNode.previousSibling);
    }
  }

  if (range.startContainer.nodeType === 1) {
    const prevSibling = range.startContainer.childNodes[range.startOffset]?.previousSibling;
    if (prevSibling) {
      nodes.add(prevSibling);
    }
  }

  if (range.endContainer.nodeType === 1) {
    const nextSibling = range.endContainer.childNodes[range.endOffset]?.nextSibling;
    if (nextSibling) {
      nodes.add(nextSibling);
    }
  }

  return [...nodes]
    .map((v) => (v?.nodeType === 3 ? v.parentNode : v))
    .filter(Boolean);
}

function BoldNode({ selected, children, ...args }) {
  return (
    <strong {...args}>
      {selected && <span className="marker">**</span>}
      {children}
      {selected && <span className="marker">**</span>}
    </strong>
  );
}
function ItalicNode({ selected, children, ...args }) {
  return (
    <i {...args}>
      {selected && <span className="marker">__</span>}
      {children}
      {selected && <span className="marker">__</span>}
    </i>
  );
}

function StrikeNode({ selected, children, ...args }) {
  if (selected) {
    return (
      <span {...args}>
        {selected && <span className="marker">~~</span>}
        {children}
        {selected && <span className="marker">~~</span>}
      </span>
    );
  }

  return (
    <del {...args}>
      {children}
    </del>
  );
}

function UnderlineNode({ selected, children, ...args }) {
  return (
    <span {...args}>
      {selected && <span className="marker">[u]</span>}
      <u>
        {children}
      </u>
      {selected && <span className="marker">[u]</span>}
    </span>
  );
}

function CodeblockNode({
  selected, children, node, ...args
}: { node: TelegramObjectModelNode<any> }) {
  if (!selected) {
    return (
      <div {...args} data-type={ApiMessageEntityTypes.Code} data-id={node.id}>
        <CodeBlock language="js" text={node.children.map((n) => n.text).join('\n')} />
      </div>
    );
  }

  return (
    <pre {...args}>
      <div className="marker">{selected && '```'}js</div>
      {node.children.map((child) => (
        <div data-id={child.id} data-type="text">{child.text}</div>
      ))}
      <div className="marker">{selected && '```'}</div>
    </pre>
  );
}

function BlockquoteNode({
  selected, children, node, ...args
}) {
  // if (!selected) {
  //   return <Blockquote {...args}>{children}</Blockquote>;
  // }

  return (
    <pre {...args} style="margin-bottom: 0;">
      <span className="marker">{'>'}</span>
      {node.children.map((child) => (
        <span data-id={child.id} data-type="text">
          {child.text ?? <br />}
        </span>
      ))}
    </pre>
  );
}

const TextNode = memo(({ node, ...args }) => {
  return <span {...args} key={node.id + Boolean(node.text)}>{node.text || <br />}</span>;
});

function MDNode({ node, selectedIDsSet }: { node: TelegramObjectModelNode<any>; selectedIDsSet: RefObject<Set<string>> }) {
  const args = {
    'data-id': node.id,
    'data-type': node.type,
    key: node.id,
  };

  if (node.type === 'text') {
    return <TextNode {...args} node={node} key={node.id + Boolean(node.text)} />;
  }

  const inner = node.children.map((child) => <MDNode node={child} key={child.id} selectedIDsSet={selectedIDsSet} />);

  // if (node.type === ApiMessageEntityTypes.Bold) {
  //   console.log(node);
  //   const unwrappedNode = tom!.makeNode('text', {});
  //   unwrappedNode.text = `${node.marker}${node.children[0].text}${node.marker}`;

  //   node.insertBefore(unwrappedNode);
  //   node.remove();
  // }

  const isSelected = selectedIDsSet.current?.has(node.id);

  switch (node.type) {
    case ApiMessageEntityTypes.Bold: return <BoldNode selected={isSelected} {...args}>{inner}</BoldNode>;
    case ApiMessageEntityTypes.Italic: return <ItalicNode selected={isSelected} {...args}>{inner}</ItalicNode>;
    case ApiMessageEntityTypes.Strike: return <StrikeNode selected={isSelected} {...args}>{inner}</StrikeNode>;
    case ApiMessageEntityTypes.Underline: return <UnderlineNode selected={isSelected} {...args}>{inner}</UnderlineNode>;
    case 'block': return <div {...args} data-block>{inner.length ? inner : ''}</div>;
    case ApiMessageEntityTypes.Code:
      return (
        <CodeblockNode node={node} selected={isSelected} />
      );
    case ApiMessageEntityTypes.Blockquote:
      return (
        <BlockquoteNode {...args} selected={isSelected} node={node} data-block>{inner}</BlockquoteNode>
      );
    default: return inner ?? '';
  }
}

export default function MarkdownEditor({ ref, onUpdate, ...restProps }: {}) {
  let inputRef = useRef<HTMLElement>();
  const forceUpdate = useForceUpdate();

  const nextSelectionRange = useRef<[[HTMLElement, number, number], [HTMLElement, number, number, number]]>();

  const selectedIDsSet = useRef<Set<string>>();
  const resetNextSelectionTimer = useRef<number>(0);

  inputRef = ref ?? inputRef;

  // const prevSelection = useRef < []();

  const [tom, setTom] = useState<TelegramObjectModel>();

  useEffect(() => {
    selectedIDsSet.current = new Set();

    const newTom = (new MarkdownParser().parse(
      // 'hello **bold** or __italic__ world __is__ good\nhello **bold** or __italic__ world __is__ good\nhello **bold** or __italic__ world __is__ good\nhello **bold** or __italic__ world __is__ good\nhello **bold** or __italic__ world __is__ good\n ```js some code block``` and ```js\nmultiline\ncode\nblock\n```\ntest\n```js\nalert(123)```\n> lol\nkek > lol\n>lol\n>kek',
      '',
    ));

    let isUpdateQueued = false;
    function scheduleUpdate() {
      if (isUpdateQueued) {
        return;
      }

      isUpdateQueued = true;

      queueMicrotask(() => {
        isUpdateQueued = false;
        forceUpdate();

        // const selection = document.getSelection();
        // if (
        //   selection
        //    && selection.rangeCount
        //     && selection.isCollapsed
        //      && selection?.getRangeAt(0)!.startContainer?.dataset?.type === 'root'
        // ) {
        //   const firstTextNode = inputRef.current?.querySelector('[data-type="text"]');
        //   if (firstTextNode) {
        //     const newRange = new Range();
        //     newRange.setStart(firstTextNode, 0);
        //     newRange.setEnd(firstTextNode, 0);
        //     selection.removeAllRanges();
        //     selection.addRange(newRange);
        //   }
        // }
      });
    }

    newTom.onChange(() => {
      scheduleUpdate();
    });

    setTom(newTom);

    const observer = new MutationObserver((mutations) => {
      newTom.batchChange(() => {
        console.log(mutations);
        // console.log('mutations', mutations);

        const nodesReplacements = new Map<TelegramObjectModelNode<any>, Array<TelegramObjectModelNode<any>>>();

        // TODO разделять текст и маркер, если текст пишется в конце
        const modifiedMarkerNodeMutations = mutations
          .filter((m) => m.type === 'characterData' && m.target.parentElement?.classList.contains('marker'));

        mutations = mutations.filter((mutation) => !modifiedMarkerNodeMutations.includes(mutation));

        const addedNodeIds = new Set<string>();
        const deleteNodeIds = new Set<string>();

        const stash = new Map<string, TelegramObjectModelNode<any>>();

        for (const mutation of mutations) {
          if (mutation.type === 'characterData') {
            const parentNode = mutation.target.parentElement;

            if (parentNode?.classList.contains('marker')) {
              continue;
            } else {
              const tomID = parentNode?.dataset.id;
              if (!tomID) {
                console.log('not a tom node', tomID, parentNode);
                continue;
              }

              if (!tomID) {
                console.log('not a tom text', tomNode, mutation);
              }

              const tomInstance = newTom.getNodeById(tomID);
              if (tomInstance && tomInstance.type === 'text') {
                tomInstance!.text = mutation.target.nodeValue;
              } else {
                console.log('not found tom instance', mutation, mutation.target);
              }
            }
          } else if (mutation.type === 'childList') {
            if (
              mutation.previousSibling?.dataset?.block
            && mutation.previousSibling?.dataset?.id
            && mutation.previousSibling?.dataset?.id === mutation.addedNodes?.[0]?.dataset?.id
            ) {
              console.log('ch', mutation);
              const prevBlockEl = mutation.previousSibling! as HTMLElement;
              const prevBlockNode = newTom.getNodeById(prevBlockEl.dataset.id)!;
              if (!prevBlockNode.parent) {
                console.warn('no parent?', prevBlockNode);
                continue;
              }

              // register new line block with id from copy
              const newBlockEl = mutation.addedNodes[0]! as HTMLElement;
              const blockNode = newTom.makeNode('block');

              // Придется перерегистрировать все ноды внутри
              [...newBlockEl.children].forEach((el, i) => {
                const existNode = newTom.getNodeById(el.dataset.id)!;
                if (!existNode) {
                  return;
                }

                if (i === 0 && el.dataset.type === 'text') {
                  const prevSpanEl = prevBlockEl.querySelector(`[data-id="${el.dataset.id}"]`) as HTMLElement;
                  existNode.text = prevSpanEl.innerText;

                  const newNode = newTom.makeNode('text', {});
                  newNode.text = el.innerText;
                  blockNode.pushNode(newNode);
                } else {
                  blockNode.pushNode(existNode);
                }
              });

              newBlockEl.dataset.id = '';
              newBlockEl.dataset.type = '';
              newBlockEl.remove();

              prevBlockNode.insertAfter(blockNode);
              addedNodeIds.add(prevBlockEl.dataset.id);
              // nextMutationSafe.add(prevBlockNode);
            }

            // function checkBlock(checkBlockNode: HTMLElement) {
            //   if (
            //     checkBlockNode.children.length === 1
            //         && checkBlockNode.children[0].tagName === 'BR'
            //   ) {
            //     const blockInstance = newTom.getNodeById(checkBlockNode.dataset.id);
            //     if (blockInstance) {
            //       const textNode = newTom.makeNode('text', {});
            //       textNode.text = '';
            //       blockInstance?.pushNode(textNode);
            //       deleteNodeIds.delete(blockInstance.id);
            //     }
            //   } else if (checkBlockNode.children.length === 0) {
            //     const textNode = newTom.makeNode('text', {});
            //     textNode.text = '';
            //     const blockNode = newTom.makeNode('block', {});
            //     blockNode.pushNode(textNode);
            //     newTom.root.pushNode(blockNode);
            //   }
            // }

            for (const rNode of mutation.removedNodes) {
              if (!rNode?.dataset?.id) {
                continue;
              }

              const tomInstance = newTom.getNodeById(rNode.dataset.id);
              if (tomInstance) {
                // не можем удалять сразу, так как за ним удалятся и все дети
                if (!addedNodeIds.delete(tomInstance.id)) {
                  deleteNodeIds.add(tomInstance.id);
                }
              }
            }

            for (const aNode of mutation.addedNodes) {
              if (mutation.removedNodes[0] && aNode === mutation.removedNodes[0]) {
                continue;
              }

              if (!aNode?.dataset?.id) {
                continue;
              }

              if (aNode.dataset.id === mutation.previousSibling?.dataset?.id) {
                continue;
              }

              const tomInstance = newTom.getNodeById(aNode.dataset.id) ?? stash.get(aNode.dataset.id);

              if (!tomInstance) {
                console.warn('no instance', aNode);
                continue;
              }

              if (!deleteNodeIds.delete(tomInstance.id)) {
                addedNodeIds.add(tomInstance.id);
              }

              const domParentId = aNode.parentElement?.dataset.id;

              // У TOM нод еще старый parent, надо это учитывать
              const mutationTargetNode = newTom.getNodeById(mutation.target?.dataset?.id);
              const mutationNextSiblingNode = newTom.getNodeById(mutation.nextSibling?.dataset?.id);
              const mutationPrevSiblingNode = newTom.getNodeById(mutation.previousSibling?.dataset?.id);

              if (mutationPrevSiblingNode) {
                mutationPrevSiblingNode.insertAfter(tomInstance);
                console.log('after', tomInstance, tomInstance?.type, tomInstance.text, mutation.previousSibling);
              } else if (mutationNextSiblingNode) {
                mutationNextSiblingNode.insertBefore(tomInstance);
                console.log('before', tomInstance, tomInstance?.type, tomInstance.text);
              } else if (mutationTargetNode) {
                mutationTargetNode.pushNode(tomInstance);
                console.log('push', tomInstance, tomInstance?.type, tomInstance.text);
              }
            }
          }
        }

        deleteNodeIds.forEach((id) => {
          const n = newTom.getNodeById(id);

          // const checkBlockNode: HTMLElement | undefined = rNode?.dataset?.type === 'block'
          //   ? rNode
          //   : mutation.target?.dataset?.type === 'block'
          //     ? mutation.target : undefined;

          // if (checkBlockNode) {
          //   checkBlock(checkBlockNode);
          // }

          // if (inputRef.current?.children.length === 0) {
          //   const textNode = newTom.makeNode('text', {});
          //   textNode.text = '';
          //   const blockNode = newTom.makeNode('block', {});
          //   blockNode.pushNode(textNode);
          //   newTom.root.pushNode(blockNode);
          // } else if (inputRef.current?.children.length === 1 && inputRef.current.children[0].children.length === 1) {
          //   const blockInstance = newTom.getNodeById(inputRef.current.children[0].dataset.id);
          //   if (blockInstance) {
          //     const textNode = newTom.makeNode('text', {});
          //     textNode.text = '';
          //     blockInstance?.pushNode(textNode);
          //   }
          // }

          // console.log('remove', n.type, n);

          if (n && (n.parent!.type === 'root') && n.parent?.children.length === 1) {
            const blockNode = newTom.makeNode('block', {});
            const textNode = newTom.makeNode('text', {});
            textNode.text = '';
            blockNode.pushNode(textNode);
            n.insertBefore(blockNode);

            mutations.forEach((mutation) => {
              for (const node of mutation.addedNodes) {
                if (node.tagName === 'BR') {
                  node.remove();
                }
              }
            });
          } else if (n && (n.parent!.type === 'block') && n.parent?.children.length === 1) {
            const textNode = newTom.makeNode('text', {});
            textNode.text = '';
            n.insertBefore(textNode);

            mutations.forEach((mutation) => {
              for (const node of mutation.addedNodes) {
                if (node.tagName === 'BR') {
                  node.remove();
                }
              }
            });
          }

          console.log('remove', n, n.type);

          n.remove();
        });

        const unwrapNodes = new Set<HTMLElement>();

        // first delete inner contents then modify markers
        for (const mutation of modifiedMarkerNodeMutations) {
          const tomNode = mutation.target.parentElement?.closest('[data-type]') as HTMLElement;
          unwrapNodes.add(tomNode);
        }

        unwrapNodes.forEach((tomNode: HTMLElement) => {
          const tomInstance = newTom.getNodeById(tomNode?.dataset.id)!;
          if (!tomInstance) {
            console.log('not found tom instance for', tomNode);
            return;
          }

          const markerNodes = tomNode.querySelectorAll('.marker');

          let startMarker: HTMLElement | undefined;
          let endMarker: HTMLElement | undefined;

          startMarker = markerNodes[0] === tomNode.firstChild ? markerNodes[0] : undefined;
          const endMarkerTemp = (markerNodes[1] ?? markerNodes[0]);
          endMarker = endMarkerTemp === startMarker ? undefined : endMarkerTemp;

          let needUnwrap = false;

          if (startMarker) {
            const [beforeContent, afterContent] = startMarker.textContent.split(tomInstance.marker);
            if (beforeContent !== undefined && afterContent !== undefined) {
              startMarker.textContent = tomInstance.marker;

              if (beforeContent) {
                const textNode = newTom.makeNode('text', {});
                textNode.text = beforeContent;
                tomInstance.insertBefore(textNode);
              }

              if (afterContent) {
                const textNode = newTom.makeNode('text', {});
                textNode.text = afterContent;
                tomInstance.unshiftNode(textNode);
              }
            } else {
              needUnwrap = true;
            }
          }

          if (endMarker) {
            const [beforeContent, afterContent] = endMarker.textContent.split(tomInstance.marker);
            if (beforeContent !== undefined && afterContent !== undefined) {
              endMarker.textContent = tomInstance.marker;

              if (beforeContent) {
                const textNode = newTom.makeNode('text', {});
                textNode.text = beforeContent;
                tomInstance.pushNode(textNode);
              }

              if (afterContent) {
                const textNode = newTom.makeNode('text', {});
                textNode.text = afterContent;
                tomInstance.insertAfter(textNode);
              }
            } else {
              needUnwrap = true;
            }
          }

          if (needUnwrap) {
            console.log('unwrap', tomNode);
            if (!nodesReplacements.has(tomInstance)) {
              if (tomInstance.type === ApiMessageEntityTypes.Code) {
                nodesReplacements.set(tomInstance, [...tomInstance.children.map((v) => {
                  const blockNode = newTom.makeNode('block', {});
                  const textNode = newTom.makeNode('text', {});
                  textNode.text = v.text;
                  blockNode.pushNode(textNode);

                  return blockNode;
                })]);
              } else {
                nodesReplacements.set(tomInstance, [...tomInstance.children]);
              }
            }

            const value = [...nodesReplacements.get(tomInstance)!];

            if (startMarker) {
              const textNode = newTom.makeNode('text', {});
              textNode.text = startMarker.innerText;
              if (tomNode.nodeName === ApiMessageEntityTypes.Code) {
                const blockNode = newTom.makeNode('block', {});
                blockNode.pushNode(textNode);
                value.unshift(blockNode);
              } else {
                value.unshift(textNode);
              }
            }

            if (endMarker) {
              const textNode = newTom.makeNode('text', {});
              textNode.text = endMarker.innerText;
              if (tomNode.nodeName === ApiMessageEntityTypes.Code) {
                const blockNode = newTom.makeNode('block', {});
                blockNode.pushNode(textNode);
                value.push(blockNode);
              } else {
                value.push(textNode);
              }
            }

            console.log('set', value);
            nodesReplacements.set(tomInstance, value);
          }
        });

        // TODO мб перенести контроль удаления маркеров в сам компонент ноды?

        nodesReplacements.forEach((replacements, n) => {
          console.log('insert', ...replacements, 'before', n);
          n.insertBefore(...replacements.filter((v) => v));
          n.remove();
        });

        newTom.root.bakeNodes();
      });
    });

    observer.observe(ref.current!, {
      subtree: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
    });

    document.addEventListener('selectionchange', (e) => {
      if (nextSelectionRange.current) {
        const selection = document.getSelection();
        if (selection) {
          let [selector, fallbackSelector] = nextSelectionRange.current;
          if (!selector[0].isConnected && fallbackSelector[0].isConnected) {
            selector = [fallbackSelector[0].childNodes[fallbackSelector[1]], fallbackSelector[2], fallbackSelector[3]];
          }

          // check multiple nodes?
          const textNode = selector[0].childNodes[0];
          if (textNode.isConnected && textNode.nodeType === 3) {
            const range = new Range();
            range.setStart(textNode, selector[1]);
            range.setEnd(textNode, selector[2]);

            selection.removeAllRanges();
            selection.addRange(range);
            resetNextSelectionTimer.current = requestAnimationFrame(() => {
              resetNextSelectionTimer.current = requestAnimationFrame(() => {
                nextSelectionRange.current = undefined;
              });
            });
          }
        }

        return;
      }

      const selection = document.getSelection();

      if (!selection?.rangeCount) {
        return;
      }

      const range = selection.getRangeAt(0)!;
      if (selection.isCollapsed && range.startContainer?.dataset?.type === 'root') {
        const firstTextNode = inputRef.current?.querySelector('[data-type="text"]');
        if (firstTextNode) {
          const newRange = new Range();
          newRange.setStart(firstTextNode, 0);
          newRange.setEnd(firstTextNode, 0);
          selection.removeAllRanges();
          selection.addRange(newRange);
          return;
        }
      }

      selectedIDsSet.current?.clear();

      getNodesInRange(range)
        .filter((v) => v.dataset?.type)
        .forEach((el: HTMLElement) => {
          selectedIDsSet.current?.add(el.dataset.id);
        });

      if (selection.isCollapsed) {
        scheduleUpdate();
      }
    });

    document.addEventListener('mouseup', () => {
      scheduleUpdate();
    });

    document.addEventListener('keyup', () => {
      scheduleUpdate();
    });
  }, []);

  useEffect(() => {
    if (tom) {
      onUpdate(tom?.apiText);
    }
    const unsub = tom?.onChange(() => {
      onUpdate(tom.apiText);
    });

    return () => unsub?.();
  }, [tom]);

  function handleInput(e: FormEvent<HTMLInputElement>) {
    const selection = document.getSelection();
    if (!selection || !selection.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0)!;

    const parent = range.startContainer.parentElement!;
    const parentParent = parent.parentElement;
    const parentPosition = parentParent ? [...parentParent.childNodes].indexOf(parent) : -1;

    cancelAnimationFrame(resetNextSelectionTimer.current);

    // teact rerenders text as new DOM node
    nextSelectionRange.current = [
      [parent as HTMLElement, range.startOffset, range.endOffset],
      [parentParent as HTMLElement, parentPosition, range.startOffset, range.endOffset],
    ];
  }

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: tom?.html }} style="position: fixed; top: 0; right: 0; transform: scale(0.5); transform-origin: top right;" />
      <div
        {...restProps}
        contentEditable="plaintext-only"
        ref={(el) => inputRef.current = el}
        data-type={tom?.root.type}
        data-id={tom?.root.id}
        // onBeforeInput={(e) => console.log('before input', e)}
        onInput={handleInput}
      >
        {tom?.root.children.map((node) => {
          return <MDNode key={node.id} node={node} selectedIDsSet={selectedIDsSet} />;
        })}
      </div>
    </>
  );
}
