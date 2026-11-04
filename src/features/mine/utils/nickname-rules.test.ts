import { describe, expect, it } from "vitest";

import { validateNickname } from "./nickname-rules";

describe("validateNickname", () => {
  it("空串返回长度提示", () => {
    expect(validateNickname("")).toBe("请设置2-20个字符");
  });

  it("1 个字符返回长度提示", () => {
    expect(validateNickname("a")).toBe("请设置2-20个字符");
  });

  it("21 个字符返回长度提示", () => {
    expect(validateNickname("一".repeat(21))).toBe("请设置2-20个字符");
  });

  it("2 个字符通过", () => {
    expect(validateNickname("ab")).toBeNull();
  });

  it("恰好 20 个字符通过", () => {
    expect(validateNickname("a".repeat(20))).toBeNull();
    expect(validateNickname("中文_name-1.测试")).toBeNull();
  });

  it("拒绝后端不支持的 emoji、制表符和中文标点", () => {
    expect(validateNickname("昵称😊")).toBe("不能包含@<>/等无效字符");
    expect(validateNickname("昵\t称")).toBe("不能包含@<>/等无效字符");
    expect(validateNickname("昵称！")).toBe("不能包含@<>/等无效字符");
  });

  it("拒绝系统注销保留后缀，但不误伤相似昵称", () => {
    expect(validateNickname("_已注销_123")).toBe("昵称不能使用系统注销保留格式");
    expect(validateNickname("玩家_已注销_1")).toBe("昵称不能使用系统注销保留格式");
    expect(validateNickname("abc_已注销_")).toBeNull();
    expect(validateNickname("_已注销_abc")).toBeNull();
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
    expect(validateNickname(" a ")).toBe("请设置2-20个字符");
  });

  it("字符合法性优先于长度校验", () => {
    expect(validateNickname("@")).toBe("不能包含@<>/等无效字符");
  });
});
