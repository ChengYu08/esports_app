import { afterEach, describe, expect, it, vi } from "vitest";
import { signOut } from "./sign-out";

const mocks = vi.hoisted(() => ({
  clear: vi.fn(), clearStored: vi.fn(), logout: vi.fn(), leaveRtc: vi.fn(), leaveChat: vi.fn(),
  resetMessages: vi.fn(), clearRoom: vi.fn(), resetProfiles: vi.fn(), clearQueries: vi.fn(),
}));
vi.mock("@esports/auth", () => ({ useAuthStore: { getState: () => ({ accessToken: "test", clearSession: mocks.clear }) } }));
vi.mock("@/core/query/query-client", () => ({ queryClient: { clear: mocks.clearQueries } }));
vi.mock("@/features/message/action-command/action-command-handlers", () => ({ clearActionCommandAccountState: vi.fn() }));
vi.mock("@/features/message/message-store", () => ({ messageStore: { getState: () => ({ reset: mocks.resetMessages }) } }));
vi.mock("@/features/voice-room/voice-room-rtc", () => ({ leaveVoiceRtc: mocks.leaveRtc }));
vi.mock("@/features/voice-room/voice-room-rongcloud", () => ({ leaveVoiceChatRoom: mocks.leaveChat }));
vi.mock("@/features/voice-room/voice-room-session", () => ({ useVoiceRoomSessionStore: { getState: () => ({ activeRoom: { rongChatroomId: "room" }, clearActiveRoom: mocks.clearRoom }) } }));
vi.mock("./client-auth.api", () => ({ clientAuthApi: { logout: mocks.logout } }));
vi.mock("./session-persistence", () => ({ clearAuthSession: mocks.clearStored }));
vi.mock("./user-profile-store", () => ({ useUserProfileStore: { getState: () => ({ reset: mocks.resetProfiles }) } }));
afterEach(() => { vi.useRealTimers(); });

describe("退出登录网络异常", () => {
  it("原生退房不返回也能清除凭证并退出", async () => {
    vi.useFakeTimers();
    mocks.leaveRtc.mockReturnValue(new Promise(() => {}));
    mocks.leaveChat.mockReturnValue(new Promise(() => {}));
    mocks.resetMessages.mockResolvedValue(undefined);
    mocks.logout.mockRejectedValue(new Error("离线"));
    let done = false;
    const result = signOut().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(5_001);
    expect(done).toBe(true);
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(mocks.clearStored).toHaveBeenCalledOnce();
    expect(mocks.resetMessages).toHaveBeenCalledOnce();
    expect(mocks.clearQueries).toHaveBeenCalledOnce();
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});
