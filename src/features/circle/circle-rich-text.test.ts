import { describe, expect, it } from "vitest";

import { splitCircleRichText } from "@/features/circle/circle-rich-text";

describe("splitCircleRichText", () => {
  it("无引用时返回纯文本", () => {
    expect(splitCircleRichText("大家好")).toEqual([{ text: "大家好" }]);
  });

  it("仅话题时沿用话题切分", () => {
    expect(splitCircleRichText("看看#五杀时刻！")).toEqual([
      { text: "看看" },
      { text: "#五杀时刻", topic: "五杀时刻" },
      { text: "！" },
    ]);
  });

  it("带位置的 @用户 优先渲染为可点击", () => {
    const segments = splitCircleRichText("@张三 你好", [
      { id: "1001", label: "张三", offset: 0, length: 3 },
    ]);
    expect(segments).toEqual([
      { text: "@张三", userId: "1001" },
      { text: " 你好" },
    ]);
  });

  it("无位置时按昵称字典推导 @用户", () => {
    const segments = splitCircleRichText("@张三 @李四来啦", { 1001: "张三", 1002: "李四" });
    expect(segments).toEqual([
      { text: "@张三", userId: "1001" },
      { text: " " },
      { text: "@李四", userId: "1002" },
      { text: "来啦" },
    ]);
  });

  it("位置错位的实体回退昵称字典推导，多出的尾巴降级为纯文本", () => {
    expect(splitCircleRichText("@张三x", [{ id: "1", label: "张三", offset: 0, length: 4 }])).toEqual([
      { text: "@张三", userId: "1" },
      { text: "x" },
    ]);
  });

  it("昵称未真实出现在 @ 之后时渲染纯文本", () => {
    expect(splitCircleRichText("@王五 你好", [{ id: "1", label: "张三", offset: 0, length: 3 }])).toEqual([
      { text: "@王五 你好" },
    ]);
  });

  it("@用户 与话题重叠时 @用户 优先", () => {
    const segments = splitCircleRichText("@#话题", [
      { id: "1001", label: "#话题", offset: 0, length: 4 },
    ]);
    expect(segments).toEqual([{ text: "@#话题", userId: "1001" }]);
  });

  it("emoji 前后 @用户 按码点偏移不串位", () => {
    const segments = splitCircleRichText("😀@张三", [
      { id: "1001", label: "张三", offset: 2, length: 3 },
    ]);
    expect(segments).toEqual([
      { text: "😀" },
      { text: "@张三", userId: "1001" },
    ]);
  });

  it("输入草稿高亮未选中的 @用户，但展示正文不把它当成链接", () => {
    const content = "找 @张三 和 #五杀";
    expect(splitCircleRichText(content)).toEqual([
      { text: "找 @张三 和 " },
      { text: "#五杀", topic: "五杀" },
    ]);
    expect(splitCircleRichText(content, undefined, true)).toEqual([
      { text: "找 " },
      { text: "@张三", unresolvedMention: true },
      { text: " 和 " },
      { text: "#五杀", topic: "五杀" },
    ]);
  });
});
