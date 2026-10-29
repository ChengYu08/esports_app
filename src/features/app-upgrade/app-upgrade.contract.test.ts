import { describe, expect, it, vi } from "vitest";

import {
  createAppUpgradeContract,
  type AppUpgradeRequester,
} from "./app-upgrade.contract";

function requesterWith(payload: unknown): AppUpgradeRequester {
  return vi.fn(async () => payload) as unknown as AppUpgradeRequester;
}

describe("app upgrade contract", () => {
  it("requests the public latest endpoint with platform and currentVersion", async () => {
    const requester = vi.fn(
      async () => ({ success: true, code: "SUCCESS", data: { versionNo: "1.1.0" } }),
    ) as unknown as AppUpgradeRequester;
    const api = createAppUpgradeContract(requester);

    await api.fetchLatestVersion("ANDROID", "1.0.0");

    expect(requester).toHaveBeenCalledWith(
      "/client/v1/desktopVersion/public/latest",
      {
        method: "GET",
        query: { platform: "ANDROID", currentVersion: "1.0.0" },
        timeoutMs: 5000,
      },
    );
  });

  it("returns the latest version payload", async () => {
    const data = {
      versionNo: "1.1.0",
      packageUrl: "https://oss.example.com/app.apk",
      updateContent: "修复已知问题",
      needForceUpdate: 1,
    };
    const api = createAppUpgradeContract(requesterWith({ success: true, code: "SUCCESS", data }));

    await expect(api.fetchLatestVersion("ANDROID", "1.0.0")).resolves.toEqual(data);
  });

  it("returns null when the success envelope omits data", async () => {
    const api = createAppUpgradeContract(
      requesterWith({ success: true, code: "SUCCESS", info: "操作成功" }),
    );

    await expect(api.fetchLatestVersion("ANDROID", "1.0.0")).resolves.toBeNull();
  });

  it("throws the business error with the server message", async () => {
    const api = createAppUpgradeContract(
      requesterWith({ success: false, code: "FAIL", info: "服务繁忙" }),
    );

    await expect(api.fetchLatestVersion("ANDROID", "1.0.0")).rejects.toThrow(
      "服务繁忙",
    );
  });

  it("propagates network errors", async () => {
    const requester = vi.fn(async () => {
      throw new Error("网络连接失败");
    }) as unknown as AppUpgradeRequester;
    const api = createAppUpgradeContract(requester);

    await expect(api.fetchLatestVersion("ANDROID", "1.0.0")).rejects.toThrow(
      "网络连接失败",
    );
  });
});
