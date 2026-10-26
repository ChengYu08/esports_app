import type { TimelineItem as CourtTimelineItem, TrialResult as CourtTrialResult } from "./court.api";

export type CourtTimelineStep = {
  key: "accept" | "previousEnd" | "evidence" | "voting" | "hearing" | "judged";
  title: string;
  desc: string;
  time: string;
  deadlineHighlight?: boolean;
  status: "done" | "current" | "pending";
  eventType?: string;
};

// 与 Web 端 utils/courtProcessTimeline.ts 使用相同的审级和阶段规则。

export const COURT_TRIAL_LEVELS = ['FIRST', 'SECOND', 'THIRD'] as const
export type CourtTrialLevel = typeof COURT_TRIAL_LEVELS[number]

export interface ProcessInput {
  level: CourtTrialLevel
  currentLevel: CourtTrialLevel
  stageCode?: string
  timeline?: CourtTimelineItem[]
  trialResults?: CourtTrialResult[]
  evidenceDeadline?: string
  voteDeadline?: string
  handleResult?: string
  resultCode?: string | null
  createdAt?: string
  plaintiffName?: string
  defendantName?: string
}

interface StepDefinition {
  key: CourtTimelineStep['key']
  title: string
  pending: string
  current: string
  done: string
  events: string[]
}

const EVIDENCE_STEP: StepDefinition = {
  key: 'evidence', title: '举证阶段', pending: '等待双方举证',
  current: '双方举证进行中', done: '双方已完成举证，进入评审阶段',
  events: ['EVIDENCE_STARTED'],
}
const VOTING_STEP: StepDefinition = {
  key: 'voting', title: '评审投票', pending: '等待评审投票',
  current: '评审员正在审查证据，进行投票阶段', done: '评审投票已结束',
  events: ['VOTING_STARTED', 'EVIDENCE_TIMEOUT'],
}
const JUDGED_STEP: StepDefinition = {
  key: 'judged', title: '判决结果', pending: '等待判决结果',
  current: '等待判决结果', done: '判决已公布',
  events: ['CASE_JUDGED', 'SECOND_CASE_JUDGED'],
}

function latest(rows: CourtTimelineItem[], matches: (row: CourtTimelineItem) => boolean) {
  return [...rows].reverse().find(matches)
}

function findTrialEntry(level: CourtTrialLevel, rows: CourtTimelineItem[], all: CourtTimelineItem[]) {
  if (level === 'FIRST') {
    return latest(rows, row => ['CASE_ACCEPTED', 'CASE_SUBMITTED'].includes(row.eventType || ''))
  }
  // 升审事件属于上一审，受理事件属于新审，均可定位进入时间。
  const entryEvent = level === 'SECOND' ? 'APPEAL_ACCEPTED' : 'CASE_THIRD_APPEALED'
  const appealEvent = level === 'SECOND' ? 'CASE_APPEALED' : 'CASE_THIRD_APPEALED'
  const previousLevel = level === 'SECOND' ? 'FIRST' : 'SECOND'
  return latest(rows, row => row.eventType === entryEvent)
    || latest(all, row => row.eventType === appealEvent && row.level === previousLevel)
}

function currentStepIndex(level: CourtTrialLevel, stage: string | undefined, judged: boolean, count: number) {
  if (judged) { return count }
  if (level === 'THIRD') { return 1 }
  if (stage === 'VOTING') { return 2 }
  if (stage === 'ACCEPTED' || stage === 'EVIDENCE') { return 1 }
  return 0
}

