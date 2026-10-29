import { describe, expect, it } from "vitest";

import { parseMarkdown, parseMarkdownInline } from "./markdown";

describe("parseMarkdownInline", () => {
  it("parses bold, italic, strike and code spans with plain text in between", () => {
    expect(parseMarkdownInline("加粗**重要**斜体*注意*删除~~废弃~~代码`QM123`")).toEqual([
      { text: "加粗" },
      { text: "重要", bold: true },
      { text: "斜体" },
      { text: "注意", italic: true },
      { text: "删除" },
      { text: "废弃", strike: true },
      { text: "代码" },
      { text: "QM123", code: true },
    ]);
  });

  it("returns the raw text when no markers are present", () => {
    expect(parseMarkdownInline("普通通知内容")).toEqual([{ text: "普通通知内容" }]);
  });
});

describe("parseMarkdown", () => {
  it("parses the quick match cancellation notice into heading and paragraphs", () => {
    const content = "### 快速匹配取消通知\n\n您发起的快速匹配，因30分钟未确认自动取消。\n\n开始匹配单号: QM2114996677449506818\n时间: 2026-10-27 16:54:37";
    expect(parseMarkdown(content)).toEqual([
      { type: "heading", level: 3, inlines: [{ text: "快速匹配取消通知" }] },
      { type: "paragraph", inlines: [{ text: "您发起的快速匹配，因30分钟未确认自动取消。" }] },
      {
        type: "paragraph",
        inlines: [{ text: "开始匹配单号: QM2114996677449506818\n时间: 2026-10-27 16:54:37" }],
      },
    ]);
  });

  it("groups consecutive bullet lines into one unordered list", () => {
    expect(parseMarkdown("- 第一条\n- 第二条\n* 第三条")).toEqual([
      {
        type: "list",
        ordered: false,
        items: [
          { marker: "•", inlines: [{ text: "第一条" }] },
          { marker: "•", inlines: [{ text: "第二条" }] },
          { marker: "•", inlines: [{ text: "第三条" }] },
        ],
      },
    ]);
  });

  it("groups numbered lines into one ordered list keeping the numbers", () => {
    expect(parseMarkdown("1. 第一步\n2. 第二步")).toEqual([
      {
        type: "list",
        ordered: true,
        items: [
          { marker: "1.", inlines: [{ text: "第一步" }] },
          { marker: "2.", inlines: [{ text: "第二步" }] },
        ],
      },
    ]);
  });

  it("folds quoted lines into a paragraph without the marker", () => {
    expect(parseMarkdown("> 引用第一行\n> 引用第二行")).toEqual([
      { type: "paragraph", inlines: [{ text: "引用第一行\n引用第二行" }] },
    ]);
  });

  it("returns an empty block list for blank content", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("\n\n")).toEqual([]);
  });

  it("keeps heading levels between 1 and 6", () => {
    const blocks = parseMarkdown("## 标题二\n###### 标题六");
    expect(blocks).toEqual([
      { type: "heading", level: 2, inlines: [{ text: "标题二" }] },
      { type: "heading", level: 6, inlines: [{ text: "标题六" }] },
    ]);
  });
});
