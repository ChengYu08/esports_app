import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppConfirm } from "@/shared/ui/app-confirm";

const mocks = vi.hoisted(() => ({
  authState: {
    accessToken: "token",
    user: { id: "user-1" },
  },
  joinedRoom: null as Record<string, unknown> | null,
  joinedRoomAfterExit: null as Record<string, unknown> | null,
  exitCount: 0,
  claimedRoom: null as unknown as Record<string, unknown>,
}));

vi.mock("@esports/auth", () => ({
  useAuthStore: { getState: () => mocks.authState },
}));

vi.mock("expo-router", () => ({
  router: { push: vi.fn() },
}));

vi.mock("react-native-root-toast", () => ({
  default: { show: vi.fn(), durations: { SHORT: 2000 } },
}));

vi.mock("./voice-room.api", () => ({
  resolveVoiceRoomId: (value: unknown) => {
    if (!value || typeof value !== "object") return null;
    const room = value as Record<string, unknown>;
    const id = room.id ?? room.roomId ?? room.voiceRoomId;
    return id == null ? null : String(id);
  },
  voiceRoomApi: {
    getJoinedRoom: vi.fn(async () =>
      mocks.exitCount > 0 ? mocks.joinedRoomAfterExit : mocks.joinedRoom),
    claimClubService: vi.fn(async () => mocks.claimedRoom),
  },
}));

vi.mock("./exit-voice-room", () => ({
  exitVoiceRoom: vi.fn(async () => {
    mocks.exitCount += 1;
  }),
}));

vi.mock("./voice-room-session", () => ({
  useVoiceRoomSessionStore: { getState: () => ({ activeRoom: null }) },
}));

const { claimAndEnterCustomerServiceRoom } = await import(
  "./use-customer-service-room-flow"
);
const { router } = await import("expo-router");
const { voiceRoomApi } = await import("./voice-room.api");
const { exitVoiceRoom } = await import("./exit-voice-room");

const invite = {
  roomId: "room-target",
  clubId: "club-1",
  roomVersion: "2",
};

function resetConfirm() {
  useAppConfirm.getState().settle(false);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.joinedRoom = null;
  mocks.joinedRoomAfterExit = null;
  mocks.exitCount = 0;
  mocks.claimedRoom = { roomInfo: { id: "room-target", roomVersion: "2" } };
  resetConfirm();
});

describe("appConfirm bridge", () => {
  it("exposes options while pending and resolves with the chosen outcome", async () => {
    const promise = useAppConfirm.getState().confirm({
      title: "标题",
      message: "内容",
      cancelText: "取消",
      confirmText: "确定",
    });

    expect(useAppConfirm.getState().options).toEqual({
      title: "标题",
      message: "内容",
      cancelText: "取消",
      confirmText: "确定",
    });

    useAppConfirm.getState().settle(true);
    await expect(promise).resolves.toBe(true);
    expect(useAppConfirm.getState().options).toBeNull();
  });

  it("resolves false and clears state when cancelled", async () => {
    const promise = useAppConfirm.getState().confirm({ message: "内容" });
    useAppConfirm.getState().settle(false);

    await expect(promise).resolves.toBe(false);
    expect(useAppConfirm.getState().options).toBeNull();
  });
});

async function waitForConfirmDialog() {
  await vi.waitFor(() => {
    expect(useAppConfirm.getState().options).not.toBeNull();
  });
  return useAppConfirm.getState().options!;
}

describe("claimAndEnterCustomerServiceRoom room-switch confirm", () => {
  it("shows the app confirm dialog when switching from another room", async () => {
    mocks.joinedRoom = {
      id: "room-current",
      roomVersion: "1",
      roomName: "当前房间",
      creatorUserId: "someone-else",
    };

    const flow = claimAndEnterCustomerServiceRoom(invite);

    const options = await waitForConfirmDialog();
    expect(options.title).toBe("切换语聊房并接单");
    expect(options.cancelText).toBe("暂不处理");
    expect(options.confirmText).toBe("继续接单");
    expect(options.message).toContain("当前房间");
    expect(options.message).toContain("退出当前房间并进入老板的语聊房，其他成员不受影响。");

    useAppConfirm.getState().settle(false);
    await expect(flow).resolves.toEqual({ status: "cancelled" });
    expect(voiceRoomApi.claimClubService).not.toHaveBeenCalled();
  });

  it("claims and enters after the user confirms", async () => {
    mocks.joinedRoom = {
      id: "room-current",
      roomVersion: "1",
      roomName: "当前房间",
      creatorUserId: "someone-else",
    };

    const flow = claimAndEnterCustomerServiceRoom(invite);
    await waitForConfirmDialog();
    useAppConfirm.getState().settle(true);
    await expect(flow).resolves.toEqual({ status: "entered" });

    expect(voiceRoomApi.claimClubService).toHaveBeenCalledWith(invite, "token");
    expect(exitVoiceRoom).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: "room-current", roomVersion: "1" }),
      "user-1",
      "token",
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/voice-room/[id]",
      params: { id: "room-target", v: "2" },
    });
  });

  it("warns about dissolving when the current room is owned by the user", async () => {
    mocks.joinedRoom = {
      id: "room-current",
      roomVersion: "1",
      roomName: "我的房间",
      creatorUserId: "user-1",
    };

    const flow = claimAndEnterCustomerServiceRoom(invite);

    const options = await waitForConfirmDialog();
    expect(options.message).toContain("你是该房间的房主。");
    expect(options.message).toContain("解散当前房间，房内所有成员都会被移出");

    useAppConfirm.getState().settle(false);
    await expect(flow).resolves.toEqual({ status: "cancelled" });
  });

  it("uses the resumed wording for enter-claimed flows", async () => {
    mocks.joinedRoom = {
      id: "room-current",
      roomVersion: "1",
      roomName: "当前房间",
      creatorUserId: "someone-else",
    };

    const flow = claimAndEnterCustomerServiceRoom(invite, true);

    const options = await waitForConfirmDialog();
    expect(options.title).toBe("进入接待房间");
    expect(options.confirmText).toBe("继续进入");
    expect(options.message).toContain("你已接单。继续后将");

    useAppConfirm.getState().settle(false);
    await expect(flow).resolves.toEqual({ status: "cancelled" });
  });

  it("skips the dialog when already inside the target room", async () => {
    mocks.joinedRoom = { id: "room-target", roomVersion: "2" };

    await expect(claimAndEnterCustomerServiceRoom(invite)).resolves.toEqual({ status: "entered" });

    expect(useAppConfirm.getState().options).toBeNull();
    expect(voiceRoomApi.claimClubService).toHaveBeenCalledTimes(1);
  });

  it("skips the dialog when not in any room", async () => {
    mocks.joinedRoom = null;

    await expect(claimAndEnterCustomerServiceRoom(invite)).resolves.toEqual({ status: "entered" });

    expect(useAppConfirm.getState().options).toBeNull();
    expect(voiceRoomApi.claimClubService).toHaveBeenCalledTimes(1);
  });
});
