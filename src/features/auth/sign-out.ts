import { useAuthStore } from "@esports/auth";

import { queryClient } from "@/core/query/query-client";
import { messageStore } from "@/features/message/message-store";
import { leaveVoiceRtc } from "@/features/voice-room/voice-room-rtc";
import { leaveVoiceChatRoom } from "@/features/voice-room/voice-room-rongcloud";
import { useVoiceRoomSessionStore } from "@/features/voice-room/voice-room-session";

import { clientAuthApi } from "./client-auth.api";
import { clearAuthSession } from "./session-persistence";

/** 对齐 PC chatStore.getAccountLogoutConfirmText：仅房主展示解散影响说明。 */
export function getLogoutConfirmMessage(
  userId: string | number | null | undefined = useAuthStore.getState().user?.id,
): string {
  const uid = userId == null ? "" : String(userId);
  const room = useVoiceRoomSessionStore.getState().activeRoom;
  if (room && uid && String(room.creatorUserId) === uid) {
    return "你当前创建的语聊房仍在进行中。退出登录将解散该房间，房内成员会被移出，正在进行的接待或试音也会结束。是否继续退出？";
  }
  return "确认要退出登录吗？";
}

/**
 * 退出登录（基础设置手动退出、修改密码后强制重登共用）。
 * 顺序对齐 PC 端 user.ts#logout：
 * 1. 用旧 token 先解绑实时资源（语音房 RTC / 融云聊天室），再断开 IM；
 * 2. 清本地凭证 + 内存会话 + 查询缓存；
 * 3. 最后调 logout 让服务端 token 失效，失败不阻塞本地登出，但要等其完成，
 *    避免新账号拿到未失效的旧 token。
 * 导航由调用方负责。
 */
export async function signOut(): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  try {
    const { activeRoom, joiningRoom, clearActiveRoom } =
      useVoiceRoomSessionStore.getState();
    clearActiveRoom();
    if (activeRoom || joiningRoom) {
      await leaveVoiceRtc().catch(() => undefined);
      const chatroomIds = new Set([
        activeRoom?.rongChatroomId,
        joiningRoom?.rongChatroomId,
      ]);
      await Promise.allSettled(
        [...chatroomIds]
          .filter((id): id is string => Boolean(id))
          .map((id) => leaveVoiceChatRoom(id)),
      );
    }
    await messageStore
      .getState()
      .reset()
      .catch(() => undefined);
  } finally {
    try {
      await clearAuthSession();
    } catch {
      // 安全存储不可用时也要完成本地登出。
    }
    useAuthStore.getState().clearSession();
    queryClient.clear();
    if (token) {
      await clientAuthApi.logout(token).catch(() => undefined);
    }
  }
}
