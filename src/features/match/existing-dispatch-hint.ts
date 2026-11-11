const EXISTING_DISPATCH_HINTS = [
  "已有派单",
  "当前用户有进行中的派单",
] as const;

/** 发布撞进行中派单：后端文案可能随版本变化，用 includes 做兼容匹配 */
export function isExistingDispatchConflictMessage(message: string): boolean {
  return EXISTING_DISPATCH_HINTS.some((hint) => message.includes(hint));
}
