import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppConfirm } from "@/shared/ui/app-confirm";

const mocks = vi.hoisted(() => ({
  authState: {
    accessToken: "token" as string | null,
    user: { id: "user-1" },
  },
  detail: null as Record<string, unknown> | null,
  grabResult: null as Record<string, unknown> | null,
  grabError: null as Error | null,
  roomDetail: null as Record<string, unknown> | null,
  joinedRoom: null as Record<string, unknown> | null,
  joinedRoomAfterExit: null as Record<string, unknown> | null,
  exitCount: 0,
  activeMatch: null as Record<string, unknown> | null,
}));

vi.mock("@esports/auth", () => ({
  useAuthStore: { getState: () => mocks.authState },
}));

vi.mock("expo-router", () => ({
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("react-native-root-toast", () => ({
  default: {
    show: vi.fn(),
    durations: { SHORT: 2000, LONG: 3500 },
    positions: { CENTER: 0 },
  },
}));

vi.mock("@/features/order/dispatch.api", () => ({
  fetchDispatchDetail: vi.fn(async () => {
    if (!mocks.detail) throw new Error("详情不存在");
    return mocks.detail;
  }),
  grabDispatchRequest: vi.fn(async () => {
    if (mocks.grabError) throw mocks.grabError;
    if (!mocks.grabResult) throw new Error("抢单失败");
    return mocks.grabResult;
  }),
}));

vi.mock("@/features/match/api/match.api", () => ({
  fetchActiveQuickMatch: vi.fn(async () => mocks.activeMatch),
}));

vi.mock("@/features/voice-room/voice-room.api", () => ({
  resolveVoiceRoomId: (value: unknown) => {
    if (!value || typeof value !== "object") return null;
    const room = value as Record<string, unknown>;
    const id = room.id ?? room.roomId ?? room.voiceRoomId;
    return id == null ? null : String(id);
  },
  voiceRoomApi: {
    getDetail: vi.fn(async () => mocks.roomDetail),
    getJoinedRoom: vi.fn(async () =>
      mocks.exitCount > 0 ? mocks.joinedRoomAfterExit : mocks.joinedRoom),
  },
}));

vi.mock("@/features/order/order-query", () => ({
  refreshDispatchAfterGrabAttempt: vi.fn(),
  refreshDispatchDetail: vi.fn(),
}));

vi.mock("@/shared/ui/action-notice/action-notice-store", () => ({
  actionNotice: { dismiss: vi.fn() },
}));

vi.mock("@/features/voice-room/exit-voice-room", () => ({
  exitVoiceRoom: vi.fn(async () => {
    mocks.exitCount += 1;
  }),
}));

vi.mock("@/features/voice-room/voice-room-session", () => ({
  useVoiceRoomSessionStore: { getState: () => ({ activeRoom: null }) },
}));

const {
  grabQuickMatchAndEnterAudition,
  hasAuditionRoom,
  resetGrabQuickMatchPending,
} = await import("./grab-quick-match-flow");
const { router } = await import("expo-router");
const Toast = (await import("react-native-root-toast")).default;
const { voiceRoomApi } = await import("@/features/voice-room/voice-room.api");
const { exitVoiceRoom } = await import("@/features/voice-room/exit-voice-room");
const { refreshDispatchAfterGrabAttempt, refreshDispatchDetail } = await import("@/features/order/order-query");
const { actionNotice } = await import("@/shared/ui/action-notice/action-notice-store");

function auditionDetail(overrides: Record<string, unknown> = {}) {
  return {
    requestNo: "QM1",
    needVoice: true,
    roomId: 100,
    roomVersion: 3,
    buyerUserId: 200,
    currentGrabStatus: "GRABBED",
    ...overrides,
  };
}

function noVoiceDetail(overrides: Record<string, unknown> = {}) {
  return {
    requestNo: "QM1",
    needVoice: false,
    roomId: null,
    roomVersion: null,
    currentGrabStatus: "GRABBED",
    ...overrides,
  };
}

async function waitForConfirmDialog() {
  await vi.waitFor(() => {
    expect(useAppConfirm.getState().options).not.toBeNull();
  });
  return useAppConfirm.getState().options!;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetGrabQuickMatchPending();
  mocks.authState.accessToken = "token";
  mocks.authState.user = { id: "user-1" };
  mocks.detail = noVoiceDetail();
  mocks.grabResult = noVoiceDetail();
  mocks.grabError = null;
  mocks.roomDetail = {
    id: 100,
    roomVersion: 3,
    roomStatus: 1,
    creatorUserId: 200,
  };
  mocks.joinedRoom = null;
  mocks.joinedRoomAfterExit = null;
  mocks.exitCount = 0;
  mocks.activeMatch = null;
  useAppConfirm.getState().settle(false);
});

describe("hasAuditionRoom", () => {
  it("需要 needVoice + roomId + roomVersion", () => {
    expect(hasAuditionRoom(auditionDetail())).toBe(true);
    expect(hasAuditionRoom(noVoiceDetail())).toBe(false);
    expect(hasAuditionRoom(auditionDetail({ needVoice: false }))).toBe(false);
    expect(hasAuditionRoom(auditionDetail({ roomId: null }))).toBe(false);
    expect(hasAuditionRoom(auditionDetail({ roomVersion: null }))).toBe(false);
    expect(hasAuditionRoom(null)).toBe(false);
  });
});

describe("grabQuickMatchAndEnterAudition", () => {
  it("未登录返回 failed，不撤条也不刷新", async () => {
    mocks.authState.accessToken = null;
    await expect(grabQuickMatchAndEnterAudition("QM1")).resolves.toEqual({
      status: "failed",
      message: "请先登录",
    });
    expect(actionNotice.dismiss).not.toHaveBeenCalled();
    expect(refreshDispatchAfterGrabAttempt).not.toHaveBeenCalled();
  });

  it("无试音：抢单成功只 Toast，不跳详情也不进房", async () => {
    mocks.detail = noVoiceDetail();
    mocks.grabResult = noVoiceDetail();

    await expect(grabQuickMatchAndEnterAudition("QM1")).resolves.toEqual({
      status: "grabbed",
    });
    expect(Toast.show).toHaveBeenCalledWith("抢单成功", expect.anything());
    expect(router.push).not.toHaveBeenCalled();
    expect(voiceRoomApi.getDetail).not.toHaveBeenCalled();
    expect(actionNotice.dismiss).toHaveBeenCalledWith("qm:QM1");
    expect(refreshDispatchAfterGrabAttempt).toHaveBeenCalledTimes(1);
    expect(refreshDispatchDetail).toHaveBeenCalledWith("QM1");
  });

  it("缺 roomId：视为无试音房，不进房", async () => {
    mocks.detail = auditionDetail({ roomId: null });
    mocks.grabResult = auditionDetail({ roomId: null });

    await expect(grabQuickMatchAndEnterAudition("QM1")).resolves.toEqual({
      status: "grabbed",
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("有试音且不在其他房：抢单后进语聊房", async () => {
    mocks.detail = auditionDetail();
    mocks.grabResult = auditionDetail();

    await expect(grabQuickMatchAndEnterAudition("QM1")).resolves.toEqual({
      status: "entered",
    });
    expect(Toast.show).toHaveBeenCalledWith(
      "抢单成功，正在进入试音房…",
      expect.anything(),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/voice-room/[id]",
      params: { id: "100", v: "3" },
    });
    expect(exitVoiceRoom).not.toHaveBeenCalled();
  });

  it("replaceRoom：进房用 replace，不把详情页压在下面", async () => {
    mocks.detail = auditionDetail();
    mocks.grabResult = auditionDetail();

    await expect(
      grabQuickMatchAndEnterAudition("QM1", { replaceRoom: true }),
    ).resolves.toEqual({ status: "entered" });
    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/voice-room/[id]",
      params: { id: "100", v: "3" },
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("有试音且在其他房：确认后切房进入", async () => {
    mocks.detail = auditionDetail();
    mocks.grabResult = auditionDetail();
    mocks.joinedRoom = {
      id: "old-room",
      roomVersion: "1",
      roomName: "旧房",
      creatorUserId: "other",
    };
    mocks.joinedRoomAfterExit = null;

    const flow = grabQuickMatchAndEnterAudition("QM1");
    const options = await waitForConfirmDialog();
    expect(options.title).toBe("切换语聊房并抢单");
    useAppConfirm.getState().settle(true);

    await expect(flow).resolves.toEqual({ status: "entered" });
    expect(exitVoiceRoom).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalled();
  });

  it("有试音且用户取消切房：不抢单、不进房", async () => {
    const { grabDispatchRequest } = await import("@/features/order/dispatch.api");
    mocks.detail = auditionDetail();
    mocks.joinedRoom = {
      id: "old-room",
      roomVersion: "1",
      creatorUserId: "other",
    };

    const flow = grabQuickMatchAndEnterAudition("QM1");
    await waitForConfirmDialog();
    useAppConfirm.getState().settle(false);

    await expect(flow).resolves.toEqual({ status: "cancelled" });
    expect(grabDispatchRequest).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(actionNotice.dismiss).not.toHaveBeenCalled();
    expect(refreshDispatchAfterGrabAttempt).not.toHaveBeenCalled();
    expect(refreshDispatchDetail).not.toHaveBeenCalled();
  });

  it("抢单失败返回 failed，同样撤条并刷新其它入口", async () => {
    mocks.detail = noVoiceDetail({ currentGrabStatus: undefined });
    mocks.grabError = new Error("人数已满");

    await expect(grabQuickMatchAndEnterAudition("QM1")).resolves.toEqual({
      status: "failed",
      message: "人数已满",
    });
    expect(actionNotice.dismiss).toHaveBeenCalledWith("qm:QM1");
    expect(refreshDispatchAfterGrabAttempt).toHaveBeenCalledTimes(1);
    expect(refreshDispatchDetail).toHaveBeenCalledWith("QM1");
  });

  it("同一 requestNo 防重入", async () => {
    mocks.detail = auditionDetail();
    mocks.joinedRoom = {
      id: "old-room",
      roomVersion: "1",
      creatorUserId: "other",
    };

    const first = grabQuickMatchAndEnterAudition("QM1");
    await waitForConfirmDialog();
    await expect(grabQuickMatchAndEnterAudition("QM1")).resolves.toEqual({
      status: "cancelled",
    });
    useAppConfirm.getState().settle(false);
    await first;
  });
});
