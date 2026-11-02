import type { PlatformTicket } from "./court.api";

export const TICKET_REASONS = [
  ["RULE_VIOLATION", "违反平台规定"],
  ["ORDER_DISPUTE", "订单纠纷"],
  ["CHAT_DISPUTE", "聊天纠纷"],
  ["OTHER", "其他"],
  ["PLATFORM_SUGGESTION", "平台建议"],
] as const;

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "已提交",
  REJECTED: "已驳回",
  PROCESSING: "处理中",
  TO_USER_REPLY: "待补充",
  RESOLVED: "已解决",
  CLOSED: "已关闭",
};

export function platformTicketReasonLabel(code?: string | null): string {
  return TICKET_REASONS.find(([value]) => value === code)?.[1] || code || "其他";
}

export function platformTicketStatusLabel(code?: string | null): string {
  return STATUS_LABELS[code || ""] || code || "已提交";
}

export function formatTicketTime(value?: string | null): string {
  return value ? value.replace("T", " ").slice(0, 19) : "-";
}

export type PlatformTicketTimelineMessage = {
  key: string;
  sender: string;
  content: string;
  time: string;
  mine: boolean;
  alignRight: boolean;
  system: boolean;
};

export function platformTicketMessages(
  ticket: PlatformTicket,
  mine: boolean,
  currentUserId?: string | number | null,
): PlatformTicketTimelineMessage[] {
  const viewerId = String(currentUserId ?? "");
  // 与 Web 一致：保持接口顺序；公开详情显示用户对话及标记为公开的回复。
  return (ticket.messageList ?? [])
    .filter((message) => mine || message.senderType === "USER" || message.visibility === "PUBLIC")
    .map((message, index) => {
      const userMessage = message.senderType === "USER";
      const ownMessage = userMessage && viewerId !== "" && String(message.senderId ?? "") === viewerId;
      const sender = message.senderType === "ADMIN"
        ? mine ? "官方客服" : "官方"
        : message.senderType === "USER"
          ? ownMessage ? "我" : message.senderName || "用户"
          : message.senderName || "系统";
      return {
        key: String(message.messageId ?? `${message.createdAt || "message"}-${index}`),
        sender,
        content: message.content || "",
        time: formatTicketTime(message.createdAt),
        mine: ownMessage,
        // 对话按发送方分列，本人身份仅用于姓名展示和补充权限。
        alignRight: userMessage,
        system: message.messageType === "SYSTEM" || message.senderType === "SYSTEM",
      };
    });
}

export function canReplyToPlatformTicket(
  ticket: PlatformTicket,
  mine: boolean,
  messages: PlatformTicketTimelineMessage[],
): boolean {
  return ticket.status === "TO_USER_REPLY" && (mine || messages.some((message) => message.mine));
}
