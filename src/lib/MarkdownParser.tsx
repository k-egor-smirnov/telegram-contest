/* eslint-disable max-classes-per-file */
import { type ApiFormattedText, type ApiMessageEntity, ApiMessageEntityTypes } from '../api/types';

import buildClassName from '../util/buildClassName';
import { generateRandomInt } from '../api/gramjs/gramjsBuilders';
import React from './teact/teactn';

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

  #type: string;

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

  unshiftNode(node: TelegramObjectModelNode<any>) {
    node.#parent = this;
    this.#children.unshift(node);
    this.#tom.registerNode(node);
    this.onChanged();
  }

  pushNode(node: TelegramObjectModelNode<any>) {
    node.#parent = this;
    this.#children.push(node);
    this.#tom.registerNode(node);
    this.onChanged();
  }

  insertBefore(...children: Array<TelegramObjectModelNode<any>>) {
    const index = this.#parent?.children.findIndex((v) => v === this)!;
    console.log('children before', [...this.#parent?.children]);
    this.#parent?.children.splice(index, 0, ...children);
    console.log('children after', [...this.#parent?.children]);

    children.forEach((child) => {
      this.#tom.registerNode(child);
    });
  }

  insertAfter(...children: Array<TelegramObjectModelNode<any>>) {
    const index = this.#parent?.children.findIndex((v) => v === this)!;
    this.#parent?.children.splice(index + 1, 0, ...children);

    children.forEach((child) => {
      this.#tom.registerNode(child);
    });
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

  private onChanged() {
    if (!this.#parent) {
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
      case ApiMessageEntityTypes.Code:
        return '````';
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
  #nodes: TelegramObjectModelNode<any>[] = [];

  #callbacks = new Set<VoidFunction>();

  #nodesById: Map<string, TelegramObjectModelNode<any>> = new Map();

  registerNode(node: TelegramObjectModelNode<any>) {
    this.#nodesById.set(node.id, node);
  }

  unregisterNode(node: TelegramObjectModelNode<any>) {
    this.#nodesById.delete(node.id);
  }

  makeNode<T extends AnyNode>(type: T['type'], attrs: Omit<T, 'id' | 'type' | 'children' | 'text'>)
    : TelegramObjectModelNode<T> {
    return new TelegramObjectModelNode(this, type, attrs);
  }

  unshiftNode(node: TelegramObjectModelNode<any>) {
    this.registerNode(node);
    this.#nodes.unshift(node);
  }

  pushNode(node: TelegramObjectModelNode<any>) {
    this.registerNode(node);
    this.#nodes.push(node);
  }

  getNodeById(id: string) {
    return this.#nodesById.get(id);
  }

  notifyChange(node: TelegramObjectModelNode<any>) {
    this.#callbacks.forEach((cb) => cb());
  }

  onChange(cb: VoidFunction) {
    this.#callbacks.add(cb);
    return () => this.#callbacks.delete(cb);
  }

  get children() {
    return this.#nodes;
  }

  private renderNode(node: TelegramObjectModelNode<any>): string {
    const args = `data-id="${node.id}" data-type="${node.type}"`;
    const innerHTML = node.children.map((child) => this.renderNode(child)).join('');

    // TODO add real state to DOM node instead of data attrs

    switch (node.type) {
      case 'text': return `<span ${args}>${node.text ?? ''}</span>`;
      case ApiMessageEntityTypes.Bold: return `<strong ${args}>${innerHTML}</strong>`;
      case ApiMessageEntityTypes.Italic: return `<i ${args}>${innerHTML}</i>`;
      case 'block': return `<div ${args} data-block>${innerHTML}</div>`;
      case ApiMessageEntityTypes.Code:
        return `<pre ${args} data-block class="${buildClassName(node.attrs.isStart && 'code-block-start')}">${innerHTML}</pre>`;
      case ApiMessageEntityTypes.Blockquote:
        return `<blockquote ${args} data-block>${innerHTML}</blockquote><br/>`;
      default: return innerHTML ?? '';
    }
  }

  get html(): string {
    return this.children.map((block) => {
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

      let apiType: ApiMessageEntity['type'];
      switch (node.type) {
        case ApiMessageEntityTypes.Bold:
          apiType = ApiMessageEntityTypes.Bold;
          break;
        case ApiMessageEntityTypes.Italic:
          apiType = ApiMessageEntityTypes.Italic;
          break;
        default:
          apiType = ApiMessageEntityTypes.Unknown;
      }

      const entity: ApiMessageEntity = {
        type: apiType,
        offset: start,
        length: blockText.length - start,
      };

      entities.push(entity);
    }

    for (let i = 0; i < this.children.length; i++) {
      const block = this.children[i];

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
      }

      text += blockText;

      if (i !== this.children.length - 1) {
        text += '\n';
      }
    }

    console.log(text, entities);

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
    this.#tom.pushNode(ctx.result);
  }

  private parseInline(ctx: InlineContext) {
    while (ctx.position < ctx.block.length) {
      const startPosition = ctx.position;

      this.parseEmphasis(ctx);
      this.parseItalic(ctx);

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

    const codeNode = this.#tom.makeNode(ApiMessageEntityTypes.Code, {
      isStart: isCorner && ctx.startedGroup?.[0] !== ApiMessageEntityTypes.Code,
      isEnd: isCorner && ctx.startedGroup?.[0] === ApiMessageEntityTypes.Code,
    });

    if (isCorner && ctx.startedGroup?.[0] === ApiMessageEntityTypes.Code) {
      ctx.startedGroup = undefined;
    } else if (isCorner) {
      ctx.startedGroup = [ApiMessageEntityTypes.Code, codeNode.id];
    }

    codeNode.pushNode(textNode);

    this.#tom.pushNode(codeNode);

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

    this.#tom.pushNode(quoteNode);

    return true;
  }

  private parseBase(ctx: InlineContext, astType: AnyNode['type'], marker: string) {
    if (ctx.usedMarkers.includes(marker)) return;
    if (astType === 'mention' || astType === 'link') return;

    const { block, position } = ctx;

    const markerChars = marker.split('');

    // todo check previous char
    const chars = [block[position - 1], block[position], block[position + 1]];

    if (chars[0] !== ' ' && position !== 0) {
      return;
    }

    if (chars[1] === markerChars[0] && chars[2] === markerChars[1]) {
      const last = block.indexOf(marker, position + 2);
      if (last === -1) return;
      const text = block.slice(position + 2, last);

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

  private parseItalic(ctx: InlineContext) {
    this.parseBase(ctx, ApiMessageEntityTypes.Bold, '__');
  }
}
