import { useCallback } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuthStore } from "@esports/auth";
import { clientAuthApi } from "@/features/auth/client-auth.api";

/** 审批可能在后台完成；重新获得焦点时同步申请状态和账号俱乐部身份。 */
export function useClubJoinRefresh(refetch: () => unknown) {
  const token = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  useFocusEffect(useCallback(() => {
    if (!token || !userId) {
      return;
    }
    let active = true;
    let sequence = 0;
    const refresh = () => {
      const current = ++sequence;
      refetch();
      clientAuthApi.fetchCurrentUser(token).then((profile) => {
        if (!active || current !== sequence) {
          return;
        }
        useAuthStore.setState((state) => {
          if (state.accessToken !== token || state.user?.id !== userId || String(profile.id) !== userId) {
            return state;
          }
          return { user: { ...state.user, clubInfo: profile.clubInfo === undefined ? state.user.clubInfo : profile.clubInfo, isRealName: profile.isRealName ?? state.user.isRealName } };
        });
      }).catch(() => {});
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
      }
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [refetch, token, userId]));
}
