const SYSTEM_CONVERSATION_IDS = {
  platform: "50000000",
  dispatch: "50000001",
  order: "50000002",
} as const;

const SYSTEM_TITLES: Record<string, string> = {
  [SYSTEM_CONVERSATION_IDS.platform]: "平台通知",
  [SYSTEM_CONVERSATION_IDS.dispatch]: "派单助手",
  [SYSTEM_CONVERSATION_IDS.order]: "订单助手",
};

function rawSystemId(value: string) {
  return value.trim().replace(/^rc_p_/, "");
}

export function isSystemConversationId(value: string | undefined | null): boolean {
  return Boolean(value && SYSTEM_TITLES[rawSystemId(String(value))]);
}

export function normalizeSystemConversationId(value: string): string {
  const raw = rawSystemId(value);
  return SYSTEM_TITLES[raw] ? `rc_p_${raw}` : value;
}

export function getRongConversationTargetId(value: string): string {
  const raw = rawSystemId(value);
  return SYSTEM_TITLES[raw] ? raw : value;
}

export function getSystemConversationTitle(value: string, fallback = "消息"): string {
  return SYSTEM_TITLES[rawSystemId(value)] || fallback;
}

