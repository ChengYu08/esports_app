import { describe, expect, it } from "vitest";

import {
  computeFreeStarAmount,
  computeFreeUnitPrice,
  computeOrderPayableStars,
  parseHoursLive,
  sanitizeHoursText,
} from "./free-amount";

const order = {
  quantity: 4,
  unitPrice: "20",
  totalPrice: "80",
};

describe("computeOrderPayableStars", () => {
  it("未免单时保留实付款", () => {
    expect(computeOrderPayableStars({ totalPrice: "800" })).toBe(800);
  });

  it("部分免单后只收剩余金额", () => {
    expect(computeOrderPayableStars({ totalPrice: "800", freeAmount: "200" })).toBe(600);
  });

  it("全额免单与超额退款时应收金额为零", () => {
    expect(computeOrderPayableStars({ totalPrice: "800", freeAmount: "800" })).toBe(0);
    expect(computeOrderPayableStars({ totalPrice: "800", freeAmount: "900" })).toBe(0);
  });

  it("小数金额按星钻精度计算，无效金额不显示为 NaN", () => {
    expect(computeOrderPayableStars({ totalPrice: "9.99", freeAmount: "0.3" })).toBe(9.69);
    expect(computeOrderPayableStars({ totalPrice: "未知" })).toBe(0);
  });
});

describe("computeFreeUnitPrice", () => {
  it("优先使用单价", () => {
    expect(computeFreeUnitPrice(order)).toBe(20);
  });

  it("缺省单价时用总价除以时长", () => {
    expect(
      computeFreeUnitPrice({ quantity: 4, unitPrice: "", totalPrice: "100" }),
    ).toBe(25);
  });

  it("时长缺失时按 1 小时兜底", () => {
    expect(
      computeFreeUnitPrice({ quantity: 0, unitPrice: "", totalPrice: "30" }),
    ).toBe(30);
  });
});

describe("computeFreeStarAmount", () => {
  it("时长乘单价换算星钻", () => {
    expect(computeFreeStarAmount(order, 1.5)).toBe(30);
  });

  it("结果保留两位小数", () => {
    expect(computeFreeStarAmount(order, 0.3)).toBe(6);
    expect(
      computeFreeStarAmount(
        { quantity: 3, unitPrice: "9.99", totalPrice: "29.97" },
        2.5,
      ),
    ).toBe(24.98);
  });

  it("非正时长返回 null", () => {
    expect(computeFreeStarAmount(order, 0)).toBeNull();
    expect(computeFreeStarAmount(order, -1)).toBeNull();
  });
});

describe("parseHoursLive", () => {
  it("解析整数与一位小数", () => {
    expect(parseHoursLive("3")).toBe(3);
    expect(parseHoursLive("2.5")).toBe(2.5);
    expect(parseHoursLive(" 1.0 ")).toBe(1);
  });

  it("非法输入返回 null", () => {
    expect(parseHoursLive("")).toBeNull();
    expect(parseHoursLive(".")).toBeNull();
    expect(parseHoursLive("abc")).toBeNull();
    expect(parseHoursLive("1.25")).toBeNull();
  });
});

describe("sanitizeHoursText", () => {
  it("过滤非数字字符", () => {
    expect(sanitizeHoursText("1a2")).toBe("12");
    expect(sanitizeHoursText("12.")).toBe("12.");
  });

  it("只保留一个小数点且小数位最多一位", () => {
    expect(sanitizeHoursText("1.2.3")).toBe("1.2");
    expect(sanitizeHoursText("1.234")).toBe("1.2");
  });
});
