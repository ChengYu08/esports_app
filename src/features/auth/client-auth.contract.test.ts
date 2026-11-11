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

  it("keeps logout lenient when success carries no data", async () => {
    const api = createClientAuthContract(
      requesterWith({ success: true, code: "SUCCESS", info: "操作成功" }),
    );

    await expect(api.logout("token")).resolves.toBeUndefined();
  });

  it("cancelAccount 要求返回冷静期截止时间，缺失 data 时报错", async () => {
    const api = createClientAuthContract(
      requesterWith({ success: true, code: "SUCCESS", data: "2026-11-05 12:00:00" }),
    );

    await expect(api.cancelAccount("token", "123456")).resolves.toBe("2026-11-05 12:00:00");
    await expect(
      createClientAuthContract(requesterWith({ success: true, code: "SUCCESS", info: "操作成功" }))
        .cancelAccount("token", "123456"),
    ).rejects.toThrow("响应数据缺失，请稍后重试");
  });

  it("propagates business errors with the server message", async () => {
    const api = createClientAuthContract(
      requesterWith({ success: false, code: "FAIL", info: "令牌已过期" }),
    );

    await expect(api.fetchCurrentUser("token")).rejects.toThrow("令牌已过期");
  });

  it("getUserProfiles 占位实现循环调用单个资料接口", async () => {
    const requester = vi.fn(async (path: string) => {
      if (path === "/client/v1/user/profile/1") {
        return { success: true, code: "SUCCESS", data: { id: "1", nickname: "玩家一", headImage: "https://h/1.png" } };
      }
      return { success: true, code: "SUCCESS", data: { id: "2", nickname: "玩家二", headImage: "https://h/2.png" } };
    }) as unknown as AuthRequester;
    const api = createClientAuthContract(requester);

    const profiles = await api.getUserProfiles("token", ["1", "2"]);

    expect(profiles).toEqual([
      { id: "1", nickname: "玩家一", headImage: "https://h/1.png" },
      { id: "2", nickname: "玩家二", headImage: "https://h/2.png" },
    ]);
    expect(requester).toHaveBeenCalledWith("/client/v1/user/profile/1", { method: "POST", token: "token" });
    expect(requester).toHaveBeenCalledWith("/client/v1/user/profile/2", { method: "POST", token: "token" });
  });

  it("getUserProfiles 单个用户失败不影响其余用户", async () => {
    const requester = vi.fn(async (path: string) => {
      if (path === "/client/v1/user/profile/1") {
        return { success: false, code: "FAIL", info: "用户不存在" };
      }
      return { success: true, code: "SUCCESS", data: { id: "2", nickname: "玩家二", headImage: "" } };
    }) as unknown as AuthRequester;
    const api = createClientAuthContract(requester);

    await expect(api.getUserProfiles("token", ["1", "2"])).resolves.toEqual([
      { id: "2", nickname: "玩家二", headImage: "" },
    ]);
  });
});
