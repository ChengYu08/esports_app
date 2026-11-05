import { describe, expect, it, vi } from "vitest";

import { createTeenModeApi } from "./teen-mode.contract";

type FakeResponse = {
  code: number | string;
  msg?: string;
  info?: string;
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
  const calls = vi.fn(async (path: string, options: { method: "POST" | "GET"; token?: string; body?: unknown }) => response);
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

  it("config：GET /client/v1/youth/config，返回锁定时段配置", async () => {
    const fake = createFakeRequester({
      code: 0,
      data: { lockEnabled: true, mode: "same-day", lockStartHour: 9, lockEndHour: 18 },
    });
    const api = createTeenModeApi(fake.requester);
    await expect(api.config(TOKEN)).resolves.toEqual({
      lockEnabled: true,
      mode: "same-day",
      lockStartHour: 9,
      lockEndHour: 18,
    });
    expect(fake.calls).toHaveBeenCalledWith(
      "/client/v1/youth/config",
      expect.objectContaining({ method: "GET", token: TOKEN }),
    );
  });

  it("code 非 0 时抛出服务端 msg", async () => {
    const fake = createFakeRequester({ code: 500, msg: "密码有误，今日还剩3次机会！" });
    const api = createTeenModeApi(fake.requester);
    await expect(api.close(TOKEN, "0000")).rejects.toThrow("密码有误，今日还剩3次机会！");
  });

  it("失败信封的错误文案在 info 字段（后端 R 包络）时也必须抛出原文案", async () => {
    // 实测后端 R.failed 的失败响应文案字段是 info（与全局 apiClient 读取口径一致），
    // 只有 msg 时会退化成「请求失败，请稍后重试」兜底文案
    const fake = createFakeRequester({ code: 1, info: "密码有误，今日还剩3次机会！" });
    const api = createTeenModeApi(fake.requester);
    await expect(api.close(TOKEN, "0000")).rejects.toThrow("密码有误，今日还剩3次机会！");
  });

  it("成功但 data 缺失时视为业务错误", async () => {
    const fake = createFakeRequester({ code: 0, msg: "success" });
    const api = createTeenModeApi(fake.requester);
    await expect(api.status(TOKEN)).rejects.toThrow();
  });
});
