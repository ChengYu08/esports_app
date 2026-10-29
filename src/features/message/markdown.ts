/**
 * 系统通知 markdown 的轻量子集解析。
 *
 * Web 端（pzdj-pc）用 marked 渲染平台通知；移动端为控制包体积，
 * 只解析后端通知实际用到的语法：标题、有序/无序列表、加粗、斜体、
 * 删除线、行内代码与段落，纯文本是 markdown 子集因此天然兼容。
 */

export type MarkdownInline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
};

export type MarkdownBlock =
  | { type: "heading"; level: number; inlines: MarkdownInline[] }
  | { type: "paragraph"; inlines: MarkdownInline[] }
  | { type: "list"; ordered: boolean; items: { marker: string; inlines: MarkdownInline[] }[] };

const INLINE_PATTERN = /(\*\*([^*]+)\*\*)|(\*([^*\n]+)\*)|(~~([^~]+)~~)|(`([^`\n]+)`)/g;

export function parseMarkdownInline(text: string): MarkdownInline[] {
  const inlines: MarkdownInline[] = [];
  let cursor = 0;
  INLINE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) {
      inlines.push({ text: text.slice(cursor, match.index) });
    }
    if (match[2] != null) inlines.push({ text: match[2], bold: true });
    else if (match[4] != null) inlines.push({ text: match[4], italic: true });
    else if (match[6] != null) inlines.push({ text: match[6], strike: true });
    else if (match[8] != null) inlines.push({ text: match[8], code: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) inlines.push({ text: text.slice(cursor) });
  return inlines;
}

function pushParagraph(blocks: MarkdownBlock[], lines: string[]) {
  if (lines.length === 0) return;
  blocks.push({ type: "paragraph", inlines: parseMarkdownInline(lines.join("\n")) });
}

function pushList(blocks: MarkdownBlock[], ordered: boolean, items: { marker: string; inlines: MarkdownInline[] }[]) {
  if (items.length === 0) return;
  blocks.push({ type: "list", ordered, items });
}

export function parseMarkdown(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const paragraphLines: string[] = [];
  let listOrdered = false;
  let listItems: { marker: string; inlines: MarkdownInline[] }[] = [];

  const flushParagraph = () => {
    pushParagraph(blocks, paragraphLines);
    paragraphLines.length = 0;
  };
  const flushList = () => {
    pushList(blocks, listOrdered, listItems);
    listItems = [];
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: heading[1].length, inlines: parseMarkdownInline(heading[2].trim()) });
      continue;
    }
    const bullet = line.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (listOrdered) flushList();
      listOrdered = false;
      listItems.push({ marker: "•", inlines: parseMarkdownInline(bullet[1]) });
      continue;
    }
    const orderedItem = line.match(/^(\d+)[.、)]\s+(.*)$/);
    if (orderedItem) {
      flushParagraph();
      if (!listOrdered) flushList();
      listOrdered = true;
      listItems.push({ marker: `${orderedItem[1]}.`, inlines: parseMarkdownInline(orderedItem[2]) });
      continue;
    }
    // 引用块按普通段落折叠，仅去掉引用前缀。
    const quoted = line.match(/^>\s?(.*)$/);
    if (quoted) {
      flushList();
      paragraphLines.push(quoted[1]);
      continue;
    }
    flushList();
    paragraphLines.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}
