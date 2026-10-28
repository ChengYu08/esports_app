import { describe, expect, it } from "vitest";

import {
  canSubmitRealName,
  isValidIdCard,
  normalizeIdCard,
  realNameFailureMessage,
} from "./real-name";

describe("normalizeIdCard", () => {
  it("去除首尾空白并转大写", () => {
    expect(normalizeIdCard(" 11010119900307512x ")).toBe("11010119900307512X");
  });

  it("全角数字转半角", () => {
    expect(normalizeIdCard("１１０１０１１９９００３０７５１２")).toBe(
      "11010119900307512",
    );
  });

  it("去除内嵌空格", () => {
    expect(normalizeIdCard("110101 19900307 5124")).toBe("110101199003075124");
  });
});

describe("isValidIdCard", () => {
  it("17 位数字加末位数字通过", () => {
    expect(isValidIdCard("110101199003075124")).toBe(true);
  });

  it("末位 X 通过", () => {
    expect(isValidIdCard("11010119900307512X")).toBe(true);
  });

  it("长度不足 18 位不通过", () => {
    expect(isValidIdCard("1101011990030751")).toBe(false);
  });

  it("含非数字字符（末位 X 除外）不通过", () => {
    expect(isValidIdCard("11010119O0030751X")).toBe(false);
  });

  it("仅校验格式，出生日期真实性由后端核验", () => {
    expect(isValidIdCard("123456789012345678")).toBe(true);
  });
});

describe("canSubmitRealName", () => {
  it("姓名非空且身份证格式合法时可提交", () => {
    expect(canSubmitRealName("辛弃疾", "110101199003075124")).toBe(true);
  });

  it("姓名为空白时不可提交", () => {
    expect(canSubmitRealName("   ", "110101199003075124")).toBe(false);
  });

  it("身份证格式非法时不可提交", () => {
    expect(canSubmitRealName("辛弃疾", "123")).toBe(false);
  });

  it("小写 x 身份证归一化后可提交", () => {
    expect(canSubmitRealName("辛弃疾", "11010119900307512x")).toBe(true);
  });
});

describe("realNameFailureMessage", () => {
  it("优先取 Error 的 message（即接口 info 字段）", () => {
    expect(realNameFailureMessage(new Error("姓名与身份证不匹配"))).toBe(
      "姓名与身份证不匹配",
    );
  });

  it("message 为空时回退默认文案", () => {
    expect(realNameFailureMessage(new Error(""))).toBe("认证失败，请稍后重试");
  });

  it("非 Error 抛出时回退默认文案", () => {
    expect(realNameFailureMessage("boom")).toBe("认证失败，请稍后重试");
  });
});
