import { parseServerDateTime } from "@/shared/time/server-date";

export type MatchGame = {
  id: string;
  name: string;
  iconUrl?: string;
};

export type MatchClub = {
  id: string;
  name: string;
  logoUrl?: string;
  memberCount?: number;
};

export type MatchMode = {
  id: string;
  name: string;
};

export type MatchLevel = {
  id: string;
  name: string;
};

export type MatchService = {
  id: string;
  name: string;
  malePrice: number;
  femalePrice: number;
  billingUnitName?: string;
  supportMultiCompanion: boolean;
};

/** 0不限 / 1男 / 2女 */
export type MatchGenderRequirement = 0 | 1 | 2;

/** 1单陪 / 2双陪 */
export type MatchCompanionPreference = 1 | 2;

export type MatchVoiceOption = "不试音" | "需试音";

export type PublishQuickMatchPayload = {
  clubId: number;
  publishType: "BUYER" | "RECEPTION";
  /** 接待代发时必填：老板（语聊房房主）用户 ID */
  buyerUserId?: number;
  gameId: number;
  gameModeId: number;
  gameLevelId: number;
  gameServiceId: number;
  genderRequirement: number;
  quantity: number;
  needVoice: boolean;
  companionPreference?: 1 | 2;
  remark?: string;
};

export type QuickMatchPublishResult = {
  requestNo: string;
  roomId?: number | string | null;
  roomVersion?: number | string | null;
  expireTime?: string;
};

export type QuickMatchGrabStatus = "GRABBED" | "SUCCESS" | "FAILED";

export type QuickMatchGrabItem = {
  id: string;
  requestNo?: string;
  companionUserId?: string;
  companionServiceId?: string;
  nickname: string;
  headImage?: string;
  /** 0未知 1男 2女 */
  sex: 0 | 1 | 2;
  grabStatus?: QuickMatchGrabStatus;
  remark?: string;
  clubId?: string;
};

/** 活动卡逐行文案（仅活动需求输出） */
export type QuickMatchCardItem = {
  label: string;
  value: { text: string };
};

/** 支付预览优惠券明细 */
export type PayPreviewCoupon = {
  userCouponId: string;
  couponName: string;
  discountAmount: number;
};

/** 支付预览支付方式（当前仅星钻 DIAMOND） */
export type PayPreviewMethod = {
  code: string;
  name: string;
  balance: number;
  discountAmount: number;
  payableAmount: number;
  coupons: PayPreviewCoupon[];
};

/** 支付预览响应（仅活动订单调用，普通订单保持 batchPay/payable 流程） */
export type PayPreview = {
  totalPrice: number;
  paymentMethods: PayPreviewMethod[];
};

export type QuickMatchRequestDetail = {
  requestNo: string;
  clubId?: string;
  gameId?: string;
  gameModeId?: string;
  gameLevelId?: string;
  gameServiceId?: string;
  gameName?: string;
  modeName?: string;
  levelName?: string;
  serviceName?: string;
  billingUnitName?: string;
  genderRequirement?: number;
  quantity?: number;
  needVoice?: boolean;
  companionPreference?: 1 | 2 | null;
  roomId?: string | null;
  roomVersion?: string | null;
  remark?: string;
  /** MATCHING / ORDERED / CANCELLED / EXPIRED */
  status?: string;
  expireTime?: string;
  publishType?: "BUYER" | "RECEPTION" | string;
  buyerUserId?: string;
  buyerNickname?: string;
  dispatcherUserId?: string;
  /** 发布来源：QUICK_MATCH 普通派单 / ACTIVITY 活动派单（旧数据可能缺省） */
  publishSource?: string;
  /** 关联活动 ID（Long 转字符串，仅活动需求输出） */
  activityId?: string;
  /** 活动编码；非空即视为活动模式 */
  activityCode?: string;
  /** 活动类型（如 SECKILL） */
  activityType?: string;
  /** 活动卡逐行文案 */
  cardItems?: QuickMatchCardItem[];
  /** 活动优惠金额快照 */
  discountAmount?: number;
  /** 活动实付金额快照 */
  realPayAmount?: number;
  /** 本次最多可选抢单人数（活动=1；普通需求不输出，维持多选） */
  maxSelectableCount?: number;
};

