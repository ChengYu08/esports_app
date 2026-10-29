import { describe, expect, it } from "vitest";

import { validateSignature } from "./signature-rules";

describe("validateSignature", () => {
  it("空串通过（表示清空简介）", () => {
    expect(validateSignature("")).toBeNull();
  });

  it("恰好 100 字符通过", () => {
    expect(validateSignature("a".repeat(100))).toBeNull();
  });

  it("超过 100 字符返回长度提示（按字符计，emoji 计 1）", () => {
    expect(validateSignature("a".repeat(101))).toBe(
      "简介内容不能超过100字",
    );
    expect(validateSignature("😊".repeat(101))).toBe(
      "简介内容不能超过100字",
    );
  });
});
