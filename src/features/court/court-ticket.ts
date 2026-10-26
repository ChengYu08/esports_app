import { useAuthStore } from "@esports/auth";
import { courtApi, makeIdempotencyKey, type TicketInput, type TicketTarget } from "./court.api";

export const TICKET_REASONS = [
  ["RULE_VIOLATION", "违反平台规定"],
  ["ORDER_DISPUTE", "订单纠纷"],
  ["CHAT_DISPUTE", "聊天纠纷"],
  ["OTHER", "其他"],
  ["PLATFORM_SUGGESTION", "平台建议"],
] as const;

export type TicketDraft = {
  reasonType: string;
  target: TicketTarget | null;
  content: string;
  agreed: boolean;
};

export function ticketDraftError(draft: TicketDraft): string | null {
  if (!TICKET_REASONS.some(([code]) => code === draft.reasonType)) {
    return "请选择诉求类型";
  }
  if (draft.reasonType !== "PLATFORM_SUGGESTION" && !draft.target?.id?.trim()) {
    return "请选择诉告对象";
  }
  if (!draft.content.trim()) {
    return "请填写投诉内容";
  }
  if (draft.content.length > 1000) {
    return "投诉内容不能超过1000字";
  }
  if (!draft.agreed) {
    return "请先阅读并同意《小法庭用户使用守则》";
  }
  return null;
}

export function ticketInput(draft: TicketDraft, evidenceObjectKeys: string[]): TicketInput {
  const error = ticketDraftError(draft);
  if (error) {
    throw new Error(error);
  }
  if (evidenceObjectKeys.length > 9) {
    throw new Error("最多上传9张证据截图");
  }
  return {
    reasonType: draft.reasonType,
    ...(draft.reasonType !== "PLATFORM_SUGGESTION" ? { targetUid: draft.target!.id } : {}),
    content: draft.content.trim(),
    evidenceObjectKeys,
  };
}

export async function searchTicketTargets(keyword: string, ownerToken: string, signal?: AbortSignal) {
  function checkSession() {
    if (signal?.aborted) {
      const error = new Error("搜索已取消");
      error.name = "AbortError";
      throw error;
    }
    if (!ownerToken || useAuthStore.getState().accessToken !== ownerToken) {
      throw new Error("登录状态已变化，请返回重新选择");
    }
  }
  checkSession();
  const search = keyword.trim();
  if (!search) {
    return [];
  }
  const result = await courtApi.searchTargets(search, signal);
  checkSession();
  // 接口返回的 id 可能是数字；统一转成字符串，保证选择和提交使用同一标识。
  const unique = new Map<string, TicketTarget>();
  for (const item of result) {
    if (item.id != null && String(item.id).trim()) {
      const id = String(item.id);
      unique.set(id, { ...item, id, nickname: item.nickname || `用户 ${id}` });
    }
  }
  return [...unique.values()];
}

export function highlightedParts(text: string, keyword: string) {
  const query = keyword.trim().toLocaleLowerCase();
  if (!query) {
    return [{ text, match: false }];
  }
  const normalized = text.toLocaleLowerCase();
  const parts: { text: string; match: boolean }[] = [];
  let cursor = 0;
  let index = normalized.indexOf(query);
  while (index !== -1) {
    if (index > cursor) {
      parts.push({ text: text.slice(cursor, index), match: false });
    }
    parts.push({ text: text.slice(index, index + query.length), match: true });
    cursor = index + query.length;
    index = normalized.indexOf(query, cursor);
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), match: false });
  }
  return parts;
}

// 网络结果不确定时，重试未修改的表单不能重复创建工单。
// 表单内容变化后才会生成新的服务端幂等键。
export function createTicketSubmitter() {
  let previousFingerprint = "";
  let key = "";
  let pending: ReturnType<typeof courtApi.createTicket> | null = null;
  return (input: TicketInput, ticketId?: string, retainedEvidenceKeys: string[] = []) => {
    if (pending) {
      return pending;
    }
    const fingerprint = JSON.stringify([useAuthStore.getState().accessToken, ticketId, input, retainedEvidenceKeys]);
    if (fingerprint !== previousFingerprint) {
      key = makeIdempotencyKey(ticketId ? "ticket-resubmit" : "ticket");
      previousFingerprint = fingerprint;
    }
    const payload = { ...input, idempotencyKey: key };
    pending = (ticketId
      ? courtApi.resubmitTicket(ticketId, payload, retainedEvidenceKeys)
      : courtApi.createTicket(payload)).finally(() => { pending = null; });
    return pending;
  };
}
