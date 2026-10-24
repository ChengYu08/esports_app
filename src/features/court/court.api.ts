import { apiClient } from "@/core/network/api-client";
import { uploadClientObject } from "@/features/auth/oss-upload";
import { getEvidenceUploadFile } from "@/features/court/court-evidence-image";
import { useAuthStore } from "@esports/auth";

export type CourtLevel = "FIRST" | "SECOND" | "THIRD";
export type CourtResult = "PLAINTIFF_WIN" | "DEFENDANT_WIN" | "INVALID";
export type CourtScope = "ALL" | "LATEST" | "FAVORITE" | "MY";
export type CourtCaseType = "DELETE_REVIEW" | "RETRAIN" | "APOLOGY" | "FINE";

export type CourtParty = {
  userId?: string | number;
  nickname?: string;
  avatar?: string;
};
export type CourtVoteSummary = { plaintiff?: number; defendant?: number };

export type CourtReviewerStatus = {
  status?: string;
  pageStatus?: string;
  realNameVerified?: boolean;
  registrationPeriodSatisfied?: boolean;
  reviewReason?: string;
};

export type CourtCase = {
  caseId: string | number;
  caseNo?: string;
  caseType?: CourtCaseType | string;
  level?: CourtLevel;
  stage?: string;
  result?: CourtResult | string | null;
  appealStatus?: string;
  appealDeadline?: string;
  voteDeadline?: string;
  evidenceDeadline?: string;
  claim?: string;
  content?: string;
  contentSummary?: string;
  evidenceThumbnails?: string[];
  editableEvidence?: Record<string, string>;
  plaintiff?: CourtParty;
  defendant?: CourtParty;
  opponent?: CourtParty;
  voteSummary?: CourtVoteSummary;
  viewCount?: number;
  favorited?: boolean;
  favoriteCount?: number;
  myVoteResult?: CourtResult | string | null;
  myParty?: "PLAINTIFF" | "DEFENDANT";
  actions?: string[];
  createdAt?: string;
  orderNo?: string;
  sourceOrderId?: string | number;
  sourceReviewId?: string | number;
  rejectionReason?: string;
  totalPrice?: number | string;
  quantity?: number;
  billingUnitName?: string;
  companionNickname?: string;
  companionAvatar?: string;
  gameName?: string;
  modeName?: string;
  levelName?: string;
  serviceName?: string;
  reviewContent?: string;
  reviewRating?: number;
  reviewImageUrls?: string[];
  plaintiffEvidenceSubmissions?: EvidenceSubmission[];
  defendantEvidenceSubmissions?: EvidenceSubmission[];
  plaintiffEvidenceThumbnails?: string[];
  defendantEvidenceThumbnails?: string[];
  timeline?: TimelineItem[];
  trialResults?: TrialResult[];
  handleResult?: string;
};

export type EvidenceSubmission = {
  content?: string;
  imageUrls?: string[];
  submittedAt?: string;
  level?: CourtLevel;
};
export type TimelineItem = {
  applicantParty?: "PLAINTIFF" | "DEFENDANT";
  eventType?: string;
  level?: CourtLevel;
  reason?: string;
  createdAt?: string;
  fromStage?: string;
  toStage?: string;
};
export type TrialResult = {
  level?: CourtLevel;
  result?: string;
  judgedAt?: string;
  handleResult?: string;
};
export type CourtSource = {
  orderId?: string | number;
  reviewId?: string | number;
  orderNo?: string;
  gameId?: string | number;
  gameIconUrl?: string;
  gameName?: string;
  modeName?: string;
  levelName?: string;
  serviceName?: string;
  companionNickname?: string;
  companionAvatar?: string;
  defendantId?: string | number;
  defendantNickname?: string;
  defendantAvatar?: string;
  clubName?: string;
  totalPrice?: number | string;
  quantity?: number;
  billingUnitName?: string;
  createdAt?: string;
  reviewContent?: string;
  reviewRating?: number;
  reviewImageUrls?: string[];
};
export type Page<T> = {
  records?: T[];
  list?: T[];
  total?: number;
  pages?: number;
  totalPages?: number;
};

export type TicketTarget = { id: string; nickname: string; headImage?: string };
export type TicketInput = {
  reasonType: string;
  targetUid?: string;
  content: string;
  evidenceObjectKeys: string[];
  idempotencyKey?: string;
};

export type PlatformTicket = {
  ticketId?: string | number;
  ticketNo?: string;
  reasonType?: string;
  targetUid?: string;
  targetNickname?: string;
  targetAvatar?: string;
  content?: string;
  status?: string;
  visibility?: string;
  adminReply?: string;
  rejectionReason?: string;
  editableEvidence?: Record<string, string>;
  createdAt?: string;
  repliedAt?: string;
  closedAt?: string;
  evidenceThumbnails?: string[];
  messageList?: {
    senderType?: string;
    messageType?: string;
    visibility?: string;
    content?: string;
    createdAt?: string;
  }[];
};

