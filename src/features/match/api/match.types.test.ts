import { describe, expect, it } from "vitest";

import {
    applyGrabSelection,
    isActivityQuickMatch,
    isMultiCompanionRequest,
    isOwnActiveActivityRequest,
    pruneSelectedIds,
    resolveMaxSelectableCount,
    type QuickMatchGrabItem,
    type QuickMatchRequestDetail,
} from "./match.types";

function detail(
  overrides: Partial<QuickMatchRequestDetail> = {},
): QuickMatchRequestDetail {
  return {
    requestNo: "QM1",
    ...overrides,
  };
}

describe("isActivityQuickMatch", () => {
  it("activityCode 非空即活动模式", () => {
    expect(isActivityQuickMatch(detail({ activityCode: "SECKILL001" }))).toBe(
      true,
    );
  });

  it("activityCode 缺省或空串均为普通模式", () => {
    expect(isActivityQuickMatch(detail())).toBe(false);
    expect(isActivityQuickMatch(detail({ activityCode: "" }))).toBe(false);
    expect(isActivityQuickMatch(detail({ activityCode: "  " }))).toBe(false);
  });

  it("详情为空时视为普通模式", () => {
    expect(isActivityQuickMatch(null)).toBe(false);
    expect(isActivityQuickMatch(undefined)).toBe(false);
  });
});

describe("resolveMaxSelectableCount", () => {
  it("活动模式取 maxSelectableCount（秒杀=1）", () => {
    expect(
      resolveMaxSelectableCount(
        detail({ activityCode: "S1", maxSelectableCount: 1 }),
      ),
    ).toBe(1);
  });

  it("活动模式缺省 maxSelectableCount 时兜底单选 1", () => {
    expect(resolveMaxSelectableCount(detail({ activityCode: "S1" }))).toBe(1);
  });

  it("普通模式不输出 maxSelectableCount，维持 3 人多选上限", () => {
    expect(resolveMaxSelectableCount(detail())).toBe(3);
    expect(resolveMaxSelectableCount(null)).toBe(3);
  });
});

describe("applyGrabSelection", () => {
  it("活动单选：选 A 后选 B → 仅 B（点其他直接切换）", () => {
    const max = resolveMaxSelectableCount(
      detail({ activityCode: "S1", maxSelectableCount: 1 }),
    );
    const afterA = applyGrabSelection([], "A", max);
    expect(afterA).toEqual({ ids: ["A"], overLimit: false });
    const afterB = applyGrabSelection(afterA.ids, "B", max);
    expect(afterB).toEqual({ ids: ["B"], overLimit: false });
  });

  it("活动单选：再次点击已选中的人 → 取消选中", () => {
    expect(applyGrabSelection(["B"], "B", 1)).toEqual({
      ids: [],
      overLimit: false,
    });
  });

  it("普通模式多选：未达上限时追加", () => {
    expect(applyGrabSelection(["A"], "B", 3)).toEqual({
      ids: ["A", "B"],
      overLimit: false,
    });
    expect(applyGrabSelection(["A", "B", "C"], "A", 3)).toEqual({
      ids: ["B", "C"],
      overLimit: false,
    });
  });

  it("普通模式多选：达到 3 人上限时再选提示超限且选中不变", () => {
    expect(applyGrabSelection(["A", "B", "C"], "D", 3)).toEqual({
      ids: ["A", "B", "C"],
      overLimit: true,
    });
  });

  it("上限 >1 的活动配置：达到上限后再选提示超限而非静默替换", () => {
    expect(applyGrabSelection(["A", "B"], "C", 2)).toEqual({
      ids: ["A", "B"],
      overLimit: true,
    });
  });
});

describe("isMultiCompanionRequest（普通模式既有判定回归）", () => {
  it("companionPreference 缺失仍视为一陪多单", () => {
    expect(isMultiCompanionRequest(detail())).toBe(true);
    expect(isMultiCompanionRequest(detail({ companionPreference: 1 }))).toBe(
      false,
    );
  });
});

describe("isOwnActiveActivityRequest（语聊房「派单匹配中」判定）", () => {
  const activityUser = "1001";

  function activeActivity(
    overrides: Partial<QuickMatchRequestDetail> = {},
  ): QuickMatchRequestDetail {
    return detail({
      status: "MATCHING",
      publishSource: "ACTIVITY",
      buyerUserId: activityUser,
      ...overrides,
    });
  }

  it("进行中 + ACTIVITY + 本人 → true", () => {
    expect(isOwnActiveActivityRequest(activeActivity(), activityUser)).toBe(
      true,
    );
  });

  it("进行中 + ACTIVITY + buyerUserId 缺省（active/detail 仅返回本人需求）→ true", () => {
    expect(
      isOwnActiveActivityRequest(
        activeActivity({ buyerUserId: undefined }),
        activityUser,
      ),
    ).toBe(true);
  });

  it("他人需求（buyerUserId 与当前用户不一致）→ false", () => {
    expect(
      isOwnActiveActivityRequest(
        activeActivity({ buyerUserId: "2002" }),
        activityUser,
      ),
    ).toBe(false);
  });

  it("普通需求（publishSource 非 ACTIVITY 或缺省）→ false", () => {
    expect(
      isOwnActiveActivityRequest(
        activeActivity({ publishSource: "QUICK_MATCH" }),
        activityUser,
      ),
    ).toBe(false);
    expect(
      isOwnActiveActivityRequest(
        activeActivity({ publishSource: undefined }),
        activityUser,
      ),
    ).toBe(false);
  });

  it("publishSource 缺省但 activityCode 非空（与详情页判定同源）→ true", () => {
    expect(
      isOwnActiveActivityRequest(
        activeActivity({
          publishSource: undefined,
          activityCode: "SECKILL001",
        }),
        activityUser,
      ),
    ).toBe(true);
  });

  it("已结束（status 非 MATCHING）→ false", () => {
    expect(
      isOwnActiveActivityRequest(
        activeActivity({ status: "ORDERED" }),
        activityUser,
      ),
    ).toBe(false);
    expect(
      isOwnActiveActivityRequest(
        activeActivity({ status: "CANCELLED" }),
        activityUser,
      ),
    ).toBe(false);
  });

  it("已过期（expireTime 已过）→ false", () => {
    expect(
      isOwnActiveActivityRequest(
        activeActivity({ expireTime: "2020-01-01 00:00:00" }),
        activityUser,
      ),
    ).toBe(false);
  });

  it("active 为空或 userId 缺失 → false", () => {
    expect(isOwnActiveActivityRequest(null, activityUser)).toBe(false);
    expect(isOwnActiveActivityRequest(undefined, activityUser)).toBe(false);
    expect(isOwnActiveActivityRequest(activeActivity(), "")).toBe(false);
    expect(isOwnActiveActivityRequest(activeActivity(), undefined)).toBe(false);
  });
});

function grab(id: string): QuickMatchGrabItem {
  return { id, nickname: "大神", sex: 0 };
}

describe("pruneSelectedIds", () => {
  it("剔除已消失的候选人", () => {
    const candidates = [grab("g1"), grab("g3")];
    expect(pruneSelectedIds(["g1", "g2", "g3"], candidates)).toEqual([
      "g1",
      "g3",
    ]);
  });

  it("全部消失时清空选择", () => {
    expect(pruneSelectedIds(["g1", "g2"], [])).toEqual([]);
  });

  it("候选人齐全时保持原顺序", () => {
    const candidates = [grab("g2"), grab("g1")];
    expect(pruneSelectedIds(["g1", "g2"], candidates)).toEqual(["g1", "g2"]);
  });
});
