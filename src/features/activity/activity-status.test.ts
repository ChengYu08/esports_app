import { describe, expect, it } from "vitest";

import { computeActivityStatus } from "./activity-status";

const START_TIME = "2026-10-20T10:00:00+08:00";
const END_TIME = "2026-10-20T12:00:00+08:00";
const startMs = Date.parse(START_TIME);
const endMs = Date.parse(END_TIME);

function buildDetail(overrides: Partial<Parameters<typeof computeActivityStatus>[0]> = {}) {
  return {
    startTime: START_TIME,
    endTime: END_TIME,
    remainingStock: 5,
    buttonStatus: "ACTIVE" as const,
    ...overrides,
  };
}

describe("秒杀活动状态机", () => {
  it("开始时间之前为 NOT_STARTED", () => {
    const result = computeActivityStatus(buildDetail(), startMs - 1, 0);

    expect(result).toEqual({ status: "NOT_STARTED" });
  });

  it("now === startTime 算已开始", () => {
    const result = computeActivityStatus(buildDetail(), startMs, 0);

    expect(result).toEqual({ status: "ACTIVE" });
  });

  it("now === endTime 算未结束，仍为 ACTIVE", () => {
    const result = computeActivityStatus(buildDetail(), endMs, 0);

    expect(result).toEqual({ status: "ACTIVE" });
  });

  it("结束之后并入 NOT_STARTED 展示（ENDED 按 PC 约定不单独出状态）", () => {
    const result = computeActivityStatus(
      buildDetail({ buttonStatus: "ENDED" }),
      endMs + 1,
      0,
    );

    expect(result).toEqual({ status: "NOT_STARTED" });
  });

  it("库存为 0 时为 SOLD_OUT，优先于时间窗口内的 ACTIVE", () => {
    const result = computeActivityStatus(buildDetail({ remainingStock: 0 }), startMs + 1, 0);

    expect(result).toEqual({ status: "SOLD_OUT" });
  });

  it("负数库存同样判定为 SOLD_OUT", () => {
    const result = computeActivityStatus(buildDetail({ remainingStock: -3 }), startMs + 1, 0);

    expect(result).toEqual({ status: "SOLD_OUT" });
  });

  it("offset 校准：本地时钟慢 5 分钟时按服务端时间判定为 ACTIVE", () => {
    const offsetMs = 5 * 60 * 1000;
    const result = computeActivityStatus(buildDetail(), startMs - offsetMs, offsetMs);

    expect(result).toEqual({ status: "ACTIVE" });
  });

  it("offset 校准：本地时钟快 1 秒但服务端时间未到仍为 NOT_STARTED", () => {
    const result = computeActivityStatus(buildDetail(), startMs - 1, -1000);

    expect(result).toEqual({ status: "NOT_STARTED" });
  });

  it("DISABLED 优先于其他状态，并透出 disabledReason", () => {
    const result = computeActivityStatus(
      buildDetail({ buttonStatus: "DISABLED", disabledReason: "未实名认证" }),
      startMs + 1,
      0,
    );

    expect(result).toEqual({ status: "DISABLED", disabledReason: "未实名认证" });
  });

  it("DISABLED 未下发原因时给出兜底文案", () => {
    const result = computeActivityStatus(buildDetail({ buttonStatus: "DISABLED" }), startMs + 1, 0);

    expect(result).toEqual({ status: "DISABLED", disabledReason: "活动暂不可参与" });
  });

  it("时间字段非法时不误判窗口，按库存判定", () => {
    const result = computeActivityStatus(
      buildDetail({ startTime: "not-a-date", endTime: "" }),
      Date.now(),
      0,
    );

    expect(result).toEqual({ status: "ACTIVE" });
  });
});
