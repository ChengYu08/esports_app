/**
 * 活动规则 HTML 透传：落地页 push 前写入，规则页读取渲染。
 * 避免超长 HTML 塞进路由 params；离开规则页时再清空。
 */
let pendingRules: string | null = null;

/** 写入待透传的活动规则 HTML。 */
export function setPendingActivityRules(rules: string): void {
  pendingRules = rules;
}

/** 读取待透传的活动规则 HTML（不清空，兼容 React Strict Mode 双挂载）。 */
export function getPendingActivityRules(): string | null {
  return pendingRules;
}

/** 清空待透传的活动规则 HTML。 */
export function clearPendingActivityRules(): void {
  pendingRules = null;
}
