import { router } from "expo-router";

import { ensureAuditionRoom } from "@/features/match/api/match.api";
import { resolveVoiceRoomId } from "@/features/voice-room/voice-room.api";
import { showToast } from "@/shared/ui/app-toast";

type AuditionRoomGame = { id: string; name: string; iconUrl?: string };

type OpenAuditionRoomOptions = {
  expireTime?: string;
  game?: AuditionRoomGame | null;
};

/** 发布后进试音房：ensure 取最新房间实例后 replace 进入（对齐 PC useQuickMatchRoomFlow） */
export async function openAuditionRoom(
  requestNo: string,
  token: string,
  options: OpenAuditionRoomOptions = {},
): Promise<boolean> {
  const { expireTime, game } = options;
  try {
    const room = await ensureAuditionRoom(requestNo, token);
    const roomId = resolveVoiceRoomId(room) || room.id;
    if (!roomId) throw new Error("试音房信息不存在");
    const params = {
      id: roomId,
      scene: "audition",
      requestNo,
      ...(expireTime ? { expireTime } : {}),
      ...(game?.id && game.name
        ? {
            gameId: game.id,
            gameName: game.name,
            ...(game.iconUrl ? { gameIconUrl: game.iconUrl } : {}),
          }
        : {}),
    };
    router.replace({ pathname: "/voice-room/[id]", params });
    return true;
  } catch (error) {
    showToast(
      error instanceof Error
        ? `派单已发布，但${error.message}`
        : "派单已发布，但暂时无法进入试音房，请稍后重试",
    );
    return false;
  }
}
