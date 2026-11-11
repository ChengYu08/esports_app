import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACTION_NOTICE_MAX_ITEMS,
  actionNotice,
  resetActionNoticeStore,
  useActionNoticeStore,
  type ActionNoticeItem,
} from "./action-notice-store";

function item(id: string, text = id): ActionNoticeItem {
  return {
    id,
    text,
    actionText: "去抢单",
    icon: 1,
    expireAt: Date.now() + 30_000,
    maxDurationMs: 30_000,
  };
}

describe("actionNotice store", () => {
  beforeEach(() => {
    resetActionNoticeStore();
  });

  it("push 追加，dismiss 按 id 移除并触发 onDisappear", () => {
    const onDisappear = vi.fn();
    actionNotice.push(item("a"), { onAction: vi.fn(), onDisappear });
    actionNotice.push(item("b"), { onAction: vi.fn() });
    expect(useActionNoticeStore.getState().items.map((entry) => entry.id)).toEqual([
      "a",
      "b",
    ]);

    actionNotice.dismiss("a");
    expect(onDisappear).toHaveBeenCalledTimes(1);
    expect(useActionNoticeStore.getState().items.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("同 id 再 push 原地更新不增条", () => {
    actionNotice.push(item("a", "旧"), { onAction: vi.fn() });
    actionNotice.push(item("a", "新"), { onAction: vi.fn() });
    const items = useActionNoticeStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]?.text).toBe("新");
  });

  it("超上限挤掉最旧并触发其 onDisappear", () => {
    const onDisappearFirst = vi.fn();
    actionNotice.push(item("0"), { onAction: vi.fn(), onDisappear: onDisappearFirst });
    for (let i = 1; i <= ACTION_NOTICE_MAX_ITEMS; i += 1) {
      actionNotice.push(item(String(i)), { onAction: vi.fn() });
    }
    expect(useActionNoticeStore.getState().items).toHaveLength(ACTION_NOTICE_MAX_ITEMS);
    expect(useActionNoticeStore.getState().items[0]?.id).toBe("1");
    expect(onDisappearFirst).toHaveBeenCalledTimes(1);
  });

  it("clear 逐条 onDisappear 后清空", () => {
    const a = vi.fn();
    const b = vi.fn();
    actionNotice.push(item("a"), { onAction: vi.fn(), onDisappear: a });
    actionNotice.push(item("b"), { onAction: vi.fn(), onDisappear: b });
    actionNotice.clear();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(useActionNoticeStore.getState().items).toEqual([]);
  });

  it("dismiss 不存在的 id 为 no-op", () => {
    actionNotice.push(item("a"), { onAction: vi.fn() });
    actionNotice.dismiss("missing");
    expect(useActionNoticeStore.getState().items).toHaveLength(1);
  });

  it("dismissByPrefix 撤掉前缀匹配的全部条并触发 onDisappear", () => {
    const onA1 = vi.fn();
    const onA2 = vi.fn();
    const onB = vi.fn();
    actionNotice.push(item("qm:QM1:1"), { onAction: vi.fn(), onDisappear: onA1 });
    actionNotice.push(item("qm:QM1:2"), { onAction: vi.fn(), onDisappear: onA2 });
    actionNotice.push(item("qm:QM2:1"), { onAction: vi.fn(), onDisappear: onB });

    actionNotice.dismissByPrefix("qm:QM1:");
    expect(onA1).toHaveBeenCalledTimes(1);
    expect(onA2).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
    expect(useActionNoticeStore.getState().items.map((entry) => entry.id)).toEqual([
      "qm:QM2:1",
    ]);
  });

  it("dismissByPrefix 无匹配为 no-op", () => {
    actionNotice.push(item("qm:QM1:1"), { onAction: vi.fn() });
    actionNotice.dismissByPrefix("qm:QM9:");
    expect(useActionNoticeStore.getState().items).toHaveLength(1);
  });
});
