import { describe, expect, it } from "vitest";

import {
  beginClubListScroll,
  initialClubListScrollState,
  markClubListEndReached,
  settleClubListScroll,
} from "./club-list-scroll";

describe("club-list-scroll 滚动期间的分页挂起状态", () => {
  it("静止时触底不产生挂起，分页应立即执行", () => {
    const next = markClubListEndReached(initialClubListScrollState);
    expect(next).toEqual({ scrolling: false, pendingEndReached: false });
  });

  it("滚动中触底记录挂起，不在惯性滚动期间触发分页", () => {
    const scrolling = beginClubListScroll(initialClubListScrollState);
    const next = markClubListEndReached(scrolling);
    expect(next).toEqual({ scrolling: true, pendingEndReached: true });
  });

  it("滚动稳定后清空挂起，由调用方在稳定时补发分页", () => {
    const pending = markClubListEndReached(
      beginClubListScroll(initialClubListScrollState),
    );
    const settled = settleClubListScroll(pending);
    expect(settled).toEqual({ scrolling: false, pendingEndReached: false });
  });

  it("连续快滑（再次 begin）不丢失已挂起的触底意图", () => {
    const pending = markClubListEndReached(
      beginClubListScroll(initialClubListScrollState),
    );
    const next = beginClubListScroll(pending);
    expect(next).toEqual({ scrolling: true, pendingEndReached: true });
  });
});
