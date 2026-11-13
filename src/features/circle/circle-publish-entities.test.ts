import { describe, expect, it } from "vitest";

import {
  activeTriggerDraft,
  applyCircleRefSelection,
  applyTriggerSelection,
  buildCircleContentRefs,
  shiftCircleContentRefs,
  sliceByCodePoints,
} from "@/features/circle/circle-publish-entities";

describe("buildCircleContentRefs", () => {
  it("码点偏移：emoji 之后的话题不错位", () => {
    const content = "🎉今天打游戏 #电竞日常";
    const refs = buildCircleContentRefs(content, [{ id: "7", label: "电竞日常" }], "#");
    expect(refs).toEqual([{ id: "7", label: "电竞日常", offset: 7, length: 5 }]);
    expect(sliceByCodePoints(content, refs[0].offset, refs[0].length)).toBe("#电竞日常");
  });

  it("正文未出现的选中项被降级（不产出实体）", () => {
    const refs = buildCircleContentRefs("普通正文", [{ id: "7", label: "电竞日常" }], "#");
    expect(refs).toEqual([]);
  });

  it("同一项多次出现各成一个实体，按 offset 升序", () => {
    const refs = buildCircleContentRefs(
      "#游戏 真好玩 #游戏",
      [{ id: "1", label: "游戏" }],
      "#",
    );
    expect(refs.map((ref) => ref.offset)).toEqual([0, 8]);
    expect(refs.every((ref) => ref.length === 3)).toBe(true);
  });

  it("@用户实体含触发符长度", () => {
    const refs = buildCircleContentRefs(
      "呼叫 @张三 一下",
      [{ id: "u1", label: "张三" }],
      "@",
    );
    expect(refs).toEqual([{ id: "u1", label: "张三", offset: 3, length: 3 }]);
  });
});

describe("activeTriggerDraft", () => {
  it("识别结尾的话题草稿", () => {
    expect(activeTriggerDraft("来一局 #电竞")).toEqual({ trigger: "#", keyword: "电竞" });
  });

  it("识别结尾的 @ 草稿与空关键词", () => {
    expect(activeTriggerDraft("呼叫 @")).toEqual({ trigger: "@", keyword: "" });
  });

  it("无草稿返回 null", () => {
    expect(activeTriggerDraft("普通正文 #已完成 话题")).toBeNull();
  });
});

describe("applyTriggerSelection", () => {
  it("替换结尾草稿为完整实体并补空格", () => {
    expect(applyTriggerSelection("来一局 #电竞", "#", "电竞日常")).toBe("来一局 #电竞日常 ");
  });

  it("结尾无草稿时追加", () => {
    expect(applyTriggerSelection("正文", "#", "话题")).toBe("正文#话题 ");
  });

  it("结尾已有触发符时不重复", () => {
    expect(applyTriggerSelection("正文#", "#", "话题")).toBe("正文#话题 ");
  });

  it("评论中的 @ 草稿选中用户后不会留下旧关键词", () => {
    expect(applyTriggerSelection("找 @张", "@", "张三")).toBe("找 @张三 ");
  });
});

describe("选中的 @用户 引用", () => {
  it("同名用户保留各自 ID，手打的重复昵称不增加引用", () => {
    const first = applyCircleRefSelection("", "@", { id: "1", label: "张三" });
    const second = applyCircleRefSelection(first.content, "@", { id: "2", label: "张三" });
    expect([first.ref, second.ref]).toEqual([
      { id: "1", label: "张三", offset: 0, length: 3 },
      { id: "2", label: "张三", offset: 4, length: 3 },
    ]);
    expect(shiftCircleContentRefs(second.content, `${second.content}@张三`, [first.ref, second.ref], "@"))
      .toEqual([first.ref, second.ref]);
  });

  it("前方编辑会移动引用，编辑引用本身会取消关联", () => {
    const selected = applyCircleRefSelection("😀", "@", { id: "1", label: "张三" });
    const shifted = shiftCircleContentRefs(selected.content, `你好${selected.content}`, [selected.ref], "@");
    expect(shifted).toEqual([{ ...selected.ref, offset: 3 }]);
    expect(shiftCircleContentRefs(`你好${selected.content}`, "你好😀@李四 ", shifted, "@"))
      .toEqual([]);
  });

  it("同一位置重新选择用户时旧引用失效", () => {
    const first = applyCircleRefSelection("", "@", { id: "1", label: "张三" });
    const withoutSpace = first.content.trimEnd();
    const kept = shiftCircleContentRefs(first.content, withoutSpace, [first.ref], "@");
    const second = applyCircleRefSelection(withoutSpace, "@", { id: "2", label: "李四" });
    expect(shiftCircleContentRefs(withoutSpace, second.content, kept, "@"))
      .toEqual([]);
    expect(second.ref.id).toBe("2");
  });

  it("评论提交时去掉前后空格仍保持码点位置", () => {
    const selected = applyCircleRefSelection("  ", "@", { id: "1", label: "张三" });
    const withoutLeading = selected.content.trimStart();
    const leadingAdjusted = shiftCircleContentRefs(selected.content, withoutLeading, [selected.ref], "@");
    expect(shiftCircleContentRefs(withoutLeading, withoutLeading.trim(), leadingAdjusted, "@"))
      .toEqual([{ ...selected.ref, offset: 0 }]);
  });
});
