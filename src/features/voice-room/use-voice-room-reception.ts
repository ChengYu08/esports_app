import { clientAuthApi } from "@/features/auth/client-auth.api";
import {
  cancelQuickMatch,
  fetchDispatchActiveQuickMatch,
  fetchQuickMatchClubDetail,
  fetchQuickMatchGames,
} from "@/features/match/api/match.api";
import { isQuickMatchActive } from "@/features/match/api/match.types";
import type { MatchGame } from "@/features/match/api/match.types";
import { useCallback, useState } from "react";

import { useAppConfirm } from "@/shared/ui/app-confirm";
import { showToast } from "@/shared/ui/app-toast";

import { useAuthStore } from "@esports/auth";
import type { VoiceRoomDetail } from "./voice-room.types";

export interface UseVoiceRoomReceptionOptions {
  accessToken: string | null;
  room: VoiceRoomDetail | null;
  currentUser: { id: string } | null;
  canServiceDispatch: boolean;
}

export function useVoiceRoomReception(options: UseVoiceRoomReceptionOptions) {
  const { accessToken, room, currentUser, canServiceDispatch } = options;
  const [receptionVisible, setReceptionVisible] = useState(false);
  const [receptionPreparing, setReceptionPreparing] = useState(false);
  const [receptionClub, setReceptionClub] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [receptionGames, setReceptionGames] = useState<MatchGame[]>([]);
  const [receptionBuyerId, setReceptionBuyerId] = useState<string>("");
  const [receptionBuyerName, setReceptionBuyerName] = useState("");

  const onServiceDispatch = useCallback(async () => {
    if (!canServiceDispatch) {
      showToast("只有当前房间绑定的接待客服可以派单");
      return;
    }
    if (!accessToken || !room) return;
    const clubId = room.clubId;
    const ownerId = room.creatorUserId;
    if (clubId == null || clubId === "" || ownerId == null || ownerId === "") {
      showToast("房间信息不完整，无法派单");
      return;
    }
    if (receptionPreparing) return;
    setReceptionPreparing(true);
    const selfId = String(currentUser?.id || "");
    const valid = () =>
      !!useAuthStore.getState().accessToken &&
      String(useAuthStore.getState().user?.id || "") === selfId &&
      canServiceDispatch;

    try {
      const active = await fetchDispatchActiveQuickMatch(accessToken);
      if (!valid()) return;
      if (active && isQuickMatchActive(active)) {
        const confirmed = await useAppConfirm.getState().confirm({
          title: "派单进行中",
          message: `订单 ${active.requestNo} 仍在匹配中，可取消后重新派单。`,
          cancelText: "知道了",
          confirmText: "取消派单",
        });
        if (confirmed) {
          try {
            await cancelQuickMatch(active.requestNo, accessToken);
            showToast("已取消派单");
          } catch (error) {
            showToast(
              error instanceof Error
                ? error.message
                : "取消派单失败，请稍后重试",
            );
          }
        }
        return;
      }

      const [detail, gameList, ownerProfile] = await Promise.all([
        fetchQuickMatchClubDetail(clubId, accessToken),
        fetchQuickMatchGames(accessToken, undefined, clubId),
        clientAuthApi
          .getUserProfile(accessToken, String(ownerId))
          .catch(() => null),
      ]);
      if (!valid()) return;
      if (!detail) {
        showToast("俱乐部信息获取失败，请稍后重试");
        return;
      }
      setReceptionBuyerId(String(ownerId));
      setReceptionBuyerName(ownerProfile?.nickname || "");
      setReceptionClub({ id: detail.id, name: detail.name });
      setReceptionGames(gameList);
      setReceptionVisible(true);
    } catch (error) {
      if (valid()) {
        showToast(
          error instanceof Error ? error.message : "派单准备失败，请重试",
        );
      }
    } finally {
      setReceptionPreparing(false);
    }
  }, [
    accessToken,
    canServiceDispatch,
    currentUser?.id,
    receptionPreparing,
    room,
  ]);

  return {
    receptionVisible,
    setReceptionVisible,
    receptionClub,
    receptionGames,
    receptionBuyerId,
    receptionBuyerName,
    onServiceDispatch,
  };
}
