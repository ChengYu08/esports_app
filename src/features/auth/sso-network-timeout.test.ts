import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SsoClient } from "../../../packages/sso-sdk/src/client";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("axios", () => ({
  default: { create: () => ({ request }) },
  isAxiosError: () => false,
}));

beforeEach(() => {
  vi.useFakeTimers();
  request.mockReset().mockResolvedValue({ status: 200, data: { code: "SUCCESS" } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("登录前时间同步的网络超时", () => {
  it("同步成功后复用时间偏移，并清理超时定时器", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ data: Date.now() + 1000 }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = new SsoClient({ baseUrl: "https://example.invalid", clientAppId: "test", clientSecret: "test" });
    await Promise.all([client.request("/test"), client.request("/test")]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["连接不返回", "响应体不返回"])("%s 时仍能结束时间同步，并继续请求", async (scenario) => {
    const pending = new Promise(() => {});
    const fetchMock = vi.fn().mockReturnValue(scenario === "连接不返回"
      ? pending : Promise.resolve({ json: () => pending }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new SsoClient({ baseUrl: "https://example.invalid", clientAppId: "test", clientSecret: "test", timeoutMs: 100 });
    let settled = false;
    const result = client.request("/test").then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(101);
    expect(settled).toBe(true);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await result;
    await client.request("/test");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
