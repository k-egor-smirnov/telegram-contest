/* eslint-disable react/jsx-props-no-spreading */
import { node } from 'webpack';
import type { RefObject } from '../../../lib/teact/teact';
import { useEffect, useRef, useState } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teactn';

import type { TelegramObjectModel, TelegramObjectModelNode } from '../../../lib/MarkdownParser';
import { ApiMessageEntityTypes } from '../../../api/types';

import { MarkdownParser } from '../../../lib/MarkdownParser';
import buildClassName from '../../../util/buildClassName';

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
    <pre {...args} data-type={ApiMessageEntityTypes.Code} data-id={node.id}>
      <div className="marker">{selected && '```'}js</div>
      {node.children.map((child) => (
        <div data-id={child.id} data-type="text">{child.text}</div>
      ))}
      <div className="marker">{selected && '```'}</div>
    </pre>
  );
}

function MDNode({ node, selectedIDsSet }: { node: TelegramObjectModelNode<any>; selectedIDsSet: RefObject<Set<string>> }) {
  const args = {
    'data-id': node.id,
    'data-type': node.type,
    key: node.id,
  };

  if (node.type === 'text') {
    return <span {...args}>{node.text || '\u00A0'}</span>;
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
    case 'block': return <div {...args} id={`md-block-${node.id}`} data-block>{inner}</div>;
    case ApiMessageEntityTypes.Code:
      return (
        <CodeblockNode node={node} selected={isSelected} />
      );
    case ApiMessageEntityTypes.Blockquote:
      return (
        <Blockquote {...args} data-block>{inner}</Blockquote>
      );
    default: return inner ?? '';
  }
}

