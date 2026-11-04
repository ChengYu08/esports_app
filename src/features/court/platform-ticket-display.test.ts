import { describe, expect, it } from "vitest";
import type { PlatformTicket } from "./court.api";
import {
  canReplyToPlatformTicket,
  formatTicketTime,
  platformTicketMessages,
  platformTicketReasonLabel,
  platformTicketStatusLabel,
} from "./platform-ticket-display";

describe("平台工单与 Web 的原因和状态展示一致", () => {
  it.each([
    ["RULE_VIOLATION", "违反平台规定"],
    ["ORDER_DISPUTE", "订单纠纷"],
    ["CHAT_DISPUTE", "聊天纠纷"],
    ["OTHER", "其他"],
    ["PLATFORM_SUGGESTION", "平台建议"],
    [undefined, "其他"],
    ["NEW_REASON", "NEW_REASON"],
  ])("将 %s 展示为 %s", (code, label) => {
    expect(platformTicketReasonLabel(code)).toBe(label);
  });

  it("保留工单状态和秒级时间", () => {
    expect(platformTicketStatusLabel("RESOLVED")).toBe("已解决");
    expect(platformTicketStatusLabel(undefined)).toBe("已提交");
    expect(platformTicketStatusLabel("NEW_STATUS")).toBe("NEW_STATUS");
    expect(formatTicketTime("2026-10-31T15:44:02")).toBe("2026-10-31 15:44:02");
    expect(formatTicketTime(undefined)).toBe("-");
  });
});

const ticket: PlatformTicket = {
  status: "TO_USER_REPLY",
  adminReply: "最新回复摘要，不应替代或重复追加到时间线",
  messageList: [
    { messageId: 1, senderType: "USER", senderId: 42, senderName: "投诉人", content: "态度不好，言语辱骂。", createdAt: "2026-10-31 15:10:42" },
    { messageId: 2, senderType: "ADMIN", visibility: "HIDDEN", content: "内部备注" },
    { messageId: 3, senderType: "ADMIN", visibility: "PUBLIC", content: "请补充说明", createdAt: "2026-10-31 15:12:00" },
    { messageId: 4, senderType: "USER", senderId: "42", content: "补充说明" },
    { messageId: 5, senderType: "SYSTEM", visibility: "PUBLIC", content: "工单处理中" },
    { messageId: 6, senderType: "ADMIN", messageType: "SYSTEM", visibility: "PUBLIC", content: "处理完成" },
    { messageId: 7, senderType: "ADMIN", content: "未公开的回复" },
  ],
};

describe("平台工单消息时间线", () => {
  it("公开详情保留用户对话和公开回复，不展示内部记录或重复追加摘要", () => {
    const messages = platformTicketMessages(ticket, false);
    expect(messages.map((message) => message.key)).toEqual(["1", "3", "4", "5", "6"]);
    expect(messages[0]).toMatchObject({ sender: "投诉人", mine: false, time: "2026-10-31 15:10:42" });
    expect(messages[1]).toMatchObject({ sender: "官方", content: "请补充说明" });
    expect(messages.filter((message) => message.system).map((message) => message.content)).toEqual(["工单处理中", "处理完成"]);
    expect(ticket.messageList).toHaveLength(7);
  });

  it.each([undefined, "someone-else", "42"])("观看者 %s 查看公开工单时，用户固定靠右、官方靠左，身份仍按本人判断", (viewerId) => {
    const messages = platformTicketMessages(ticket, false, viewerId);
    expect(messages.filter((message) => !message.system).map((message) => message.alignRight)).toEqual([true, false, true]);
    expect(messages[0]).toMatchObject({
      mine: viewerId === "42",
      sender: viewerId === "42" ? "我" : "投诉人",
    });
    expect(canReplyToPlatformTicket(ticket, false, messages)).toBe(viewerId === "42");
  });

  it("个人详情保留接口完整顺序，只有当前用户的消息标记为我", () => {
    const messages = platformTicketMessages(ticket, true, "42");
    expect(messages.map((message) => message.key)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(messages.filter((message) => message.mine).map((message) => message.key)).toEqual(["1", "4"]);
    expect(messages[0].sender).toBe("我");
    expect(messages[1].sender).toBe("官方客服");
    expect(platformTicketMessages(ticket, true, "another-user")[0]).toMatchObject({ sender: "投诉人", mine: false });
  });

  it("有相同发送者 ID 的官方消息不会当作当前用户的发言", () => {
    const messages = platformTicketMessages({ messageList: [{ senderType: "ADMIN", senderId: "42", visibility: "PUBLIC" }] }, false, "42");
    expect(messages[0]).toMatchObject({ mine: false, sender: "官方" });
  });

  it("缺少消息和发送者字段时保留空态与兜底身份", () => {
    expect(platformTicketMessages({}, false)).toEqual([]);
    expect(platformTicketMessages({ messageList: [{ senderType: "USER" }] }, false)[0]).toMatchObject({ sender: "用户", mine: false, time: "-" });
  });

  it("待补充工单允许本人从公开详情回复，其他人和游客只能查看", () => {
    expect(canReplyToPlatformTicket(ticket, false, platformTicketMessages(ticket, false, "42"))).toBe(true);
    expect(canReplyToPlatformTicket(ticket, false, platformTicketMessages(ticket, false, "someone-else"))).toBe(false);
    expect(canReplyToPlatformTicket(ticket, false, platformTicketMessages(ticket, false))).toBe(false);
    expect(canReplyToPlatformTicket(ticket, true, [])).toBe(true);
  });

  it.each(["RESOLVED", "CLOSED", "REJECTED", "PROCESSING"])("%s 状态不提供补充入口", (status) => {
    expect(canReplyToPlatformTicket({ ...ticket, status }, true, platformTicketMessages(ticket, true, "42"))).toBe(false);
  });
});