export type QuickMatchPayable = {
  orderCount: number;
  totalPrice: number;
};

export type QuickMatchCreatedOrder = {
  orderId: string;
  serviceUserId?: string;
};

export type QuickMatchCreatedOrders = {
  totalPrice: number;
  /** 活动优惠金额（仅活动订单返回） */
  discountAmount?: number;
  /** 活动实付金额（仅活动订单返回） */
  realPayAmount?: number;
  orders: QuickMatchCreatedOrder[];
};

export type QuickMatchAuditionRoom = {
  id: string;
  roomVersion?: string | number;
  roomName?: string;
  creatorUserId?: string | number;
};

/** 一陪多单：发布多陪服务时不带单/双陪偏好，详情中该字段为空即视为一陪多单 */
export function isMultiCompanionRequest(
  detail: QuickMatchRequestDetail | null | undefined,
): boolean {
  return detail != null && detail.companionPreference == null;
}

/** 抢单选人上限（与 PC / 后端 @Size(max = 3) 一致） */
export const QUICK_MATCH_MAX_SELECT = 3;

/** 活动模式判定：只认 activityCode 非空；为空即普通模式，行为保持不变 */
export function isActivityQuickMatch(
  detail: QuickMatchRequestDetail | null | undefined,
): boolean {
  return Boolean(detail && detail.activityCode && detail.activityCode.trim() !== "");
}

/** 选人上限：活动模式用 maxSelectableCount（缺省兜底单选 1），普通模式维持 3 人多选 */
export function resolveMaxSelectableCount(
  detail: QuickMatchRequestDetail | null | undefined,
): number {
  if (!isActivityQuickMatch(detail)) return QUICK_MATCH_MAX_SELECT;
  const count = Number(detail?.maxSelectableCount);
  if (Number.isFinite(count) && count >= 1) return Math.trunc(count);
  return 1;
}

/**
 * 选人切换纯逻辑（便于单测/跨容器复用）：
 * - 点已选中的 → 取消选中；
 * - 未达上限 → 追加；
 * - 达上限且上限为 1（活动单选）→ 点其他人直接切换；
 * - 达上限且上限 > 1 → 保持不变并提示超限。
 */
export function applyGrabSelection(
  prev: string[],
  grabId: string,
  maxSelectable: number,
): { ids: string[]; overLimit: boolean } {
  if (prev.includes(grabId)) {
    return { ids: prev.filter((id) => id !== grabId), overLimit: false };
  }
  if (prev.length >= maxSelectable) {
    if (maxSelectable <= 1) {
      return { ids: [grabId], overLimit: false };
    }
    return { ids: prev, overLimit: true };
  }
  return { ids: [...prev, grabId], overLimit: false };
}

export function isQuickMatchActive(request: QuickMatchRequestDetail | null): boolean {
  if (!request || request.status !== "MATCHING") return false;
  if (!request.expireTime) return true;
  return parseServerDateTime(request.expireTime) > Date.now();
}

/**
 * 语聊房「派单匹配中」判定（任务 4）：当前用户有进行中的活动需求。
 * 条件：需求进行中（MATCHING 且未过期）+ 活动派单（publishSource === "ACTIVITY" 或 activityCode 非空）+ 本人发起。
 * buyerUserId 有值时二次校验；缺省视为本人（/quickMatch/active/detail 仅返回调用者自己的需求）。
 */
export function isOwnActiveActivityRequest(
  active: QuickMatchRequestDetail | null | undefined,
  userId: string | number | null | undefined,
): boolean {
  if (userId == null || String(userId) === "") return false;
  if (!active || !isQuickMatchActive(active)) return false;
  // 活动判定与详情页 isActivityQuickMatch 同源：publishSource 为 ACTIVITY，或 activityCode 非空（旧数据可能缺省 publishSource）
  if (active.publishSource !== "ACTIVITY" && !isActivityQuickMatch(active)) return false;
  const buyerUserId = active.buyerUserId;
  if (buyerUserId == null || buyerUserId === "") return true;
  return buyerUserId === String(userId);
}
