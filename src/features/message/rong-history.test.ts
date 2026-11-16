import { describe, expect, it, vi } from "vitest";

import type { RCIMIWEngine, RCIMIWMessage } from "@rongcloud/react-native-im-wrapper";

import { fetchRongHistoryMessages, type RongHistoryRequest } from "./rong-history";

vi.mock("@/core/logging/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

const REMOTE_POLICY = 3;
const LOCAL_REMOTE_POLICY = 7;

type PullResult = { messages?: RCIMIWMessage[]; errorCode?: number; submitCode?: number };

function createMessage(id: string, sentTime: number): RCIMIWMessage {
  return { messageUId: id, sentTime } as unknown as RCIMIWMessage;
}

function createEngine(byPolicy: Record<number, PullResult>) {
  const calls: { conversationType: number; targetId: string; sentTime: number; order: number; policy: number; count: number }[] = [];
  const engine = {
    getMessages(
      conversationType: number,
      targetId: string,
      channelId: string,
      sentTime: number,
      order: number,
      policy: number,
      count: number,
      callback: { onSuccess: (messages: RCIMIWMessage[]) => void; onError: (code: number) => void },
    ) {
      calls.push({ conversationType, targetId, sentTime, order, policy, count });
      const result = byPolicy[policy];
      if (result?.submitCode !== undefined) {
        return Promise.resolve(result.submitCode);
      }
      setTimeout(() => {
        if (result?.errorCode !== undefined) {
          callback.onError(result.errorCode);
          return;
        }
        callback.onSuccess(result?.messages ?? []);
      }, 0);
      return Promise.resolve(0);
    },
  } as unknown as Pick<RCIMIWEngine, "getMessages">;
  return { engine, calls };
}

function createRequest(overrides: Partial<RongHistoryRequest> = {}): RongHistoryRequest {
  return {
    conversationType: 1,
    targetId: "50100114",
    sentTime: 0,
    order: 0,
    count: 20,
    remotePolicy: REMOTE_POLICY as RongHistoryRequest["remotePolicy"],
    localPolicy: LOCAL_REMOTE_POLICY as RongHistoryRequest["localPolicy"],
    ...overrides,
  };
}

describe("fetchRongHistoryMessages", () => {
  it.each([false, true])("云端不返回时能回落本地，本地也卡住=%s 时能结束加载", async (localStalls) => {
    vi.useFakeTimers();
    try {
      const local = [createMessage("cached", 1)];
      const engine = { getMessages: vi.fn((_type, _id, _channel, _time, _order, policy, _count, callback) => {
        if (policy === LOCAL_REMOTE_POLICY && !localStalls) { callback?.onSuccess?.(local); }
        return Promise.resolve(0);
      }) } satisfies Pick<RCIMIWEngine, "getMessages">;
      let result: RCIMIWMessage[] | undefined;
      const pending = fetchRongHistoryMessages(engine, createRequest()).then((value) => { result = value; });
      await vi.advanceTimersByTimeAsync(30_001);
      expect(result).toEqual(localStalls ? [] : local);
      await pending;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it("远端有消息时直接返回远端结果，不再查本地", async () => {
    const remoteMessages = [createMessage("m1", 200), createMessage("m2", 100)];
    const { engine, calls } = createEngine({ [REMOTE_POLICY]: { messages: remoteMessages } });

    const result = await fetchRongHistoryMessages(engine, createRequest());

    expect(result).toEqual(remoteMessages);
    expect(calls).toHaveLength(1);
    expect(calls[0].policy).toBe(REMOTE_POLICY);
  });

  it("远端为空时回退本地库并返回本地消息", async () => {
    const localMessages = [createMessage("local-1", 300)];
    const { engine, calls } = createEngine({
      [REMOTE_POLICY]: { messages: [] },
      [LOCAL_REMOTE_POLICY]: { messages: localMessages },
    });

    const result = await fetchRongHistoryMessages(engine, createRequest());

    expect(result).toEqual(localMessages);
    expect(calls).toHaveLength(2);
    expect(calls[1].policy).toBe(LOCAL_REMOTE_POLICY);
  });

  it("远端回调报错（如 30001 通道未就绪）时回退本地库", async () => {
    const localMessages = [createMessage("local-1", 300)];
    const { engine, calls } = createEngine({
      [REMOTE_POLICY]: { errorCode: 30001 },
      [LOCAL_REMOTE_POLICY]: { messages: localMessages },
    });

    const result = await fetchRongHistoryMessages(engine, createRequest());

    expect(result).toEqual(localMessages);
    expect(calls).toHaveLength(2);
  });

  it("远端提交失败（ret 非 0）时回退本地库", async () => {
    const localMessages = [createMessage("local-1", 300)];
    const { engine, calls } = createEngine({
      [REMOTE_POLICY]: { submitCode: -101 },
      [LOCAL_REMOTE_POLICY]: { messages: localMessages },
    });

    const result = await fetchRongHistoryMessages(engine, createRequest());

    expect(result).toEqual(localMessages);
    expect(calls).toHaveLength(2);
  });

  it("远端与本地都为空时返回空数组而非 null", async () => {
    const { engine, calls } = createEngine({
      [REMOTE_POLICY]: { messages: [] },
      [LOCAL_REMOTE_POLICY]: { messages: [] },
    });

    const result = await fetchRongHistoryMessages(engine, createRequest());

    expect(result).toEqual([]);
    expect(calls).toHaveLength(2);
  });

  it("按请求参数原样透传给 SDK", async () => {
    const { engine, calls } = createEngine({ [REMOTE_POLICY]: { messages: [createMessage("m1", 1)] } });
    const request = createRequest({
      conversationType: 9 as RongHistoryRequest["conversationType"],
      targetId: "rc_p_50000000",
      sentTime: 1793344030139,
      order: 5 as RongHistoryRequest["order"],
      count: 20,
    });

    await fetchRongHistoryMessages(engine, request);

    expect(calls[0]).toEqual({ conversationType: 9, targetId: "rc_p_50000000", sentTime: 1793344030139, order: 5, policy: REMOTE_POLICY, count: 20 });
  });
});
