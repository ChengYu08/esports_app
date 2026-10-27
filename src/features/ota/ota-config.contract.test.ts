import { describe, expect, it, vi } from "vitest";

import {
  createOtaConfigContract,
  type OtaConfigRequester,
} from "./ota-config.contract";

function requesterWith(payload: unknown): OtaConfigRequester {
  return vi.fn(async () => payload) as unknown as OtaConfigRequester;
}

describe("ota config contract", () => {
  it("returns the raw config json text", async () => {
    const api = createOtaConfigContract(
      requesterWith({
        success: true,
        code: "SUCCESS",
        data: '{"version":2}',
      }),
    );

    await expect(api.fetchOtaConfig("pzdj_app_rn_update_config")).resolves.toBe(
      '{"version":2}',
    );
  });

  it("returns null when the success envelope omits data", async () => {
    const api = createOtaConfigContract(
      requesterWith({ success: true, code: "SUCCESS", info: "操作成功" }),
    );

    await expect(api.fetchOtaConfig("key")).resolves.toBeNull();
  });

  it("returns null when data is explicitly null", async () => {
    const api = createOtaConfigContract(
      requesterWith({ success: true, code: "SUCCESS", data: null }),
    );

    await expect(api.fetchOtaConfig("key")).resolves.toBeNull();
  });

  it("throws the business error with the server message", async () => {
    const api = createOtaConfigContract(
      requesterWith({ success: false, code: "FAIL", info: "服务繁忙" }),
    );

    await expect(api.fetchOtaConfig("key")).rejects.toThrow("服务繁忙");
  });

  it("propagates network errors", async () => {
    const requester = vi.fn(async () => {
      throw new Error("网络连接失败");
    }) as unknown as OtaConfigRequester;
    const api = createOtaConfigContract(requester);

    await expect(api.fetchOtaConfig("key")).rejects.toThrow("网络连接失败");
  });
});
