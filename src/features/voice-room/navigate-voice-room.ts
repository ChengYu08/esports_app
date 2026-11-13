/**
 * 语聊房路由单实例导航：产品约束是语聊房页面在路由栈中只允许存在一个，
 * 否则关闭其中一个后回退会看到已失效的空壳页面。
 *
 * - 当前正聚焦在语聊房屏（房内切房：客服接单、房内邀请等）→ dismissTo 原地
 *   替换 params，不叠层；params 变化时屏内 join effect 会按新 id 重新进房。
 * - 图片预览通过侧边入口返回 → 收起预览复用下方同房实例，否则替换预览进房。
 * - 从其他页面进入 → push，保留支付页/聊天页等中间路由；栈底残留的旧
 *   实例由 VoiceRoomScreen 的焦点守卫在回退到它时自动弹出。
 *
 * 不能用「栈内是否挂载」判断后 dismissTo：POP_TO 会把目标实例之上的全部
 * 中间页面弹掉，导致从聊天页进房、关房后中间路由丢失；也不能在非聚焦时
 * dismissTo：POP_TO 找不到目标时会「替换当前屏」而不是 push。
 */
import { router } from "expo-router";

import { useVoiceRoomSessionStore } from "./voice-room-session";

export type VoiceRoomRouteParams = {
  id: string;
  v?: string;
  scene?: string;
  requestNo?: string;
  expireTime?: string;
  gameId?: string;
  gameName?: string;
  gameIconUrl?: string;
  callService?: string;
};

type VoiceRoomNavigationState = {
  index: number;
  routes: readonly { name: string; params?: object }[];
};

export function navigateToVoiceRoom(
  params: VoiceRoomRouteParams,
  navigationState?: VoiceRoomNavigationState,
) {
  const currentRoute = navigationState?.routes[navigationState.index];
  if (navigationState && currentRoute?.name === "image-preview") {
    let previousIndex = navigationState.index - 1;
    // 兼容旧栈中连续压入的预览，一次收起后回到原房间。
    while (previousIndex >= 0 && navigationState.routes[previousIndex].name === "image-preview") {
      previousIndex -= 1;
    }
    const previousRoute = navigationState.routes[previousIndex];
    const previousParams = previousRoute?.params as VoiceRoomRouteParams | undefined;
    if (
      previousRoute?.name === "voice-room/[id]" &&
      previousParams?.id === params.id &&
      (!previousParams.v || previousParams.v === params.v)
    ) {
      const previewCount = navigationState.index - previousIndex;
      if (previewCount === 1) {
        router.back();
      } else {
        router.dismiss(previewCount);
      }
      return;
    }
    // 预览是临时页面，从其他来源的预览进房也不能把它留在返回栈中。
    router.replace({ pathname: "/voice-room/[id]", params });
    return;
  }
  if (useVoiceRoomSessionStore.getState().screenFocused === true) {
    router.dismissTo({ pathname: "/voice-room/[id]", params });
    return;
  }
  router.push({ pathname: "/voice-room/[id]", params });
}
