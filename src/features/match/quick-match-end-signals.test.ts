import { beforeEach, describe, expect, it } from "vitest";

import { useQuickMatchEndSignals } from "./quick-match-end-signals";

describe("useQuickMatchEndSignals", () => {
  beforeEach(() => {
    useQuickMatchEndSignals.setState({ signals: {} });
  });

  it("notifyEnded 写入信号", () => {
    useQuickMatchEndSignals.getState().notifyEnded("QM1", "expired");
    expect(useQuickMatchEndSignals.getState().signals.QM1).toBe("expired");
  });

  it("同 requestNo 覆盖写", () => {
    useQuickMatchEndSignals.getState().notifyEnded("QM1", "expired");
    useQuickMatchEndSignals.getState().notifyEnded("QM1", "cancelled");
    expect(useQuickMatchEndSignals.getState().signals.QM1).toBe("cancelled");
  });

  it("consume 读后清除", () => {
    useQuickMatchEndSignals.getState().notifyEnded("QM1", "expired");
    expect(useQuickMatchEndSignals.getState().consume("QM1")).toBe("expired");
    expect(useQuickMatchEndSignals.getState().signals.QM1).toBeUndefined();
  });

  it("重复 consume 幂等返回 undefined", () => {
    useQuickMatchEndSignals.getState().notifyEnded("QM1", "expired");
    useQuickMatchEndSignals.getState().consume("QM1");
    expect(useQuickMatchEndSignals.getState().consume("QM1")).toBeUndefined();
  });

  it("不存在的 requestNo 返回 undefined", () => {
    expect(useQuickMatchEndSignals.getState().consume("nope")).toBeUndefined();
  });
});
