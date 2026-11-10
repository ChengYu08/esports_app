/**
 * 开黑房路由单实例导航：产品约束是开黑房页面在路由栈中只允许存在一个，
 * 否则关闭其中一个后回退会看到已失效的空壳页面。
 *
 * - 当前正聚焦在开黑房屏（房内切房：客服接单、房内邀请等）→ dismissTo 原地
 *   替换 params，不叠层；params 变化时屏内 join effect 会按新 id 重新进房。
 * - 从其他页面进入 → 一律 push，保留支付页/聊天页等中间路由；栈底残留的旧
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

export function navigateToVoiceRoom(params: VoiceRoomRouteParams) {
  if (useVoiceRoomSessionStore.getState().screenFocused === true) {
    router.dismissTo({ pathname: "/voice-room/[id]", params });
    return;
  }
  router.push({ pathname: "/voice-room/[id]", params });
}
