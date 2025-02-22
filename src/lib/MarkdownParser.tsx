/* eslint-disable max-classes-per-file */
import { type ApiFormattedText, type ApiMessageEntity, ApiMessageEntityTypes } from '../api/types';

import buildClassName from '../util/buildClassName';
import { generateRandomInt } from '../api/gramjs/gramjsBuilders';
import React from './teact/teactn';

import ConnectionStatusOverlay from '../components/left/ConnectionStatusOverlay';

interface InlineContext {
  position: number;
  block: string;
  result: TelegramObjectModelNode;
  // todo
  usedMarkers: string[];
}

interface BlockContext {
  startedGroup?: [string, string];
}

interface MessageNode {
  id: string;
  type: string;
  text: string;
  children: AnyNode[];
}

interface BlockMessageNode extends MessageNode {
  type: 'block';
}

interface CodeBlockMessageNode extends MessageNode {
  type: ApiMessageEntityTypes.Code;
  isStart?: boolean;
  isEnd?: boolean;
  language: string;
}

interface TextMessageNode extends MessageNode {
  type: 'text';
}

interface BoldMessageNode extends MessageNode {
  type: ApiMessageEntityTypes.Bold;
}

interface ItalicMessageNode extends MessageNode {
  type: ApiMessageEntityTypes.Italic;
}

interface UnderlineMessageNode extends MessageNode {
  type: ApiMessageEntityTypes.Underline;
}

interface StrikethroughMessageNode extends MessageNode {
  type: ApiMessageEntityTypes.Strike;
}
interface BlockquoteMessageNode extends MessageNode {
  type: ApiMessageEntityTypes.Blockquote;
}

interface LinkMessageNode extends MessageNode {
  type: 'link';
  url: string;
}

interface MentionMessageNode extends MessageNode {
  type: 'mention';
  userId: number;
}

export type AnyNode = BlockMessageNode | TextMessageNode | BoldMessageNode |
ItalicMessageNode | UnderlineMessageNode | StrikethroughMessageNode | LinkMessageNode | MentionMessageNode |
CodeBlockMessageNode | BlockquoteMessageNode;

export class TelegramObjectModelNode<T extends AnyNode> {
  #id = generateRandomInt().toString();

  #type: T['type'];

  #tom: TelegramObjectModel;

  #text: string = '';

  #parent: TelegramObjectModelNode<any> | undefined = undefined;

  #children: TelegramObjectModelNode<any>[];

  #attrs: Omit<T, 'id' | 'type' | 'children' | 'text'>;

  constructor(tom: TelegramObjectModel, type: T['type'], attrs: Omit<T, 'id' | 'type' | 'children' | 'text'>) {
    this.#tom = tom;
    this.#type = type;
    this.#children = [];
    this.#attrs = attrs;
  }

  unshiftNode(...nodes: TelegramObjectModelNode<any>[]) {
    for (const node of nodes) {
      node.#tom = this.#tom;
      node.parent = this;
      this.#children = [node, ...this.#children.filter((v) => v !== node)];
      this.#tom.registerNode(node);
    }

    this.onChanged();
  }

  pushNode(...nodes: TelegramObjectModelNode<any>[]) {
    for (const node of nodes) {
      // if (node.type === 'text' && this.#children.at(-1)?.type === 'text') {
      //   // should be commited after mutations
      //   this.#children.at(-1)!.text += node.text;
      // } else {
      node.#tom = this.#tom;
      node.parent = this;
      this.#children = [...this.#children.filter((v) => v !== node), node];
      this.#tom.registerNode(node);
      // }
    }

    this.onChanged();
  }

  private bakeNode(node: TelegramObjectModelNode<any>) {
    for (const child of node.children) {
      if (child.type === 'text' && child.previousSibling?.type === 'text') {
        child.previousSibling.text += child.text;
        child.remove();
      }

      if (child.children) {
        this.bakeNode(child);
      }
    }
  }

