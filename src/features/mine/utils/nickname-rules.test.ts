import { describe, expect, it } from "vitest";

import { validateNickname } from "./nickname-rules";

describe("validateNickname", () => {
  it("空串返回长度提示", () => {
    expect(validateNickname("")).toBe("请设置2-24个字符");
  });

  it("1 个字符返回长度提示", () => {
    expect(validateNickname("a")).toBe("请设置2-24个字符");
  });

  it("25 个字符返回长度提示（按字符计，emoji 计 1）", () => {
    expect(validateNickname("一".repeat(25))).toBe("请设置2-24个字符");
    expect(validateNickname("😊".repeat(25))).toBe("请设置2-24个字符");
  });

  it("2 个字符通过", () => {
    expect(validateNickname("ab")).toBeNull();
  });

  it("恰好 24 个字符（含 emoji）通过", () => {
    expect(validateNickname("a".repeat(24))).toBeNull();
    expect(validateNickname("😊".repeat(12) + "ab")).toBeNull();
  });

  it("包含 @ 返回无效字符提示", () => {
    expect(validateNickname("a@b")).toBe("不能包含@<>/等无效字符");
  });

  it("包含 < > / 返回无效字符提示", () => {
    expect(validateNickname("a<b>c")).toBe("不能包含@<>/等无效字符");
    expect(validateNickname("a/b")).toBe("不能包含@<>/等无效字符");
  });

  it("首尾空格不参与校验与长度", () => {
    expect(validateNickname("  ab  ")).toBeNull();
    expect(validateNickname(" a ")).toBe("请设置2-24个字符");
  });

  it("字符合法性优先于长度校验", () => {
    expect(validateNickname("@")).toBe("不能包含@<>/等无效字符");
  });
});
