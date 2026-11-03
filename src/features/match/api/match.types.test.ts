import { describe, expect, it } from "vitest";

import {
  pruneSelectedIds,
  type QuickMatchGrabItem,
} from "./match.types";

function grab(id: string): QuickMatchGrabItem {
  return { id, nickname: "陪玩", sex: 0 };
}

describe("pruneSelectedIds", () => {
  it("剔除已消失的候选人", () => {
    const candidates = [grab("g1"), grab("g3")];
    expect(pruneSelectedIds(["g1", "g2", "g3"], candidates)).toEqual(["g1", "g3"]);
  });

  it("全部消失时清空选择", () => {
    expect(pruneSelectedIds(["g1", "g2"], [])).toEqual([]);
  });

  it("候选人齐全时保持原顺序", () => {
    const candidates = [grab("g2"), grab("g1")];
    expect(pruneSelectedIds(["g1", "g2"], candidates)).toEqual(["g1", "g2"]);
  });
});
