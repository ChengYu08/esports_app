import { beforeEach, expect, it } from "vitest";
import {
  beginMediaPick,
  completeMediaPick,
  isMediaPickActive,
} from "./media-picker-session";

beforeEach(() => {
  // 清理上一个用例遗留的 pending 会话
  if (isMediaPickActive()) {
    completeMediaPick(null);
  }
});

it("回传选择结果并终结会话", async () => {
  const pending = beginMediaPick();
  expect(isMediaPickActive()).toBe(true);
  completeMediaPick(["file://picked.jpg"]);
  await expect(pending).resolves.toEqual(["file://picked.jpg"]);
  expect(isMediaPickActive()).toBe(false);
});

it("取消时回传 null", async () => {
  const pending = beginMediaPick();
  completeMediaPick(null);
  await expect(pending).resolves.toBeNull();
  expect(isMediaPickActive()).toBe(false);
});

it("未 begin 时 complete 为 no-op", () => {
  expect(() => completeMediaPick(["file://x"])).not.toThrow();
  expect(isMediaPickActive()).toBe(false);
});

it("并发 begin 时旧会话以 null 终结，新会话正常回传", async () => {
  const first = beginMediaPick();
  const second = beginMediaPick();
  completeMediaPick(["file://second.jpg"]);
  await expect(first).resolves.toBeNull();
  await expect(second).resolves.toEqual(["file://second.jpg"]);
});
