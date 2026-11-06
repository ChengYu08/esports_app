import { afterEach, describe, expect, it } from "vitest";
// app.config.js 是 CJS，vitest 互操作后 default 即 module.exports
import appConfig, { deriveVersionCode } from "./app.config";

const baseConfig = {
  version: "1.0.0",
  ios: { bundleIdentifier: "com.test.app" },
} as never;

function callConfig() {
  return appConfig({ config: baseConfig }) as Record<string, any>;
}

describe("deriveVersionCode", () => {
  it.each([
    ["1.0.0", 10000],
    ["1.2.3", 10203],
    ["2.3.4", 20304],
  ])("%s → %i", (input, expected) => {
    expect(deriveVersionCode(input)).toBe(expected);
  });

  it.each([undefined, "", "1.0", "v1.0.0", "1.0.0-beta"])(
    "非法输入 %s 返回 null",
    (input) => {
      expect(deriveVersionCode(input as string)).toBeNull();
    },
  );
});

describe("app.config.js 版本同步", () => {
  afterEach(() => {
    delete process.env.APP_VERSION;
    delete process.env.APP_BUILD_NUMBER;
  });

  it("默认从 config.version 推导 android.versionCode 与 ios.buildNumber", () => {
    const result = callConfig();
    expect(result.version).toBe("1.0.0");
    expect(result.android.versionCode).toBe(10000);
    expect(result.ios.buildNumber).toBe("10000");
    // 透传原有字段
    expect(result.ios.bundleIdentifier).toBe("com.test.app");
  });

  it("APP_VERSION 覆盖后按覆盖值推导", () => {
    process.env.APP_VERSION = "2.3.4";
    const result = callConfig();
    expect(result.version).toBe("2.3.4");
    expect(result.android.versionCode).toBe(20304);
    expect(result.ios.buildNumber).toBe("20304");
  });

  it("APP_BUILD_NUMBER 优先于推导值，但只影响 iOS", () => {
    process.env.APP_VERSION = "2.3.4";
    process.env.APP_BUILD_NUMBER = "42";
    const result = callConfig();
    expect(result.ios.buildNumber).toBe("42");
    expect(result.android.versionCode).toBe(20304);
  });

  it("version 无法解析时不注入 android/ios 构建号", () => {
    const result = appConfig({
      config: { version: "not-a-semver" } as never,
    }) as Record<string, any>;
    expect(result.android).toBeUndefined();
    expect(result.ios?.buildNumber).toBeUndefined();
  });
});
