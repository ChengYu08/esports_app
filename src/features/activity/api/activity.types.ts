/** 秒杀活动详情类型（字段口径对齐 /client/v1/activity/detail 响应）。 */
export type ActivityButtonStatus =
  | "NOT_STARTED"
  | "ACTIVE"
  | "SOLD_OUT"
  | "ENDED"
  | "DISABLED";

export type ActivityProduct = {
  /** 原价（钻石） */
  originalPrice: number;
  /** 活动价（钻石） */
  activityPrice: number;
  /** 计价单位名，如"小时"/"局"/"次" */
  billingUnitName: string;
};

export type ActivityDetail = {
  activityId: string;
  activityCode: string;
  /** 活动角标文案，默认"活动" */
  displayTag: string;
  /** 主按钮文案，默认"立即参与" */
  actionText: string;
  mainTitle: string;
  subTitle: string;
  /** 服务端 jsoup 清洗过的活动规则 HTML */
  rules: string;
  startTime: string;
  endTime: string;
  /** 服务端当前时间（ISO-8601 带 +08:00），用于本地时钟校准 */
  serverTime: string;
  product: ActivityProduct;
  remainingStock: number;
  buttonStatus: ActivityButtonStatus;
  disabledReason?: string;
};

/** 参与活动（发布活动派单）结果。 */
export type ActivityPublishResult = {
  requestNo: string;
  roomId: string | null;
  roomVersion: number | null;
  expireTime: string;
};
