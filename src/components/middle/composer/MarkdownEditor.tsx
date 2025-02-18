/* eslint-disable react/jsx-props-no-spreading */
import { node } from 'webpack';
import { useEffect, useRef, useState } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teactn';

import type { TelegramObjectModel, TelegramObjectModelNode } from '../../../lib/MarkdownParser';
import { ApiMessageEntityTypes } from '../../../api/types';

import { MarkdownParser } from '../../../lib/MarkdownParser';
import buildClassName from '../../../util/buildClassName';

import useForceUpdate from '../../../hooks/useForceUpdate';

import Blockquote from '../../common/Blockquote';

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

function Node({ selected, children, ...args }) {
  return (
    <strong {...args}>
      {selected && <span className="marker">**</span>}
      {children}
      {selected && <span className="marker">**</span>}
    </strong>
  );
}

export default function MarkdownEditor() {
  const ref = useRef<HTMLElement>();
  const forceUpdate = useForceUpdate();

  const selectedIDsSet = useRef<Set<string>>();

  // const prevSelection = useRef < []();

  const [tom, setTom] = useState<TelegramObjectModel>();
  const [keepSelection, setKeepSelection] = useState<Range>();

  useEffect(() => {
    selectedIDsSet.current = new Set();

    const newTom = (new MarkdownParser().parse(
      'hello **bold** or __italic__ world __is__ good ```js some code block``` and ```js\nmultiline\ncode\nblock\n```\ntest\n```js\nalert(123)```\n> lol\nkek > lol\n>lol\n>kek',
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

    const observer = new MutationObserver((mutations) => {
      console.log('mutations', mutations);

      const nodesReplacements = new Map<TelegramObjectModelNode<any>, Array<TelegramObjectModelNode<any>>>();

      const modifiedMarkerNodeMutations = mutations
        .filter((m) => m.type === 'characterData' && m.target.parentElement!.classList.contains('marker'));

      mutations = mutations.filter((mutation) => !modifiedMarkerNodeMutations.includes(mutation));

      const safeNodes = new Set<TelegramObjectModelNode<any>>();
      const deleteNodes = new Set<TelegramObjectModelNode<any>>();

      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          const parentNode = mutation.target.parentElement;

          if (parentNode?.classList.contains('marker')) {
            continue;
          } else {
            const tomID = tomNode?.dataset.id;

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
          for (const rNode of mutation.removedNodes) {
            if (!rNode?.dataset?.id) {
              continue;
            }

            const tomInstance = newTom.getNodeById(rNode.dataset.id);
            deleteNodes.add(tomInstance);
          }

          for (const aNode of mutation.addedNodes) {
            if (!aNode?.dataset?.id) {
              continue;
            }

            const tomInstance = newTom.getNodeById(aNode.dataset.id);
            safeNodes.add(tomInstance);
          }
        }
      }

      console.log('del', deleteNodes);
      console.log('safe', safeNodes);

      deleteNodes.forEach((n) => {
        if (safeNodes.has(n) || !n) {
          return;
        }

        n.remove();
      });

      // first delete inner contents then modify markers
      for (const mutation of modifiedMarkerNodeMutations) {
        const markerEl = mutation.target.parentElement;

        const tomNode = mutation.target.parentElement?.closest('[data-type]') as HTMLElement;
        const tomInstance = newTom.getNodeById(tomNode?.dataset.id)!;

        if (!nodesReplacements.has(tomInstance)) {
          nodesReplacements.set(tomInstance, [...tomInstance.children]);
        }

        const value = [...nodesReplacements.get(tomInstance)!];

        if (tomNode.firstChild === markerEl) {
          const markerInstance = newTom.makeNode('text', {});
          markerInstance.text = mutation.target.textContent!;
          value.unshift(markerInstance);
        } else if (tomNode.lastChild === markerEl) {
          const markerInstance = newTom.makeNode('text', {});
          markerInstance.text = mutation.target.textContent!;
          value.push(markerInstance);
        }

        console.log('set', value);
        nodesReplacements.set(tomInstance, value);
      }

      // TODO мб перенести контроль удаления маркеров в сам компонент ноды?

      nodesReplacements.forEach((replacements, n) => {
        console.log('insert', ...replacements, 'before', n);
        n.insertBefore(...replacements);
        n.remove();
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

      selectedIDsSet.current!.clear();

      getNodesInRange(selection?.getRangeAt(0))
        .filter((v) => v.dataset?.type)
        .forEach((el: HTMLElement) => {
          selectedIDsSet.current!.add(el.dataset.id);
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

  function renderNode(node: TelegramObjectModelNode<any>) {
    const args = {
      'data-id': node.id,
      'data-type': node.type,
      key: node.id,
      teactOrderKey: node.id,
    };

    if (node.type === 'text') {
      return <span {...args}>{node.text}</span>;
    }

    const inner = node.children.map((child) => renderNode(child));

    // if (node.type === ApiMessageEntityTypes.Bold) {
    //   console.log(node);
    //   const unwrappedNode = tom!.makeNode('text', {});
    //   unwrappedNode.text = `${node.marker}${node.children[0].text}${node.marker}`;

    //   node.insertBefore(unwrappedNode);
    //   node.remove();
    // }

    switch (node.type) {
      case 'text': return <span {...args}>{node.text ?? ''}</span>;
      case ApiMessageEntityTypes.Bold: return <Node selected={selectedIDsSet.current?.has(node.id)} {...args}>{inner}</Node>;
      case ApiMessageEntityTypes.Italic: return <i {...args}>{inner}</i>;
      case 'block': return <div {...args} data-block>{inner}</div>;
      case ApiMessageEntityTypes.Code:
        return (
          <pre {...args} data-block className={buildClassName(node.attrs.isStart && 'code-block-start')}>
            {inner}
          </pre>
        );
      case ApiMessageEntityTypes.Blockquote:
        return (
          <Blockquote {...args} data-block>{inner}</Blockquote>
        );
      default: return inner ?? '';
    }
  }

  return (
    <div contentEditable ref={(el) => ref.current = el}>
      {tom?.children.map((node) => {
        return renderNode(node);
      })}
    </div>
  );
}
