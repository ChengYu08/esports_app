import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";
import { useCallback, useState } from "react";

import { ApiError } from "@/core/network/api-client";
import type { ComputedActivityResult } from "@/features/activity/activity-status";
import { publishActivity } from "@/features/activity/api/activity.api";
import type { ActivityDetail } from "@/features/activity/api/activity.types";
import { fetchActiveQuickMatch } from "@/features/match/api/match.api";
import {
  isQuickMatchActive,
  type QuickMatchRequestDetail,
} from "@/features/match/api/match.types";
import { openAuditionRoom } from "@/features/match/enter-audition-room";
import { isExistingDispatchConflictMessage } from "@/features/match/existing-dispatch-hint";
import {
  ensureRealNameBeforeVoiceRoomEnter,
  promptSelfRealNameIfNeeded,
} from "@/features/voice-room/ensure-real-name-before-enter";
import { requireLogin } from "@/shared/navigation/require-login";
import { showToast } from "@/shared/ui/app-toast";

/** 恢复进匹配中页（对齐 useRestoreActiveMatch 参数） */
function goMatchingFromActive(active: QuickMatchRequestDetail) {
  router.replace({
    pathname: "/match/matching/[requestNo]",
    params: {
      requestNo: active.requestNo,
      ...(active.expireTime ? { expireTime: active.expireTime } : {}),
      ...(active.gameId && active.gameName
        ? {
            gameId: String(active.gameId),
            gameName: active.gameName,
          }
        : {}),
    },
  });
}

/**
 * 秒杀活动参与：防重 → 登录 → 实名 → 发布派单 → 进试音房（含已有派单冲突恢复）。
 */
export function useSeckillJoin(
  detail: ActivityDetail,
  computed: ComputedActivityResult | null,
) {
  const token = useAuthStore((state) => state.accessToken);
  const [publishing, setPublishing] = useState(false);

  const handleJoin = useCallback(async () => {
    if (!computed || publishing) {
      return;
    }
    if (computed.status !== "ACTIVE") {
      return;
    }
    // 登录判断只走 requireLogin（未登录会跳登录页）；!token 仅为通过后的类型收窄。
    if (!requireLogin() || !token) {
      return;
    }
    if (!(await ensureRealNameBeforeVoiceRoomEnter())) {
      return;
    }
    setPublishing(true);
    try {
      const result = await publishActivity(detail.activityId, token);
      // roomId 为空时 openAuditionRoom 内部走 ensure 兜底分支。
      await openAuditionRoom(result.requestNo, token, {
        expireTime: result.expireTime || undefined,
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "NOT_LOGGED_IN") {
        requireLogin();
        return;
      }
      const message = error instanceof Error ? error.message : "参与活动失败，请重试";
      if (await promptSelfRealNameIfNeeded(message)) {
        return;
      }
      // 已有未过期派单：查 active → ensure 进试音房；进房失败再回退匹配中页。
      if (isExistingDispatchConflictMessage(message)) {
        try {
          const active = await fetchActiveQuickMatch(token);
          if (active && isQuickMatchActive(active)) {
            if (active.needVoice === false) {
              goMatchingFromActive(active);
              return;
            }
            const entered = await openAuditionRoom(active.requestNo, token, {
              expireTime: active.expireTime || undefined,
            });
            if (!entered) {
              goMatchingFromActive(active);
            }
            return;
          }
        } catch {
          // 恢复查询失败则落回原错误文案
        }
      }
      showToast(message);
    } finally {
      setPublishing(false);
    }
  }, [computed, detail.activityId, publishing, token]);

  const joinable = computed?.status === "ACTIVE" && !publishing;

  return { publishing, joinable, handleJoin };
}
