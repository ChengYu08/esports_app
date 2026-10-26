import { describe, expect, it, vi } from "vitest";

import { createClientAuthContract, type AuthRequester } from "./client-auth.contract";

function requesterWith(payload: unknown): AuthRequester {
  return vi.fn(async () => payload) as unknown as AuthRequester;
}

describe("client auth contract unwrap", () => {
  it("unwraps data for data-bearing endpoints", async () => {
    const api = createClientAuthContract(
      requesterWith({ success: true, code: "SUCCESS", data: { id: 9, nickname: "玩家" } }),
    );

    await expect(api.fetchCurrentUser("token")).resolves.toEqual({ id: 9, nickname: "玩家" });
  });

  it("throws when a data-bearing endpoint succeeds without data", async () => {
    const api = createClientAuthContract(
      requesterWith({ success: true, code: "SUCCESS", info: "操作成功" }),
    );

    await expect(api.fetchCurrentUser("token")).rejects.toThrow();
    await expect(api.getImToken("token")).rejects.toThrow();
    await expect(api.exchangeIdToken("id-token")).rejects.toThrow();
  });

  it("keeps void endpoints lenient when success carries no data", async () => {
    const api = createClientAuthContract(
      requesterWith({ success: true, code: "SUCCESS", info: "操作成功" }),
    );

    await expect(api.logout("token")).resolves.toBeUndefined();
    await expect(api.cancelAccount("token", "123456")).resolves.toBeUndefined();
  });

  it("propagates business errors with the server message", async () => {
    const api = createClientAuthContract(
      requesterWith({ success: false, code: "FAIL", info: "令牌已过期" }),
    );

    await expect(api.fetchCurrentUser("token")).rejects.toThrow("令牌已过期");
  });
});