  bakeNodes() {
    this.#tom.batchChange(() => {
      this.bakeNode(this);
    });
  }

  insertBefore(...children: Array<TelegramObjectModelNode<any>>) {
    if (!this.#parent) {
      throw new Error('no parent');
    }

    this.#parent.#children = [...this.#parent.#children.filter((v) => !children.includes(v))];

    children.forEach((child) => {
      child.parent = this.parent;
      child.#tom = this.#tom;
      this.#tom.registerNode(child);
    });

    const index = this.parent?.children.findIndex((v) => v === this)!;

    this.parent?.children.splice(index, 0, ...children);

    this.#parent!.onChanged();
  }

  insertAfter(...children: Array<TelegramObjectModelNode<any>>) {
    if (!this.#parent) {
      throw new Error('no parent');
    }

    this.#parent.#children = [...this.#parent.#children.filter((v) => !children.includes(v))];

    children.forEach((child) => {
      child.parent = this.parent;
      child.#tom = this.#tom;
      this.#tom.registerNode(child);
    });

    const index = this.#parent?.children.findIndex((v) => v === this)!;

    this.#parent!.children.splice(index + 1, 0, ...children);

    this.#parent!.onChanged();
  }

  remove() {
    this.#children.forEach((child) => child.remove());
    this.#children = [];

    this.#parent?.removeChild(this);
  }

  removeChild(child: TelegramObjectModelNode<any>) {
    const index = this.#children.indexOf(child);

    if (index === -1) return;

    this.#children.splice(index, 1);
    this.#tom.unregisterNode(child);
    this.onChanged();
  }

  clone() {
    // todo deep?
    return new TelegramObjectModelNode<T>(this.#tom, this.#type, this.#attrs);
  }

  private onChanged() {
    if (!this.#parent && this !== this.#tom.root) {
      // not connected
      return;
    }

    this.#tom.notifyChange(this);
  }

  get marker() {
    switch (this.#type) {
      case ApiMessageEntityTypes.Bold:
        return '**';
      case ApiMessageEntityTypes.Italic:
        return '__';
      case ApiMessageEntityTypes.Strike:
        return '~~';
      case ApiMessageEntityTypes.Underline:
        return '[u]';
      case ApiMessageEntityTypes.Code:
        return '````';
      case ApiMessageEntityTypes.Blockquote:
        return '>';
    }

    return ' ';
  }

  get id() {
    return this.#id;
  }

  get type() {
    return this.#type;
  }

  set type(value: typeof this['type']) {
    this.#type = value;
    this.onChanged();
  }

  get children() {
    return this.#children;
  }

  set children(children) {
    this.#children = children;
  }

  get text() {
    return this.#text;
  }

  set text(value: string) {
    if (this.#type !== 'text') throw new Error('Cannot set text on non-text node');
    this.#text = value;
    this.onChanged();
  }

  get parent() {
    return this.#parent;
  }

  set parent(newParent) {
    if (this.#parent && this.#parent !== newParent) {
      this.#parent.#children = this.#parent.#children.filter((v) => v !== this);
    }

    this.#parent = newParent;
  }

  get attrs() {
    return this.#attrs;
  }

  get nextSibling(): TelegramObjectModelNode<any> | undefined {
    if (!this.#parent) return undefined;

    const index = this.#parent.children.indexOf(this);

    return this.#parent.children[index + 1];
  }

  get previousSibling(): TelegramObjectModelNode<any> | undefined {
    if (!this.#parent) return undefined;

    const index = this.#parent.children.indexOf(this);

    return this.#parent.children[index - 1];
  }
}

export class TelegramObjectModel {
  #root = new TelegramObjectModelNode<any>(this, 'root', { });

  #callbacks = new Set<VoidFunction>();

  #nodesById: Map<string, TelegramObjectModelNode<any>> = new Map();

  #updateScheduled = false;

  #batchInProgress = 0;

  constructor() {
    this.registerNode(this.#root);
  }

  registerNode(node: TelegramObjectModelNode<any>, deep = false) {
    this.#nodesById.set(node.id, node);

    if (deep) {
      node.children.forEach((child) => this.registerNode(child, true));
    }
  }

  unregisterNode(node: TelegramObjectModelNode<any>) {
    this.#nodesById.delete(node.id);
  }

  batchChange = (cb: VoidFunction) => {
    this.#batchInProgress++;
    window.cbprogress ??= new Set();
    window.cbprogress.add(cb);
    cb();
    window.cbprogress.delete(cb);
    this.#batchInProgress--;

    if (this.#batchInProgress > 0) {
      return;
    }

    if (this.#updateScheduled) {
      this.notifyChange();
      this.#updateScheduled = false;
    }
  };

  makeNode<T extends AnyNode>(type: T['type'], attrs: Omit<T, 'id' | 'type' | 'children' | 'text'>)
    : TelegramObjectModelNode<T> {
    return new TelegramObjectModelNode(this, type, attrs);
  }

  getNodeById(id: string) {
    return this.#nodesById.get(id);
  }

  notifyChange(changedNode: TelegramObjectModelNode<any>) {
    if (this.#batchInProgress) {
      this.#updateScheduled = true;
      return;
    }

    this.#callbacks.forEach((cb) => cb());

    if (changedNode === this.#root) {
      return;
    }

    // let textStack = '';
    // function walkNode(node: TelegramObjectModelNode<any>) {
    //   if (node.type === 'text') {
    //     textStack += node.text;
    //   } else {
    //     console.log('stack fin', textStack);
    //     textStack = '';
    //   }
    // }

    // console.log('notifcy', changedNode);

    const blockStack: [string[], TelegramObjectModelNode<any>[]] = [[], []];

    const tryParse = (str: string, nodes: TelegramObjectModelNode<any>[], tryBlock = false) => {
      if (tryBlock) {
        // console.log('try block', str);
        if (str.startsWith('```')) {
          if (blockStack[0].length) {
            console.log(blockStack);
            const codeBlock = this.makeNode(ApiMessageEntityTypes.Code, {});
            this.batchChange(() => {
              blockStack[0].forEach((v) => {
                const textNode = this.makeNode('text', {});
                textNode.text = v;
                console.log('create text', v);

                codeBlock.pushNode(textNode);
                nodes[0].parent?.insertBefore(codeBlock);
                nodes.forEach((node) => node.remove());
                blockStack[1].forEach((node) => node.remove());
                blockStack[0] = [];
                blockStack[1] = [];
              });
            });
          } else {
            blockStack[0] = [str];
            blockStack[1] = [...nodes];
          }
        } else if (blockStack[0].length) {
          blockStack[0].push(str);
          blockStack[1].push(...nodes);
        }
      }
      if (!str) {
        return;
      }

      const parser = new MarkdownParser();
      const tempTOM = parser.parse(str);

      const removeCheckedNodes = () => {
        nodes.forEach((deleteNode) => {
          const parent = deleteNode.parent;
          deleteNode.remove();

          if (!parent?.children.length) {
            parent?.remove();
          }
        });
      };

      if (tempTOM.#root.children.length > 1 || tempTOM.#root.children[0].type !== 'block') {
        this.batchChange(() => {
          tempTOM.#root.children.forEach((child) => this.registerNode(child, true));
          nodes[0].parent.insertBefore(...tempTOM.#root.children);
          removeCheckedNodes();
        });
      } else if (tempTOM.root.children[0].children.find((n) => n.type !== 'text')) {
        this.batchChange(() => {
          tempTOM.#root.children[0].children.forEach((child) => this.registerNode(child, true));
          nodes[0].insertBefore(...tempTOM.root.children[0].children);
          removeCheckedNodes();
        });
      }
    };

    [...this.#root.children].forEach((block) => {
      const inlineStack = ['', []];
      [...(block?.children ?? [])].forEach((child) => {
        if (child.type === 'text') {
          inlineStack[0] += (child.text);
          inlineStack[1].push(child);
        } else {
          tryParse(inlineStack[0], inlineStack[1]);
          inlineStack[0] = '';
          inlineStack[1] = [];
        }
      });

      // there is only text nodes in block
      if (inlineStack[0]) {
        tryParse(inlineStack[0], inlineStack[1], true);
      }
    });
  }

  onChange(cb: VoidFunction) {
    this.#callbacks.add(cb);
    return () => this.#callbacks.delete(cb);
  }

  get root() {
    return this.#root;
  }

  private renderNode(node: TelegramObjectModelNode<any>): string {
    const args = `data-id="${node.id}" data-type="${node.type}"`;
    const innerHTML = node.children.map((child) => this.renderNode(child)).join('');

    // TODO add real state to DOM node instead of data attrs

    switch (node.type) {
      case 'text': return `<span ${args}>${node.text || '<br />'}</span>`;
      case ApiMessageEntityTypes.Bold: return `<strong ${args}>${innerHTML}</strong>`;
      case ApiMessageEntityTypes.Italic: return `<i ${args}>${innerHTML}</i>`;
      case ApiMessageEntityTypes.Strike: return `<del ${args}>${innerHTML}</del>`;
      case ApiMessageEntityTypes.Underline: return `<u ${args}>${innerHTML}</u>`;
      case 'block': return `<div ${args} data-block>${innerHTML}</div>`;
      case ApiMessageEntityTypes.Code:
        return `<pre ${args} data-block class="${buildClassName(node.attrs.isStart && 'code-block-start')}">${innerHTML}</pre>`;
      case ApiMessageEntityTypes.Blockquote:
        return `<blockquote ${args} data-block>${innerHTML}</blockquote><br/>`;
      default: return innerHTML ?? '';
    }
  }

  get html(): string {
    return this.#root.children.map((block) => {
      return this.renderNode(block);
    }).join('');
  }

  get apiText(): ApiFormattedText {
    let text: string = '';
    const entities: ApiMessageEntity[] = [];

    let blockText = '';

    function nextNode(node: TelegramObjectModelNode<any>) {
      if (node.type === 'text') {
        blockText += node.text;
        return;
      }

      // todo maybe add offset for \n symbols
      const start = blockText.length;

      for (const child of node.children) {
        nextNode(child);
      }

      const apiType: ApiMessageEntity['type'] = node.type;
      // switch (node.type) {
      //   default:
      //     apiType = node.type;
      // }

      const entity: ApiMessageEntity = {
        type: apiType,
        offset: start,
        length: blockText.length - start,
      };

      entities.push(entity);
    }

    for (let i = 0; i < this.#root.children.length; i++) {
      const block = this.#root.children[i];

      blockText = '';

      for (const inlineChild of block.children) {
        nextNode(inlineChild);
      }

      if (block.type === ApiMessageEntityTypes.Code) {
        entities.push({
          type: block.type,
          offset: text.length,
          length: blockText.length,
        });
      } else if (block.type === ApiMessageEntityTypes.Blockquote) {
        entities.push({
          type: block.type,
          offset: text.length,
          length: blockText.length,
        });
      }

      text += blockText;

      if (i !== this.#root.length - 1) {
        text += '\n';
      }
    }

    return {
      text,
      entities,
    };
  }
}

export class MarkdownParser {
  #tom = new TelegramObjectModel();

  parse(text: string): TelegramObjectModel {
    const blocks = text.split('\n');

    let startedGroup: BlockContext['startedGroup'];

    for (let i = 0; i < blocks.length; i++) {
      const blockText = blocks[i];

      // Force convert Markdown to block
      const codeBlockStart = blockText.indexOf('```');
      if (codeBlockStart !== -1 && codeBlockStart !== 0) {
        const codeBlockEnd = blockText.indexOf('```', codeBlockStart + 3);

        if (codeBlockEnd === -1) {
          blocks.splice(
            i,
            1,
            blockText.slice(0, codeBlockStart),
            '```',
          );
        } else {
          blocks.splice(
            i,
            1,
            blockText.slice(0, codeBlockStart),
            '```',
            blockText.slice(codeBlockStart + 3, codeBlockEnd),
            '```',
            blockText.slice(codeBlockEnd + 3),
          );
        }
      }
    }

    const ctx: BlockContext = {
      startedGroup,
    };

    blocks.forEach((block) => {
      this.parseBlock(ctx, block);
    });

    if (this.#tom.root.children.length === 1 && this.#tom.root.children[0].children.length === 0) {
      const emptyTextNode = this.#tom.makeNode('text', {});
      emptyTextNode.text = '';
      this.#tom.root.children[0].pushNode(emptyTextNode);
    }

    return this.#tom;
  }

  private parseBlock(blockContext: BlockContext, block: string) {
    if (this.parseCode(blockContext, block)) {
      return;
    }

    if (this.parseQuote(blockContext, block)) {
      return;
    }

    const ctx: InlineContext = {
      position: 0,
      block,
      result: this.#tom.makeNode('block', {}),
      usedMarkers: [],
    };

    this.parseInline(ctx);
    this.#tom.root.pushNode(ctx.result);
  }

  private parseInline(ctx: InlineContext) {
    while (ctx.position < ctx.block.length) {
      const startPosition = ctx.position;

      this.parseEmphasis(ctx);
      this.parseItalic(ctx);
      this.parseStrike(ctx);
      this.parseUnderline(ctx);

      if (startPosition === ctx.position) {
        const char = ctx.block[ctx.position];

        const lastChild = ctx.result.children.at(-1);

        if (lastChild?.type === 'text') {
          lastChild.text += char;
        } else {
          const node = this.#tom.makeNode('text', {});
          node.text = char;

          ctx.result.pushNode(node);
        }

        ctx.position += 1;
      }
    }
  }

  private parseCode(ctx: BlockContext, block: string) {
    const isCorner = block.startsWith('```');
    if (!block.startsWith('```') && ctx.startedGroup?.[0] !== ApiMessageEntityTypes.Code) {
      return false;
    }

    const textNode = this.#tom.makeNode('text', {});

    textNode.text = block.replace(/^```/, '').replace(/```$/, '');

    let codeNode: TelegramObjectModelNode<any>;

    if (isCorner && ctx.startedGroup?.[0] === ApiMessageEntityTypes.Code) {
      ctx.startedGroup = undefined;
      codeNode = this.#tom.root.children.at(-1)!;
    } else if (isCorner) {
      codeNode = this.#tom.makeNode(ApiMessageEntityTypes.Code, {
        isStart: isCorner && ctx.startedGroup?.[0] !== ApiMessageEntityTypes.Code,
        isEnd: isCorner && ctx.startedGroup?.[0] === ApiMessageEntityTypes.Code,
      });
      ctx.startedGroup = [ApiMessageEntityTypes.Code, codeNode.id];
      this.#tom.root.pushNode(codeNode);
    } else {
      codeNode = this.#tom.root.children.at(-1)!;
    }

    codeNode.pushNode(textNode);

    return true;
  }

  private parseQuote(ctx: BlockContext, block: string) {
    if (!block.startsWith('>')) {
      return false;
    }

    const textNode = this.#tom.makeNode('text', {});

    textNode.text = block.slice(1);

    const quoteNode = this.#tom.makeNode(ApiMessageEntityTypes.Blockquote, {});
    quoteNode.pushNode(textNode);

    this.#tom.root.pushNode(quoteNode);

    return true;
  }

  private parseBase(ctx: InlineContext, astType: AnyNode['type'], marker: string) {
    if (ctx.usedMarkers.includes(marker)) return;
    if (astType === 'mention' || astType === 'link') return;

    const { block, position } = ctx;

    if (block[position - 1] !== ' ' && position !== 0) {
      return;
    }

    if (block.slice(position, position + marker.length) === marker) {
      const last = block.indexOf(marker, position + marker.length);
      if (last === -1) return;
      const text = block.slice(position + marker.length, last);

      if (!text) {
        return;
      }

      const childNode = this.#tom.makeNode(astType, {});

      const childrenCtx: InlineContext = {
        block: text,
        position: 0,
        result: childNode,
        usedMarkers: [...ctx.usedMarkers, marker],
      };

      this.parseInline(childrenCtx);

      ctx.result.pushNode(childNode);

      ctx.position = last + 2;
    }
  }

  private parseEmphasis(ctx: InlineContext) {
    this.parseBase(ctx, ApiMessageEntityTypes.Bold, '**');
  }

  private parseStrike(ctx: InlineContext) {
    this.parseBase(ctx, ApiMessageEntityTypes.Strike, '~~');
  }

  /**
   * Custom marker syntax
   */
  private parseUnderline(ctx: InlineContext) {
    this.parseBase(ctx, ApiMessageEntityTypes.Underline, '[u]');
  }

  private parseItalic(ctx: InlineContext) {
    this.parseBase(ctx, ApiMessageEntityTypes.Italic, '__');
  }
}
