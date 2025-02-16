/* eslint-disable max-classes-per-file */
import { generateRandomInt } from '../api/gramjs/gramjsBuilders';

interface InlineContext {
  position: number;
  block: string;
  result: TelegramObjectModelNode;
  // todo
  usedMarkers: string[];
}

interface BlockContext {
  startedGroup?: 'code';
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
  type: 'code';
}

interface TextMessageNode extends MessageNode {
  type: 'text';
}

interface BoldMessageNode extends MessageNode {
  type: 'bold';
}

interface ItalicMessageNode extends MessageNode {
  type: 'italic';
}

interface UnderlineMessageNode extends MessageNode {
  type: 'underline';
}

interface StrikethroughMessageNode extends MessageNode {
  type: 'strikethrough';
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
CodeBlockMessageNode;

class TelegramObjectModelNode {
  #id = generateRandomInt().toString();

  #type: string;

  #tom: TelegramObjectModel;

  #text: string = '';

  #parent: TelegramObjectModelNode | undefined = undefined;

  #children: TelegramObjectModelNode[];

  constructor(tom: TelegramObjectModel, type: string) {
    this.#tom = tom;
    this.#type = type;
    this.#children = [];
  }

  unshiftNode(node: TelegramObjectModelNode) {
    node.#parent = this;
    this.#children.unshift(node);
    this.#tom.registerNode(node);
  }

  pushNode(node: TelegramObjectModelNode) {
    node.#parent = this;
    this.#children.push(node);
    this.#tom.registerNode(node);
  }

  remove() {
    this.#children.forEach((child) => child.remove());
    this.#children = [];

    this.#parent?.removeChild(this);
  }

  removeChild(child: TelegramObjectModelNode) {
    const index = this.#children.indexOf(child);

    if (index === -1) return;

    this.#children.splice(index, 1);
    this.#tom.unregisterNode(child);
  }

  get marker() {
    switch (this.#type) {
      case 'bold':
        return '**';
      case 'italic':
        return '__';
      case 'code':
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

  get children() {
    return this.#children;
  }

  get text() {
    return this.#text;
  }

  set text(value: string) {
    if (this.#type !== 'text') throw new Error('Cannot set text on non-text node');

    this.#text = value;
  }

  get parent() {
    return this.#parent;
  }

  get nextSibling(): TelegramObjectModelNode | undefined {
    if (!this.#parent) return undefined;

    const index = this.#parent.children.indexOf(this);

    return this.#parent.children[index + 1];
  }

  get previousSibling(): TelegramObjectModelNode | undefined {
    if (!this.#parent) return undefined;

    const index = this.#parent.children.indexOf(this);

    return this.#parent.children[index - 1];
  }
}

export class TelegramObjectModel {
  #nodes: TelegramObjectModelNode[][] = [[]];

  #nodesById: Map<string, TelegramObjectModelNode> = new Map();

  registerNode(node: TelegramObjectModelNode) {
    this.#nodesById.set(node.id, node);
  }

  unregisterNode(node: TelegramObjectModelNode) {
    this.#nodesById.delete(node.id);
  }

  makeNode(type: AnyNode['type']) {
    return new TelegramObjectModelNode(this, type);
  }

  unshiftNode(node: TelegramObjectModelNode) {
    this.registerNode(node);
    this.#nodes[0].unshift(node);
  }

  pushNode(node: TelegramObjectModelNode) {
    console.trace('push', node, node.type);
    this.registerNode(node);
    this.#nodes[0].push(node);
  }

  getNodeById(id: string) {
    return this.#nodesById.get(id);
  }

  get children() {
    return this.#nodes;
  }

  private renderNode(node: TelegramObjectModelNode): string {
    const args = `data-id="${node.id}" data-type="${node.type}"`;
    const innerHTML = node.children.map((child) => this.renderNode(child)).join('');

    // TODO add real state to DOM node instead of data attrs

    switch (node.type) {
      case 'text': return `<span ${args}>${node.text ?? ''}</span>`;
      case 'bold': return `<strong ${args}>${innerHTML}</strong>`;
      case 'italic': return `<i ${args}>${innerHTML}</i>`;
      case 'block': return `<div ${args} data-block>${innerHTML}</div>`;
      case 'code': return `<pre ${args} data-block>${innerHTML}</pre>`;
      default: return innerHTML ?? '';
    }
  }

  get html(): string {
    return this.children.map((block) => {
      return block.map((node) => this.renderNode(node)).join('');
    }).join('');
  }
}

export class MarkdownParser {
  #tom = new TelegramObjectModel();

  parse(text: string): TelegramObjectModel {
    const blocks = text.split('\n');

    let startedGroup: BlockContext['startedGroup'];

    for (let i = 0; i < blocks.length; i++) {
      const blockText = blocks[i];

      // Force convert inline Markdown to block
      const codeBlockStart = blockText.indexOf('```');
      if (codeBlockStart !== -1) {
        const codeBlockEnd = blockText.indexOf('```', codeBlockStart + 3);

        if (codeBlockEnd !== -1) {
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

    const ctx: InlineContext = {
      position: 0,
      block,
      result: this.#tom.makeNode('block'),
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
          const node = this.#tom.makeNode('text');
          node.text = char;

          ctx.result.pushNode(node);
        }

        ctx.position += 1;
      }
    }
  }

  private parseCode(ctx: BlockContext, block: string) {
    const isCorner = block.startsWith('```');
    if (!block.startsWith('```') && ctx.startedGroup !== 'code') {
      return false;
    }

    if (isCorner) {
      if (ctx.startedGroup === 'code') {
        ctx.startedGroup = undefined;
      } else {
        ctx.startedGroup = 'code';
      }
    }

    const codeNode = this.#tom.makeNode('code');
    const textNode = this.#tom.makeNode('text');

    textNode.text = block.replace(/^```/, '').replace(/```$/, '');

    codeNode.children.push(textNode);

    this.#tom.pushNode(codeNode);

    return true;
  }

  private parseBase(ctx: InlineContext, astType: AnyNode['type'], marker: string) {
    if (ctx.usedMarkers.includes(marker)) return;
    if (astType === 'mention' || astType === 'link') return;

    const { block, position } = ctx;

    const markerChars = marker.split('');

    // todo check previous char
    const chars = [block[position - 1], block[position], block[position + 1]];

    if (chars[0] !== ' ') {
      return;
    }

    if (chars[1] === markerChars[0] && chars[2] === markerChars[1]) {
      const last = block.indexOf(marker, position + 2);
      if (last === -1) return;
      const text = block.slice(position + 2, last);

      const childNode = this.#tom.makeNode(astType);

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
    this.parseBase(ctx, 'bold', '**');
  }

  private parseItalic(ctx: InlineContext) {
    this.parseBase(ctx, 'italic', '__');
  }
}
