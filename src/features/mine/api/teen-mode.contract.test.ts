import { describe, expect, it, vi } from "vitest";

import { createTeenModeApi } from "./teen-mode.contract";

type FakeResponse = {
  code: number | string;
  msg?: string;
  data?: unknown;
  success?: boolean;
};

// 实测（2026-10-29 真机抓包）：该接口实际返回字符串 code="SUCCESS" 的 R 包络
const SUCCESS_RESPONSE: FakeResponse = {
  success: true,
  code: "SUCCESS",
  msg: "操作成功",
};

function createFakeRequester(response: FakeResponse) {
  const calls = vi.fn(async (path: string, options: { method: "POST"; token?: string; body?: unknown }) => response);
  return {
    requester: calls as unknown as Parameters<typeof createTeenModeApi>[0],
    calls,
  };
}

describe("createTeenModeApi", () => {
  const TOKEN = "test-token";

  it("status：POST /client/v1/youth/status，action 空包络，返回 data（code 为字符串 SUCCESS）", async () => {
    const fake = createFakeRequester({
      ...SUCCESS_RESPONSE,
      data: { enabled: true, passwordSet: true, remainingAttempts: 3 },
    });
    const api = createTeenModeApi(fake.requester);
    const status = await api.status(TOKEN);
    expect(fake.calls).toHaveBeenCalledWith(
      "/client/v1/youth/status",
      expect.objectContaining({ method: "POST", token: TOKEN, body: { action: {} } }),
    );
    expect(status).toEqual({ enabled: true, passwordSet: true, remainingAttempts: 3 });
  });

  it("容错：数字 code 0 同样视为成功", async () => {
    const fake = createFakeRequester({
      code: 0,
      data: { enabled: false, passwordSet: false, remainingAttempts: 10 },
    });
    const api = createTeenModeApi(fake.requester);
    await expect(api.status(TOKEN)).resolves.toEqual({
      enabled: false,
      passwordSet: false,
      remainingAttempts: 10,
    });
  });

  it("open：首次开启带 password+confirmPassword", async () => {
    const fake = createFakeRequester({ code: 0, data: { enabled: true, passwordSet: true, remainingAttempts: 10 } });
    const api = createTeenModeApi(fake.requester);
    await api.open(TOKEN, "1234", "1234");
    expect(fake.calls).toHaveBeenCalledWith(
      "/client/v1/youth/open",
      expect.objectContaining({
        body: { action: { password: "1234", confirmPassword: "1234" } },
      }),
    );
  });

  it("close：只带 password", async () => {
    const fake = createFakeRequester({ code: 0, data: { enabled: false, passwordSet: true, remainingAttempts: 10 } });
    const api = createTeenModeApi(fake.requester);
    await api.close(TOKEN, "9999");
    expect(fake.calls).toHaveBeenCalledWith(
      "/client/v1/youth/close",
      expect.objectContaining({ body: { action: { password: "9999" } } }),
    );
  });

  it("setPassword：修改时带 oldPassword", async () => {
    const fake = createFakeRequester({ code: 0, data: { enabled: false, passwordSet: true, remainingAttempts: 10 } });
    const api = createTeenModeApi(fake.requester);
    await api.setPassword(TOKEN, { oldPassword: "1111", password: "2222", confirmPassword: "2222" });
    expect(fake.calls).toHaveBeenCalledWith(
      "/client/v1/youth/password",
      expect.objectContaining({
        body: { action: { oldPassword: "1111", password: "2222", confirmPassword: "2222" } },
      }),
    );
  });

  it("code 非 0 时抛出服务端 msg", async () => {
    const fake = createFakeRequester({ code: 500, msg: "密码有误，今日还剩3次机会！" });
    const api = createTeenModeApi(fake.requester);
    await expect(api.close(TOKEN, "0000")).rejects.toThrow("密码有误，今日还剩3次机会！");
  });

  it("成功但 data 缺失时视为业务错误", async () => {
    const fake = createFakeRequester({ code: 0, msg: "success" });
    const api = createTeenModeApi(fake.requester);
    await expect(api.status(TOKEN)).rejects.toThrow();
  });
});
