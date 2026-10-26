import { beforeEach, describe, expect, it, vi } from "vitest";
import { courtApi, type CourtCase } from "./court.api";
import {
  canApplyCourtReviewer,
  courtVoteUnavailableReason,
  isCourtReviewerApproved,
  submitCourtVote,
} from "./court-vote";

const session = vi.hoisted(() => ({ accessToken: "viewer-token" as string | null }));
vi.mock("@esports/auth", () => ({ useAuthStore: { getState: () => session } }));
vi.mock("./court.api", () => ({
  courtApi: { getReviewerStatus: vi.fn(), getDetail: vi.fn(), vote: vi.fn() },
}));

const activeCase: CourtCase = { caseId: 42, stage: "VOTING", level: "FIRST", actions: [] };

beforeEach(() => {
  vi.resetAllMocks();
  session.accessToken = "viewer-token";
  vi.mocked(courtApi.getReviewerStatus).mockResolvedValue({ pageStatus: "APPROVED" });
  vi.mocked(courtApi.getDetail).mockResolvedValue({ ...activeCase, actions: ["VOTE"] });
});

describe("App voting and reviewer certification", () => {
  it("keeps the active vote entry available without VOTE permission and prompts a non-reviewer", async () => {
    vi.mocked(courtApi.getReviewerStatus).mockResolvedValue({ pageStatus: "CAN_APPLY" });
    expect(courtVoteUnavailableReason(activeCase)).toBeNull();
    expect(await submitCourtVote(activeCase, "PLAINTIFF_WIN")).toMatchObject({ type: "reviewer-required" });
    expect(courtApi.getDetail).not.toHaveBeenCalled();
    expect(courtApi.vote).not.toHaveBeenCalled();
  });

  it("refreshes qualification and case permissions after approval without reusing cached denial", async () => {
    vi.mocked(courtApi.getReviewerStatus)
      .mockResolvedValueOnce({ pageStatus: "PENDING" })
      .mockResolvedValueOnce({ pageStatus: "APPROVED" });
    expect(await submitCourtVote(activeCase, "DEFENDANT_WIN")).toMatchObject({ type: "reviewer-required" });
    expect(courtApi.vote).not.toHaveBeenCalled();
    expect(await submitCourtVote(activeCase, "DEFENDANT_WIN")).toMatchObject({ type: "voted" });
    expect(courtApi.getReviewerStatus).toHaveBeenCalledTimes(2);
    expect(courtApi.vote).toHaveBeenCalledExactlyOnceWith(42, "FIRST", "DEFENDANT_WIN");
  });

  it("reports a status lookup failure instead of treating it as missing qualification", async () => {
    vi.mocked(courtApi.getReviewerStatus).mockRejectedValue(new Error("网络异常"));
    await expect(submitCourtVote(activeCase, "PLAINTIFF_WIN")).rejects.toThrow("网络异常");
    expect(courtApi.vote).not.toHaveBeenCalled();
  });

  it("still respects backend case-specific voting permission for an approved reviewer", async () => {
    vi.mocked(courtApi.getDetail).mockResolvedValue(activeCase);
    await expect(submitCourtVote(activeCase, "PLAINTIFF_WIN")).rejects.toThrow("当前账号无法参与此案件的投票");
    expect(courtApi.vote).not.toHaveBeenCalled();
  });

  it.each([
    [{ stage: "EVIDENCE" }, "当前案件不在评审投票阶段"],
    [{ stage: "CLOSED" }, "已过评审时效，无法投票"],
    [{ stage: "JUDGED" }, "已过评审时效，无法投票"],
    [{ myVoteResult: "PLAINTIFF_WIN" }, "您已投票，无法重复支持"],
    [{ voteDeadline: "2020-01-01T00:00:00+08:00" }, "已过评审时效，无法投票"],
  ] as const)("rejects a case that became unavailable since the list loaded: %j", async (change, message) => {
    vi.mocked(courtApi.getDetail).mockResolvedValue({ ...activeCase, actions: ["VOTE"], ...change });
    await expect(submitCourtVote(activeCase, "PLAINTIFF_WIN")).rejects.toThrow(message);
    expect(courtApi.vote).not.toHaveBeenCalled();
  });

  it.each([
    [{ myVoteResult: "PLAINTIFF_WIN" }, "您已投票，无法重复支持"],
    [{ myVoteResult: "DEFENDANT_WIN" }, "您已投票，无法重复支持"],
    [{ stage: "CLOSED", myVoteResult: "PLAINTIFF_WIN" }, "您已投票，无法重复支持"],
    [{ stage: "JUDGED" }, "已过评审时效，无法投票"],
    [{ stage: "CLOSED" }, "已过评审时效，无法投票"],
    [{ voteDeadline: "2020-01-01T00:00:00+08:00" }, "已过评审时效，无法投票"],
  ] as const)("explains an unavailable vote without submitting any request: %j", async (change, message) => {
    await expect(submitCourtVote({ ...activeCase, ...change }, "DEFENDANT_WIN"))
      .rejects.toThrow(message);
    expect(courtApi.getReviewerStatus).not.toHaveBeenCalled();
    expect(courtApi.getDetail).not.toHaveBeenCalled();
    expect(courtApi.vote).not.toHaveBeenCalled();
  });

  it("rejects a vote at the exact deadline but allows it immediately before", () => {
    const deadline = "2026-10-22T12:00:00+08:00";
    const item = { ...activeCase, voteDeadline: deadline };
    expect(courtVoteUnavailableReason(item, Date.parse(deadline) - 1)).toBeNull();
    expect(courtVoteUnavailableReason(item, Date.parse(deadline))).toBe("已过评审时效，无法投票");
  });

  it("does not start a vote or reviewer lookup on an evidence-stage case", async () => {
    await expect(submitCourtVote({ ...activeCase, stage: "EVIDENCE" }, "PLAINTIFF_WIN"))
      .rejects.toThrow("当前案件不在评审投票阶段");
    expect(courtApi.getReviewerStatus).not.toHaveBeenCalled();
    expect(courtApi.vote).not.toHaveBeenCalled();
  });

  it("does not cast a vote under another account if the session changes during validation", async () => {
    vi.mocked(courtApi.getDetail).mockImplementation(async () => {
      session.accessToken = "different-viewer-token";
      return { ...activeCase, actions: ["VOTE"] };
    });
    await expect(submitCourtVote(activeCase, "PLAINTIFF_WIN")).rejects.toThrow("登录状态已变化");
    expect(courtApi.vote).not.toHaveBeenCalled();
  });

  it("requires login before requesting reviewer data", async () => {
    session.accessToken = null;
    await expect(submitCourtVote(activeCase, "PLAINTIFF_WIN")).rejects.toThrow("请先登录");
    expect(courtApi.getReviewerStatus).not.toHaveBeenCalled();
  });

  it("uses the authoritative page status when application status still contains a previous approval", () => {
    expect(isCourtReviewerApproved({ pageStatus: "REJECTED", status: "APPROVED" })).toBe(false);
    expect(isCourtReviewerApproved({ status: "APPROVED" })).toBe(true);
  });
});

describe("reviewer application requirements", () => {
  const eligible = { pageStatus: "CAN_APPLY", realNameVerified: true, registrationPeriodSatisfied: true };
  it("requires both real-name verification and seven-day registration eligibility", () => {
    expect(canApplyCourtReviewer(null)).toBe(false);
    expect(canApplyCourtReviewer({ ...eligible, realNameVerified: false })).toBe(false);
    expect(canApplyCourtReviewer({ ...eligible, registrationPeriodSatisfied: false })).toBe(false);
    expect(canApplyCourtReviewer(eligible)).toBe(true);
  });
  it("prevents duplicate applications while pending or approved and supports reapplying after rejection", () => {
    expect(canApplyCourtReviewer({ ...eligible, pageStatus: "PENDING" })).toBe(false);
    expect(canApplyCourtReviewer({ ...eligible, pageStatus: "APPROVED" })).toBe(false);
    expect(canApplyCourtReviewer({ ...eligible, pageStatus: "REJECTED" })).toBe(true);
  });
});
