import { beforeEach, describe, expect, it } from "vitest";

import { useQuickMatchNoticeBar } from "./quick-match-invite-bar-store";

describe("useQuickMatchNoticeBar", () => {
  beforeEach(() => {
    useQuickMatchNoticeBar.setState({ invite: null });
  });

  it("show 写入 invite，dismiss 清空", () => {
    const invite = {
      key: "qm:QM1",
      requestNo: "QM1",
      text: "「老板A」发布 王者荣耀·上分 需求",
      expireAt: Date.now() + 30_000,
    };
    useQuickMatchNoticeBar.getState().show(invite);
    expect(useQuickMatchNoticeBar.getState().invite).toEqual(invite);

    useQuickMatchNoticeBar.getState().dismiss();
    expect(useQuickMatchNoticeBar.getState().invite).toBeNull();
  });

  it("show 覆盖旧 invite", () => {
    useQuickMatchNoticeBar.getState().show({
      key: "qm:QM1",
      requestNo: "QM1",
      text: "a",
      expireAt: 1,
    });
    useQuickMatchNoticeBar.getState().show({
      key: "qm:QM2",
      requestNo: "QM2",
      text: "b",
      expireAt: 2,
    });
    expect(useQuickMatchNoticeBar.getState().invite?.requestNo).toBe("QM2");
  });
});
