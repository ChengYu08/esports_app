import { AxiosError, CanceledError, type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./api-client";
import { apiAxios } from "./axios-instance";

vi.mock("@/core/config/env", () => ({ env: { apiBaseUrl: "https://example.invalid", referer: "https://example.invalid", ssoClientAppId: "test" } }));
vi.mock("@/core/logging/logger", () => ({ logger: { debug: vi.fn(), warn: vi.fn() } }));
const originalAdapter = apiAxios.defaults.adapter;
afterEach(() => { apiAxios.defaults.adapter = originalAdapter; });

describe("业务请求网络失败", () => {
  it.each(["ERR_NETWORK", "ECONNABORTED"])("%s 保留 15 秒超时配置并返回可展示错误", async (code) => {
    const adapter: AxiosAdapter = async (config) => {
      expect(config.timeout).toBe(15_000);
      throw new AxiosError("network failure", code, config);
    };
    apiAxios.defaults.adapter = adapter;
    await expect(apiClient("/test")).rejects.toMatchObject({ status: 0, message: "网络连接失败，请检查网络后重试" });
  });
  it("主动取消不误报网络错误", async () => {
    const cancellation = new CanceledError();
    apiAxios.defaults.adapter = async () => { throw cancellation; };
    await expect(apiClient("/test")).rejects.toBe(cancellation);
  });
});