type Envelope<T> = { code?: string; info?: string; data?: T };

function records<T>(page?: Page<T>) {
  return page?.records ?? page?.list ?? [];
}
function token() {
  return useAuthStore.getState().accessToken ?? undefined;
}

async function get<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  authenticated: boolean,
  signal?: AbortSignal,
) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
  const response = await apiClient<Envelope<T>>(
    `${path}${query ? `?${query}` : ""}`,
    {
      method: "GET",
      signal,
      ...(authenticated && token() ? { token: token() } : {}),
    },
  );
  if (response.code !== "SUCCESS" || response.data === undefined)
    throw new Error(response.info || "加载失败");
  return response.data as T;
}

async function post<T>(path: string, body?: unknown) {
  const accessToken = token();
  if (!accessToken) throw new Error("请先登录");
  const response = await apiClient<Envelope<T>>(path, {
    method: "POST",
    token: accessToken,
    body,
  });
  if (response.code !== "SUCCESS") throw new Error(response.info || "操作失败");
  return response.data as T;
}

// 数据类 POST：后端成功包络可能省略 data，缺失时不能把 undefined 当业务数据返回。
async function postRequireData<T>(path: string, body?: unknown) {
  const data = await post<T>(path, body);
  if (data === undefined || data === null) throw new Error("响应数据缺失，请稍后重试");
  return data;
}

