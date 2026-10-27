import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiClient } from "@/core/network/api-client";
import {
  CUSTOMER_SERVICE_BUSY_TEXT,
  createCustomerServiceChatParams,
  enterCustomerService,
  resolveCustomerServiceError,
  touchCustomerServiceSession,
} from "./customer-service.api";

vi.mock("@/core/network/api-client", () => ({
  apiClient: vi.fn(),
  ApiError: class extends Error {
    constructor(message: string, public status: number, public code?: string) {
      super(message);
    }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("customer service entry", () => {
  it("requests an assigned agent with the logged-in user's business token", async () => {
    const session = { sessionNo: "CS-1", imTargetId: "42", agentNickname: "小盼" };
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: session });

    expect(await enterCustomerService("business-token")).toEqual(session);
    expect(apiClient).toHaveBeenCalledWith("/client/v1/cs/enter", {
      method: "POST", token: "business-token", body: {},
    });
    expect(createCustomerServiceChatParams(session)).toEqual({
      id: "42", title: "【官方客服】小盼", customerService: "1",
    });
  });

  it("prefers the IM target and falls back to the agent user ID", () => {
    expect(createCustomerServiceChatParams({ imTargetId: 42, agentUserId: 99 }).id).toBe("42");
    expect(createCustomerServiceChatParams({ agentUserId: 99 }).id).toBe("99");
  });

  it("does not navigate without a target, including queued sessions without an agent", () => {
    expect(() => createCustomerServiceChatParams({ status: "QUEUED", queued: true }))
      .toThrow("未获取到客服会话目标");
  });

  it("respects the server badge setting and never repeats the official prefix", () => {
    expect(createCustomerServiceChatParams({ imTargetId: 42, agentNickname: "小盼", agentBadge: false }).title)
      .toBe("小盼");
    expect(createCustomerServiceChatParams({ imTargetId: 42, agentNickname: "【官方客服】小盼" }).title)
      .toBe("【官方客服】小盼");
    expect(createCustomerServiceChatParams({ imTargetId: 42 }, "已有客服昵称").title)
      .toBe("【官方客服】已有客服昵称");
  });

  it.each(["CS_NO_AGENT_ONLINE", "CS_AGENT_NOT_FOUND", "CS_SESSION_CONFLICT"])(
    "uses the same busy message as Web for %s",
    async (code) => {
      vi.mocked(apiClient).mockResolvedValue({ code, info: "backend detail" });
      const error = await enterCustomerService("token").catch((failure: unknown) => failure);
      expect(resolveCustomerServiceError(error)).toBe(CUSTOMER_SERVICE_BUSY_TEXT);
    },
  );

  it("keeps actionable server and network error messages", () => {
    expect(resolveCustomerServiceError(new ApiError("请先实名认证", 200, "REAL_NAME_REQUIRED")))
      .toBe("请先实名认证");
    expect(resolveCustomerServiceError(new Error("网络连接失败"))).toBe("网络连接失败");
    expect(resolveCustomerServiceError(null)).toBe(CUSTOMER_SERVICE_BUSY_TEXT);
  });

  it("rejects a successful response that has no session", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: null });
    await expect(enterCustomerService("token")).rejects.toThrow(CUSTOMER_SERVICE_BUSY_TEXT);
  });

  it("refreshes activity with the same endpoint as Web, allowing an empty success payload", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: null });
    await expect(touchCustomerServiceSession("token")).resolves.toBeUndefined();
    expect(apiClient).toHaveBeenCalledWith("/client/v1/cs/session/touch", {
      method: "POST", token: "token", body: {},
    });
  });
});