/** 每次仅构建所选审级，历史审级不使用当前案件的阶段、描述或截止时间。 */
export function buildCourtProcessTimeline(input: ProcessInput): CourtTimelineStep[] {
  const all = input.timeline || []
  const rows = all.filter(row => row.level === input.level)
  const isCurrent = input.level === input.currentLevel
  const result = input.trialResults?.find(row => row.level === input.level)
  const resultCode = result?.result || (isCurrent ? input.resultCode : undefined)
  const hasVerdict = !!resultCode && resultCode !== 'PENDING'
  const verdictEvent = latest(rows, row => JUDGED_STEP.events.includes(row.eventType || '')
    || (input.level === 'THIRD' && row.eventType === 'CASE_CLOSED'))
  const judged = hasVerdict || !!verdictEvent
  const stage = isCurrent ? input.stageCode : (judged ? 'JUDGED' : undefined)
  const entry = findTrialEntry(input.level, rows, all)
  const firstStep: StepDefinition = input.level === 'FIRST'
    ? { key: 'accept', title: '案件受理', pending: '案件已提交，等待平台受理',
        current: '案件已生成，等待平台受理', done: '案件已生成，等待双方举证',
        events: ['CASE_ACCEPTED'] }
    : { key: 'previousEnd', title: input.level === 'SECOND' ? '一审结束' : '二审结束',
        pending: '等待上一审结束', current: '上一审已结束',
        done: input.level === 'SECOND' ? '已申请二审，等待双方举证' : '已申请三审，等待客服介入',
        events: [] }
  const definitions = input.level === 'THIRD'
    ? [firstStep, { key: 'hearing', title: '确认开庭', pending: '等待客服确认开庭时间',
        current: '客服正在联系双方，准备开庭时间', done: '开庭已结束',
        events: ['CASE_THIRD_APPEALED'] } satisfies StepDefinition, JUDGED_STEP]
    : [firstStep, EVIDENCE_STEP, VOTING_STEP, JUDGED_STEP]
  const currentIndex = currentStepIndex(input.level, stage, judged, definitions.length)

  return definitions.map((def, index) => {
    const matched = def.key === 'previousEnd' ? entry
      : def.key === 'judged' ? verdictEvent
        : latest(rows, row => def.events.includes(row.eventType || ''))
          || (def.key === 'evidence' && input.level === 'SECOND' ? entry : undefined)
    const status = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending'
    let desc = def[status]
    if (def.key === 'previousEnd' && status !== 'pending') {
      const appealEvent = input.level === 'SECOND' ? 'CASE_APPEALED' : 'CASE_THIRD_APPEALED'
      const appeal = latest(all, row => row.eventType === appealEvent && !!row.applicantParty)
      const party = appeal?.applicantParty
      const applicant = party === 'PLAINTIFF' ? `原告@${input.plaintiffName || '昵称'}`
        : party === 'DEFENDANT' ? `被告@${input.defendantName || '昵称'}` : ''
      if (applicant) { desc = `${applicant}${def.done.replace('已申请', '申请')}` }
    }
    let time = status === 'pending' ? '' : matched?.createdAt || ''
    let deadlineHighlight = false
    if (index === 0 && status !== 'pending') { time ||= entry?.createdAt || (input.level === 'FIRST' ? input.createdAt || '' : '') }
    if (def.key === 'evidence' && status === 'current' && input.evidenceDeadline && isCurrent) {
      time = `截止于 ${input.evidenceDeadline}`
      deadlineHighlight = true
    }
    if (def.key === 'voting' && status === 'current' && input.voteDeadline && isCurrent) {
      time = `截止于 ${input.voteDeadline}`
      deadlineHighlight = true
    }
    if (def.key === 'judged' && status === 'done') {
      desc = resultCode === 'PLAINTIFF_WIN' ? `本次裁决结果为原告@${input.plaintiffName || '昵称'} 获胜`
        : resultCode === 'DEFENDANT_WIN' ? `本次裁决结果为被告@${input.defendantName || '昵称'} 获胜` : '判决已公布'
      if (!isCurrent) {
        const appealEvent = input.level === 'FIRST' ? 'CASE_APPEALED' : 'CASE_THIRD_APPEALED'
        const appeal = latest(all, row => row.level === input.level && row.eventType === appealEvent && !!row.applicantParty)
        const applicant = appeal?.applicantParty === 'PLAINTIFF' ? '原告'
          : appeal?.applicantParty === 'DEFENDANT' ? '被告'
            : resultCode === 'PLAINTIFF_WIN' ? '被告' : resultCode === 'DEFENDANT_WIN' ? '原告' : ''
        desc += `，${applicant}已申请上诉`
      }
      time = result?.judgedAt || time
    }
    if (def.key === 'accept' && stage === 'PENDING_RE_SUBMIT') { desc = '案件已被驳回，等待重新提交' }
    return { key: def.key, title: def.title, desc, time, status, deadlineHighlight, eventType: matched?.eventType }
  })
}
