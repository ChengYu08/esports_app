import { describe, expect, it } from "vitest";
import { buildCourtProcessTimeline, type ProcessInput } from "./court-process-timeline";

const base: ProcessInput = {
  level: "FIRST", currentLevel: "FIRST", stageCode: "EVIDENCE",
  evidenceDeadline: "2026-10-24 15:26:41",
  timeline: [
    { level: "FIRST", eventType: "CASE_SUBMITTED", createdAt: "2026-10-23 15:26:30" },
    { level: "FIRST", eventType: "CASE_ACCEPTED", createdAt: "2026-10-23 15:26:41" },
    { level: "FIRST", eventType: "EVIDENCE_STARTED", createdAt: "2026-10-23 15:26:41" },
  ],
};

describe("判决流程", () => {
  it("举证中的案件展示完整四阶段，受理完成且举证高亮", () => {
    const steps = buildCourtProcessTimeline(base);
    expect(steps.map((step) => step.title)).toEqual(["案件受理", "举证阶段", "评审投票", "判决结果"]);
    expect(steps.map((step) => step.status)).toEqual(["done", "current", "pending", "pending"]);
    expect(steps[0].time).toBe("2026-10-23 15:26:41");
    expect(steps[1]).toMatchObject({ desc: "双方举证进行中", time: "截止于 2026-10-24 15:26:41", deadlineHighlight: true });
    expect(steps[2]).toMatchObject({ desc: "等待评审投票", time: "" });
    expect(steps[3]).toMatchObject({ desc: "等待判决结果", time: "" });
  });
  it("投票阶段使用投票截止时间", () => {
    const steps = buildCourtProcessTimeline({ ...base, stageCode: "VOTING", voteDeadline: "2026-10-25 12:00:00" });
    expect(steps.map((step) => step.status)).toEqual(["done", "done", "current", "pending"]);
    expect(steps[2].time).toBe("截止于 2026-10-25 12:00:00");
    expect(steps[1].deadlineHighlight).toBe(false);
  });
  it("已判决的案件所有节点完成，结果来自对应审级", () => {
    const steps = buildCourtProcessTimeline({ ...base, resultCode: "DEFENDANT_WIN", defendantName: "被告昵称", trialResults: [{ level: "FIRST", result: "PLAINTIFF_WIN", judgedAt: "判决时间" }], plaintiffName: "原告昵称" });
    expect(steps.every((step) => step.status === "done")).toBe(true);
    expect(steps[3]).toMatchObject({ desc: "本次裁决结果为原告@原告昵称 获胜", time: "判决时间" });
  });
  it("历史一审不串用当前二审的结果和截止时间", () => {
    const steps = buildCourtProcessTimeline({ ...base, currentLevel: "SECOND", resultCode: "DEFENDANT_WIN", trialResults: [{ level: "FIRST", result: "PLAINTIFF_WIN" }], timeline: [...base.timeline!, { level: "FIRST", eventType: "CASE_APPEALED", applicantParty: "DEFENDANT" }] });
    expect(steps[3].desc).toContain("被告已申请上诉");
    expect(steps.every((step) => !step.deadlineHighlight)).toBe(true);
  });
  it("二审从一审结束开始，展示申请方", () => {
    const steps = buildCourtProcessTimeline({ ...base, level: "SECOND", currentLevel: "SECOND", defendantName: "小李", timeline: [{ level: "FIRST", eventType: "CASE_APPEALED", applicantParty: "DEFENDANT", createdAt: "上诉时间" }] });
    expect(steps[0]).toMatchObject({ title: "一审结束", desc: "被告@小李申请二审，等待双方举证", time: "上诉时间", status: "done" });
  });
  it("三审走客服开庭流程，不展示评审投票", () => {
    const steps = buildCourtProcessTimeline({ ...base, level: "THIRD", currentLevel: "THIRD", stageCode: "HEARING" });
    expect(steps.map((step) => step.title)).toEqual(["二审结束", "确认开庭", "判决结果"]);
    expect(steps.map((step) => step.status)).toEqual(["done", "current", "pending"]);
  });
  it("驳回待重提显示受理提示，不虚构时间", () => {
    const steps = buildCourtProcessTimeline({ level: "FIRST", currentLevel: "FIRST", stageCode: "PENDING_RE_SUBMIT" });
    expect(steps[0]).toMatchObject({ status: "current", desc: "案件已被驳回，等待重新提交", time: "" });
  });
});
