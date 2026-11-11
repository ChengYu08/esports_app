import { describe, expect, it, vi } from "vitest";

const { MockSeckillLandingView } = vi.hoisted(() => ({
  MockSeckillLandingView: function MockSeckillLandingView() {
    return null;
  },
}));

vi.mock("./seckill/SeckillLandingView", () => ({
  default: MockSeckillLandingView,
}));

import { resolveActivityTheme } from "./registry";

describe("resolveActivityTheme", () => {
  it("ESPORTS_2026_SECKILL 命中秒杀 Theme", () => {
    expect(resolveActivityTheme("ESPORTS_2026_SECKILL")).toBe(MockSeckillLandingView);
  });

  it("允许首尾空白后命中", () => {
    expect(resolveActivityTheme(" ESPORTS_2026_SECKILL ")).toBe(MockSeckillLandingView);
  });

  it("未知 code 返回 null", () => {
    expect(resolveActivityTheme("UNKNOWN_CODE")).toBeNull();
  });

  it("空串返回 null", () => {
    expect(resolveActivityTheme("")).toBeNull();
    expect(resolveActivityTheme("   ")).toBeNull();
  });
});
