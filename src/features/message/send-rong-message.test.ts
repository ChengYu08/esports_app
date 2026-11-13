import type { RCIMIWEngine, RCIMIWMessage } from "@rongcloud/react-native-im-wrapper";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendRongMessage } from "./send-rong-message";

const message = { messageId: 1 } as RCIMIWMessage;
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("融云发送异常不会无限等待", () => {
  it.each(["立即错误码", "原生拒绝", "同步抛错", "回调失败"])("%s 能传回 UI 并清理定时器", async (mode) => {
    const sendMessage = vi.fn((_message, callbacks) => {
      if (mode === "立即错误码") { return Promise.resolve(1); }
      if (mode === "原生拒绝") { return Promise.reject(new Error("网络错误")); }
      if (mode === "同步抛错") { throw new Error("原生错误"); }
      callbacks.onMessageSent(2);
      return Promise.resolve(0);
    });
    await expect(sendRongMessage({ sendMessage }, message)).rejects.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["已受理无回调", "原生调用不返回"])("%s 在 30 秒结束等待，迟到结果不再改变状态", async (mode) => {
    let callbacks!: Parameters<RCIMIWEngine["sendMessage"]>[1];
    const sendMessage = vi.fn((_message, next) => {
      callbacks = next;
      return mode === "已受理无回调" ? Promise.resolve(0) : new Promise<number>(() => {});
    });
    let failure: Error | undefined;
    const result = sendRongMessage({ sendMessage }, message).catch((error) => { failure = error; });
    await vi.advanceTimersByTimeAsync(30_001);
    expect(failure?.message).toContain("发送超时");
    callbacks?.onMessageSent?.(0, message);
    await result;
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("成功只返回一次且立即清理超时", async () => {
    const sendMessage = vi.fn((_message, callbacks) => {
      callbacks.onMessageSent(0, message);
      callbacks.onMessageSent(1);
      return Promise.resolve(0);
    });
    await expect(sendRongMessage({ sendMessage }, message)).resolves.toBe(message);
    expect(vi.getTimerCount()).toBe(0);
  });
});
