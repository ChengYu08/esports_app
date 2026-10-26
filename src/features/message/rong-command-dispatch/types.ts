import type { RongCommand } from "@/features/message/rongcloud-command";

export type RongCommandContext = {
  /** 已登录且有 user.id 时为字符串，否则为空串 */
  userId: string;
};

export type RongCommandHandler = {
  id: string;
  /** 默认 true：无 accessToken 时跳过；Kick 传 false */
  requireAuth?: boolean;
  handle: (command: RongCommand, ctx: RongCommandContext) => void;
};
