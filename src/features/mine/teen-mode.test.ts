import { describe, expect, it } from "vitest";

import {
  filterDigits,
  isPasswordComplete,
  isPasswordMatch,
} from "./teen-mode";

describe("filterDigits", () => {
  it("过滤非数字字符", () => {
    expect(filterDigits("1a2b三")).toBe("12");
  });

  it("最多保留 4 位", () => {
    expect(filterDigits("123456")).toBe("1234");
  });
});

describe("isPasswordComplete", () => {
  it("4 位数字时完整", () => {
    expect(isPasswordComplete("1234")).toBe(true);
  });

  it("不足 4 位不完整", () => {
    expect(isPasswordComplete("123")).toBe(false);
  });

  it("含非数字不完整", () => {
    expect(isPasswordComplete("12a4")).toBe(false);
  });
});

describe("isPasswordMatch", () => {
  it("两次输入一致且完整时匹配", () => {
    expect(isPasswordMatch("1234", "1234")).toBe(true);
  });

  it("不一致不匹配", () => {
    expect(isPasswordMatch("1234", "5678")).toBe(false);
  });

  it("第一次输入不完整不匹配", () => {
    expect(isPasswordMatch("123", "123")).toBe(false);
  });
});
