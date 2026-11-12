import { createRequire } from "node:module";
import { createElement, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useQuickMatchSession } from "./use-quick-match-session";

const mocks = vi.hoisted(() => ({
  focused: true,
  detail: vi.fn(),
  list: vi.fn(),
}));
vi.mock("expo-router", () => ({
  router: {},
  useFocusEffect: (callback: () => void | (() => void)) => {
    const focused = mocks.focused;
    useEffect(() => {
      if (focused) {
        return callback();
      }
    }, [callback, focused]);
  },
}));
vi.mock("@esports/auth", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ accessToken: "token", user: { id: "1" } }),
}));
vi.mock("@/features/match/api/match.api", () => ({
  fetchQuickMatchDetail: mocks.detail,
  fetchQuickMatchGrabList: mocks.list,
}));
vi.mock("@/features/match/hooks/use-match-form", () => ({ quickMatchGamesQueryKey: vi.fn() }));
vi.mock("@/features/voice-room/exit-voice-room", () => ({ exitVoiceRoom: vi.fn() }));
vi.mock("@/features/voice-room/voice-room.api", () => ({ resolveVoiceRoomId: vi.fn() }));
vi.mock("@/features/voice-room/voice-room-session", () => ({ useVoiceRoomSessionStore: { getState: () => ({ activeRoom: null }) } }));
vi.mock("@/shared/ui/app-toast", () => ({ showToast: vi.fn() }));

const { act, create } = createRequire(import.meta.url)("react-test-renderer") as typeof import("react-test-renderer");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReturnType<typeof create> | undefined;
let session: ReturnType<typeof useQuickMatchSession>;

function Harness() {
  const currentSession = useQuickMatchSession("QM1");
  useEffect(() => {
    session = currentSession;
  }, [currentSession]);
  return null;
}

describe("选人页名单轮询的焦点生命周期", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.focused = true;
    mocks.detail.mockReset().mockResolvedValue({ requestNo: "QM1", status: "MATCHING" });
    mocks.list.mockReset().mockResolvedValue([]);
  });

  afterEach(async () => {
    await act(async () => { renderer?.unmount(); });
    vi.useRealTimers();
  });

  it("进入立即更新，停留时每4秒更新，离开暂停，返回立即更新", async () => {
    await act(async () => { renderer = create(createElement(Harness)); });
    expect(mocks.list).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(mocks.list).toHaveBeenCalledTimes(2);

    mocks.focused = false;
    await act(async () => { renderer?.update(createElement(Harness)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(mocks.list).toHaveBeenCalledTimes(2);

    mocks.focused = true;
    await act(async () => { renderer?.update(createElement(Harness)); });
    expect(mocks.list).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(mocks.list).toHaveBeenCalledTimes(4);
  });

  it("已建单后返回也不恢复选人轮询", async () => {
    await act(async () => { renderer = create(createElement(Harness)); });
    await act(async () => { session.setOrderPending(true); });
    mocks.focused = false;
    await act(async () => { renderer?.update(createElement(Harness)); });
    mocks.focused = true;
    await act(async () => { renderer?.update(createElement(Harness)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });
});