export default function MarkdownEditor({ ref, onUpdate, ...restProps }: {}) {
  let inputRef = useRef<HTMLElement>();
  const forceUpdate = useForceUpdate();

  const selectedIDsSet = useRef<Set<string>>();

  inputRef = ref ?? inputRef;

  // const prevSelection = useRef < []();

  const [tom, setTom] = useState<TelegramObjectModel>();
  const [keepSelection, setKeepSelection] = useState<Range>();

  useEffect(() => {
    selectedIDsSet.current = new Set();

    const newTom = (new MarkdownParser().parse(
      'hello **bold** or __italic__ world __is__ good\nhello **bold** or __italic__ world __is__ good\nhello **bold** or __italic__ world __is__ good\nhello **bold** or __italic__ world __is__ good\nhello **bold** or __italic__ world __is__ good\n ```js some code block``` and ```js\nmultiline\ncode\nblock\n```\ntest\n```js\nalert(123)```\n> lol\nkek > lol\n>lol\n>kek',
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
      });
    }

    newTom.onChange(() => {
      scheduleUpdate();
    });

    setTom(newTom);

    const nextMutationSafe = new Set<TelegramObjectModelNode<any>>();

    const observer = new MutationObserver((mutations) => {
      newTom.batchChange(() => {
        console.log(mutations);
        // console.log('mutations', mutations);

        const nodesReplacements = new Map<TelegramObjectModelNode<any>, Array<TelegramObjectModelNode<any>>>();

        const modifiedMarkerNodeMutations = mutations
          .filter((m) => m.type === 'characterData' && m.target.parentElement!.classList.contains('marker'));

        mutations = mutations.filter((mutation) => !modifiedMarkerNodeMutations.includes(mutation));

        const safeNodes = new Set<TelegramObjectModelNode<any>>();
        const deleteNodeIds = new Set<string>();

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

              // not working
              setKeepSelection(document.getSelection()?.getRangeAt(0).cloneRange());

              if (!tomID) {
                console.log('not a tom text', tomNode, mutation);
              }

              const tomInstance = newTom.getNodeById(tomID);
              if (tomInstance) {
                tomInstance!.text = mutation.target.nodeValue;
              } else {
                console.log('not found tom instance', mutation, mutation.target);
              }
            }
          } else if (mutation.type === 'childList') {
            if (
              mutation.previousSibling?.dataset?.type === 'block'
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
              newBlockEl.querySelectorAll(['[data-type]']).forEach((el, i) => {
                const existNode = newTom.getNodeById(el.dataset.id)!;

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

              newBlockEl.remove();

              prevBlockNode.insertAfter(blockNode);
              nextMutationSafe.add(blockNode);
              nextMutationSafe.add(prevBlockNode);
            }

            for (const rNode of mutation.removedNodes) {
              if (!rNode?.dataset?.id) {
                continue;
              }

              const tomInstance = newTom.getNodeById(rNode.dataset.id);
              if (tomInstance) {
                deleteNodeIds.add(tomInstance.id);
              }
            }

            for (const aNode of mutation.addedNodes) {
              if (!aNode?.dataset?.id) {
                continue;
              }

              const tomInstance = newTom.getNodeById(aNode.dataset.id);
              const domParentId = aNode.parentElement?.dataset.id;

              if (domParentId && domParentId !== tomInstance?.parent.id) {
                // У TOM нод еще старый parent, надо это учитывать
                const mutationTargetNode = newTom.getNodeById(mutation.target?.dataset?.id);
                const mutationNextSiblingNode = newTom.getNodeById(mutation.nextSibling?.dataset?.id);
                const mutationPrevSiblingNode = newTom.getNodeById(mutation.previousSibling?.dataset?.id);

                // if (mutationPrevSiblingNode) {
                //   mutationPrevSiblingNode.insertAfter(tomInstance);
                //   console.log('after', tomInstance, tomInstance?.type, tomInstance.text, mutation.previousSibling);
                // } else if (mutationNextSiblingNode) {
                //   mutationNextSiblingNode.insertBefore(tomInstance);
                //   console.log('before', tomInstance, tomInstance?.type, tomInstance.text);
                // } else if (mutationTargetNode) {
                //   mutationTargetNode.pushNode(tomInstance);
                //   console.log('push', tomInstance, tomInstance?.type, tomInstance.text);
                // }
              }

              if (deleteNodeIds.delete(tomInstance.id)) {
              // continue;
              }
            }
          }
        }

        deleteNodeIds.forEach((id) => {
          const n = newTom.getNodeById(id);

          if (safeNodes.has(n) || !n) {
            return;
          }

          if (nextMutationSafe.has(n)) {
            console.log('safe', n);
            nextMutationSafe.delete(n);
            return;
          }

          console.log('remove', n.type, n);

          n.remove();
        });

        // first delete inner contents then modify markers
        for (const mutation of modifiedMarkerNodeMutations) {
          const markerEl = mutation.target.parentElement;

          const tomNode = mutation.target.parentElement?.closest('[data-type]') as HTMLElement;
          const tomInstance = newTom.getNodeById(tomNode?.dataset.id)!;
          if (!tomInstance) {
            console.log('not found tom instance for', tomNode);
            continue;
          }

          if (!nodesReplacements.has(tomInstance)) {
            if (tomInstance.type === ApiMessageEntityTypes.Code) {
              nodesReplacements.set(tomInstance, [...tomInstance.children.map((v) => {
                const blockNode = newTom.makeNode('block');
                const textNode = newTom.makeNode('text');
                textNode.text = v.text;
                blockNode.pushNode(textNode);

                return blockNode;
              })]);
            } else {
              nodesReplacements.set(tomInstance, [...tomInstance.children]);
            }
          }

          const value = [...nodesReplacements.get(tomInstance)!];

          if (tomNode.firstChild === markerEl) {
            console.log('first marker', markerEl?.innerText);
            const textNode = newTom.makeNode('text', {});
            textNode.text = mutation.target.textContent!;
            if (tomNode.nodeName === ApiMessageEntityTypes.Code) {
              const blockNode = newTom.makeNode('block', {});
              blockNode.pushNode(textNode);
              value.unshift(blockNode);
            } else {
              value.unshift(textNode);
            }
          } else if (tomNode.lastChild === markerEl) {
            console.log('last marker', markerEl?.innerText);
            const textNode = newTom.makeNode('text', {});
            textNode.text = mutation.target.textContent!;
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

        // TODO мб перенести контроль удаления маркеров в сам компонент ноды?

        nodesReplacements.forEach((replacements, n) => {
          console.log('insert', ...replacements, 'before', n);
          n.insertBefore(...replacements.filter((v) => v));
          n.remove();
        });
      });
    });

    observer.observe(ref.current!, {
      subtree: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
    });

    document.addEventListener('selectionchange', () => {
      const selection = document.getSelection();

      if (!selection?.rangeCount) {
        return;
      }

      selectedIDsSet.current?.clear();

      getNodesInRange(selection?.getRangeAt(0))
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

  // useEffect(() => {
  //   if (!keepSelection) {
  //     return;
  //   }

  //   const sel = document.getSelection();
  //   sel?.removeAllRanges();
  //   sel?.addRange(keepSelection);
  //   setKeepSelection(undefined);
  // }, [keepSelection]);

  useEffect(() => {
    if (tom) {
      onUpdate(tom?.apiText);
    }
    console.log(tom?.apiText);

    const unsub = tom?.onChange(() => {
      onUpdate(tom.apiText);
    });

    return () => unsub?.();
  }, [tom]);

  console.log(tom?.root);

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: tom?.html }} style="position: fixed; top: 0; right: 0; transform: scale(0.3); transform-origin: top right;" />
      <div {...restProps} contentEditable ref={(el) => inputRef.current = el}>
        {tom?.root.children.map((node) => {
          return <MDNode key={node.id} node={node} selectedIDsSet={selectedIDsSet} />;
        })}
      </div>
    </>
  );
}
