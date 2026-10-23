// 小法庭投诉/工单流程的共享色值。
// 与 src/shared/theme/tokens.ts 的语义一一对应，方便跨文件复用，
// 避免两个选择器屏幕各自硬编码一套色值后长期漂移。
import { colors } from "@/shared/theme/tokens";

export const COURT_SOURCE_COLORS = {
  /** 页面背景 */
  background: "#F7F7F7",
  /** 白色表面 */
  surface: colors.surface,
  /** 主文字 */
  text: "#0D0D0F",
  /** 次要文字（订单号、辅助信息） */
  textSecondary: colors.textSecondary,
  /** 弱文字/占位 */
  textMuted: colors.textMuted,
  /** 搜索框、输入框背景 */
  fill: "#F7F7F7",
  /** 品牌红 */
  brand: "#FE1F4C",
  /** 品牌红（禁用态） */
  brandDisabled: "#FF708D",
  /** 品牌浅色（按钮 hover 反馈） */
  brandSoft: "#FFF3F5",
  /** 细分割线 */
  border: "#F0F0F0",
  /** 占位文字 */
  placeholder: "#CCCCCC",
  /** 列表尾部“没有更多啦～” */
  footerMuted: "#CCCCCC",
  /** 空态说明 */
  empty: "#999999",
} as const;
