import { describe, expect, it } from "vitest";

import {
    multiCompanionNeedSelect,
    needsMultiCompanionSelect,
} from "./multi-companion";

describe("一单多陪开始服务选人判定", () => {
  it("普通单（非一单多陪）不需要选人", () => {
    expect(
      needsMultiCompanionSelect({
        multiCompanion: false,
        multiCompanionCount: 1,
        companions: [],
      }),
    ).toBe(false);
  });

  it("一单多陪且参与大神未选满时需要选人", () => {
    expect(
      needsMultiCompanionSelect({
        multiCompanion: true,
        multiCompanionCount: 3,
        companions: [],
      }),
    ).toBe(true);
    expect(
      needsMultiCompanionSelect({
        multiCompanion: true,
        multiCompanionCount: 3,
        companions: [{ userId: "2" }],
      }),
    ).toBe(true);
  });

  it("参与大神已选满（总人数 - 1）时不再选人", () => {
    expect(
      needsMultiCompanionSelect({
        multiCompanion: true,
        multiCompanionCount: 3,
        companions: [{ userId: "2" }, { userId: "3" }],
      }),
    ).toBe(false);
    expect(
      needsMultiCompanionSelect({
        multiCompanion: true,
        multiCompanionCount: 2,
        companions: [{ userId: "2" }],
      }),
    ).toBe(false);
  });

  it("多陪标记缺失或人数不足 2 时不弹选人", () => {
    expect(
      needsMultiCompanionSelect({
        multiCompanion: undefined,
        multiCompanionCount: 3,
        companions: [],
      }),
    ).toBe(false);
    expect(
      needsMultiCompanionSelect({
        multiCompanion: true,
        multiCompanionCount: 1,
        companions: [],
      }),
    ).toBe(false);
  });

  it("需选人数为总人数减一，至少 1", () => {
    expect(multiCompanionNeedSelect({ multiCompanionCount: 4 })).toBe(3);
    expect(multiCompanionNeedSelect({ multiCompanionCount: 2 })).toBe(1);
    expect(multiCompanionNeedSelect({})).toBe(1);
  });
});
