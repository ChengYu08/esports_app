import { useAuthStore } from "@esports/auth";
import { courtApi, type CourtCase, type CourtReviewerStatus } from "./court.api";

export function isCourtReviewerApproved(status: CourtReviewerStatus) {
  return (status.pageStatus || status.status || "").toUpperCase() === "APPROVED";
}

export function canApplyCourtReviewer(status: CourtReviewerStatus | null) {
  if (!status?.realNameVerified || !status.registrationPeriodSatisfied) {
    return false;
  }
  const state = (status.pageStatus || status.status || "").toUpperCase();
  return ["", "UNAPPLIED", "CAN_APPLY", "REJECTED"].includes(state);
}

export function courtVoteUnavailableReason(item: CourtCase, now = Date.now()): string | null {
  if (item.myVoteResult) {
    return "您已投票，无法重复支持";
  }
  if (item.stage === "JUDGED" || item.stage === "CLOSED") {
    return "已过评审时效，无法投票";
  }
  if (item.stage !== "VOTING") {
    return "当前案件不在评审投票阶段";
  }
  const deadline = item.voteDeadline ? Date.parse(item.voteDeadline.replace(" ", "T")) : NaN;
  if (Number.isFinite(deadline) && deadline <= now) {
    return "已过评审时效，无法投票";
  }
  return null;
}

/** App 投票入口可供非评委点击；先引导认证，通过后再检查案件操作权限。 */
export async function submitCourtVote(item: CourtCase, side: "PLAINTIFF_WIN" | "DEFENDANT_WIN") {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    throw new Error("请先登录");
  }
  function assertSession() {
    if (useAuthStore.getState().accessToken !== token) {
      throw new Error("登录状态已变化，请重新点击投票");
    }
  }

  const reason = courtVoteUnavailableReason(item);
  if (reason) {
    throw new Error(reason);
  }
  // 每次点击读取最新资格，避免申请/审核后仍被页面缓存的非评委状态拦截。
  const reviewerStatus = await courtApi.getReviewerStatus();
  assertSession();
  if (!isCourtReviewerApproved(reviewerStatus)) {
    return { type: "reviewer-required" as const, reviewerStatus };
  }

  const latest = await courtApi.getDetail(item.caseId);
  assertSession();
  const latestReason = courtVoteUnavailableReason(latest);
  if (latestReason) {
    throw new Error(latestReason);
  }
  if (!latest.actions?.includes("VOTE")) {
    throw new Error("当前账号无法参与此案件的投票");
  }
  await courtApi.vote(latest.caseId, latest.level || "FIRST", side);
  return { type: "voted" as const, reviewerStatus };
}