export const courtApi = {
  async getPage(scope: CourtScope, page = 1, pageSize = 20, keyword?: string) {
    if (scope === "MY") {
      return get<Page<CourtCase>>(
        "/client/v1/court/my/page",
        { page, pageSize, keyword },
        true,
      );
    }
    if (scope === "FAVORITE") {
      return get<Page<CourtCase>>(
        "/client/v1/court/my/favorite/page",
        { page, pageSize, keyword },
        true,
      );
    }
    // Public endpoints also return viewer-specific fields when a token is present.
    return get<Page<CourtCase>>(
      "/client/v1/court/public/page",
      { scope, page, pageSize, keyword },
      true,
    );
  },
  async getDetail(caseId: string | number, mine = false) {
    return get<CourtCase>(
      mine ? "/client/v1/court/my/detail" : "/client/v1/court/public/detail",
      { caseId },
      true,
    );
  },
  async getSources(caseType: CourtCaseType, page = 1) {
    const response = await get<Page<CourtSource>>(
      "/client/v1/court/source/page",
      { caseType, page, pageSize: 20 },
      true,
    );
    return records(response);
  },
  getSourcePage(
    caseType: CourtCaseType,
    page = 1,
    pageSize = 20,
    signal?: AbortSignal,
  ) {
    return get<Page<CourtSource>>(
      "/client/v1/court/source/page",
      { caseType, page, pageSize },
      true,
      signal,
    );
  },
  async previewSource(params: {
    caseType: CourtCaseType;
    orderId?: string | number;
    reviewId?: string | number;
  }) {
    return get<CourtSource>(
      "/client/v1/court/source/preview",
      params as Record<string, string | number>,
      true,
    );
  },
  async createCase(input: {
    caseType: CourtCaseType;
    orderId?: string | number;
    reviewId?: string | number;
    claim: string;
    content: string;
    evidenceObjectKeys: string[];
    idempotencyKey: string;
  }) {
    return post("/client/v1/court/create", {
      ...input,
      orderId: input.orderId ? Number(input.orderId) : undefined,
      reviewId: input.reviewId ? Number(input.reviewId) : undefined,
    });
  },
  async resubmitCase(
    caseId: string | number,
    input: {
      caseType: CourtCaseType;
      orderId?: string | number;
      reviewId?: string | number;
      claim: string;
      content: string;
      evidenceObjectKeys: string[];
      idempotencyKey: string;
    },
    retainedEvidenceKeys: string[],
  ) {
    return post("/client/v1/court/resubmit", {
      caseId: Number(caseId),
      form: {
        ...input,
        orderId: input.orderId ? Number(input.orderId) : undefined,
        reviewId: input.reviewId ? Number(input.reviewId) : undefined,
      },
      retainedEvidenceKeys,
      idempotencyKey: input.idempotencyKey,
    });
  },
  async vote(
    caseId: string | number,
    level: CourtLevel,
    voteResult: CourtResult,
  ) {
    return postRequireData<{ plaintiffVoteCount?: number; defendantVoteCount?: number }>(
      "/client/v1/court/vote",
      { caseId: Number(caseId), level, voteResult },
    );
  },
  async favorite(caseId: string | number, favorite: boolean) {
    const result = await post<
      { favorited?: boolean; favoriteCount?: number } | undefined
    >("/client/v1/court/favorite", { caseId: Number(caseId), favorite });
    return { ...result, favorited: result?.favorited ?? favorite };
  },
  getReviewerStatus() {
    return get<CourtReviewerStatus>(
      "/client/v1/court/reviewer/status",
      {},
      true,
    );
  },
  getReviewerStats() {
    return get<{ todayCount?: number; totalCount?: number }>(
      "/client/v1/court/reviewer/stats",
      {},
      true,
    );
  },
  applyReviewer() {
    return post("/client/v1/court/reviewer/apply");
  },
  async getEvidenceSts(objectName: string) {
    const data = await postRequireData<
      Parameters<typeof uploadClientObject>[0] & { objectList?: string[] }
    >("/client/v1/court/evidence/sts", {
      action: { objectNames: [objectName] },
    });
    return data;
  },
  async uploadEvidence(uri: string, name: string) {
    const image = getEvidenceUploadFile(uri, name);
    const sts = await this.getEvidenceSts(image.name);
    const key = sts.objectList?.[0];
    if (!key) throw new Error("上传凭证未返回文件路径");
    await uploadClientObject(sts, key, {
      uri: image.uri,
      mimeType: image.mimeType,
    });
    return key;
  },
  async supplementEvidence(
    caseId: string | number,
    evidenceObjectKeys: string[],
    content: string,
  ) {
    return post("/client/v1/court/evidence/supplement", {
      caseId: Number(caseId),
      evidenceObjectKeys,
      content,
    });
  },
  async appeal(
    caseId: string | number,
    reason: string,
    newEvidenceObjectKeys: string[],
  ) {
    return post("/client/v1/court/appeal", {
      caseId: Number(caseId),
      reason,
      newEvidenceObjectKeys,
      idempotencyKey: makeIdempotencyKey("court-appeal"),
    });
  },
  getTicketPage(mine: boolean, page = 1, pageSize = 20) {
    return get<Page<PlatformTicket>>(
      mine
        ? "/client/v1/platform-ticket/my/page"
        : "/client/v1/platform-ticket/public/page",
      { page, pageSize },
      mine,
    );
  },
  getTicketDetail(ticketId: string | number, mine: boolean) {
    return get<PlatformTicket>(
      mine
        ? "/client/v1/platform-ticket/my/detail"
        : "/client/v1/platform-ticket/public/detail",
      { ticketId },
      mine,
    );
  },
  async searchTargets(keyword: string, signal?: AbortSignal) {
    return get<TicketTarget[]>(
      "/client/v1/platform-ticket/target/search",
      { keyword },
      true,
      signal,
    );
  },
  async createTicket(input: TicketInput) {
    return postRequireData<PlatformTicket>("/client/v1/platform-ticket/create", {
      ...input,
      idempotencyKey: input.idempotencyKey ?? makeIdempotencyKey("ticket"),
    });
  },
  async resubmitTicket(
    ticketId: string | number,
    input: TicketInput,
    retainedEvidenceKeys: string[],
  ) {
    const idempotencyKey =
      input.idempotencyKey ?? makeIdempotencyKey(`ticket-resubmit-${ticketId}`);
    return postRequireData<PlatformTicket>("/client/v1/platform-ticket/resubmit", {
      ticketId,
      form: { ...input, idempotencyKey },
      retainedEvidenceKeys,
      idempotencyKey,
    });
  },
  async replyTicket(ticketId: string | number, content: string) {
    return post("/client/v1/platform-ticket/reply", { ticketId, content });
  },
};

export function pageRecords<T>(page?: Page<T>) {
  return records(page);
}

export function makeIdempotencyKey(prefix = "court") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function mapCaseStage(item: CourtCase) {
  const level =
    item.level === "SECOND" ? "二审" : item.level === "THIRD" ? "三审" : "一审";
  const stage =
    item.stage === "EVIDENCE"
      ? "举证"
      : item.stage === "VOTING"
        ? "评审投票"
        : item.stage === "HEARING"
          ? "三审中"
          : item.result === "PLAINTIFF_WIN"
            ? "原告胜诉"
            : item.result === "DEFENDANT_WIN"
              ? "原告败诉"
              : item.stage === "JUDGED"
                ? "已判决"
                : "处理中";
  return { level, stage };
}

export function formatCount(value?: number) {
  const count = Math.max(0, Math.floor(Number(value) || 0));
  return count < 1000 ? String(count) : `${Math.floor(count / 1000)}000+`;
}

export function formatTime(value?: string) {
  return value ? value.replace("T", " ").slice(0, 16) : "-";
}
