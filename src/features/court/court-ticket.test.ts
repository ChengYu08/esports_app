import { beforeEach, describe, expect, it, vi } from "vitest";
import { courtApi, makeIdempotencyKey, type TicketTarget } from "./court.api";
import { useCourtTargetSelection } from "./court-target-selection";
import { createTicketSubmitter, highlightedParts, searchTicketTargets, ticketDraftError, ticketInput, type TicketDraft } from "./court-ticket";

const auth = vi.hoisted(() => ({ accessToken: "owner" as string | null }));
vi.mock("@esports/auth", () => ({ useAuthStore: { getState: () => auth } }));
vi.mock("./court.api", () => ({
  courtApi: { searchTargets: vi.fn(), createTicket: vi.fn(), resubmitTicket: vi.fn() },
  makeIdempotencyKey: vi.fn(),
}));

const target: TicketTarget = { id: "200100101001", nickname: "三角洲大神1号", headImage: "https://example.test/avatar.png" };
const draft: TicketDraft = { reasonType: "RULE_VIOLATION", target, content: "  请平台核实处理  ", agreed: true };

beforeEach(() => {
  vi.resetAllMocks();
  auth.accessToken = "owner";
  useCourtTargetSelection.setState({ sessions: {} });
  vi.mocked(courtApi.searchTargets).mockResolvedValue([target]);
  vi.mocked(courtApi.createTicket).mockResolvedValue({ ticketId: 42 });
  vi.mocked(courtApi.resubmitTicket).mockResolvedValue({ ticketId: 42 });
  let sequence = 0;
  vi.mocked(makeIdempotencyKey).mockImplementation(() => `ticket-${++sequence}`);
});

describe("ticket form validation and payloads", () => {
  it.each(["RULE_VIOLATION", "ORDER_DISPUTE", "CHAT_DISPUTE", "OTHER"])("requires a target for %s", (reasonType) => {
    expect(ticketDraftError({ ...draft, reasonType, target: null })).toBe("请选择诉告对象");
  });

  it("accepts platform suggestions without a target and strips an old target from the payload", () => {
    expect(ticketDraftError({ ...draft, reasonType: "PLATFORM_SUGGESTION", target: null })).toBeNull();
    expect(ticketInput({ ...draft, reasonType: "PLATFORM_SUGGESTION" }, [])).toEqual({
      reasonType: "PLATFORM_SUGGESTION", content: "请平台核实处理", evidenceObjectKeys: [],
    });
  });

  it.each([
    [{ reasonType: "UNKNOWN" }, "请选择诉求类型"],
    [{ content: " \n " }, "请填写投诉内容"],
    [{ content: "字".repeat(1001) }, "投诉内容不能超过1000字"],
    [{ agreed: false }, "请先阅读并同意《小法庭用户使用守则》"],
  ])("rejects invalid form state %j", (change, message) => {
    expect(ticketDraftError({ ...draft, ...change })).toBe(message);
    expect(() => ticketInput({ ...draft, ...change }, [])).toThrow(String(message));
  });

  it("accepts exactly 1000 characters and keeps optional evidence keys and target IDs intact", () => {
    expect(ticketDraftError({ ...draft, content: "字".repeat(1000) })).toBeNull();
    expect(ticketInput(draft, ["court/evidence/1.png"])).toMatchObject({
      targetUid: target.id, content: "请平台核实处理", evidenceObjectKeys: ["court/evidence/1.png"],
    });
    expect(() => ticketInput(draft, Array(10).fill("image"))).toThrow("最多上传9张证据截图");
  });
});

describe("target search", () => {
  it("does not request an empty keyword", async () => {
    expect(await searchTicketTargets("  ", "owner")).toEqual([]);
    expect(courtApi.searchTargets).not.toHaveBeenCalled();
  });

  it("searches nicknames or partial IDs with trimmed keywords and cancellation", async () => {
    const signal = new AbortController().signal;
    expect(await searchTicketTargets(" 三角洲 ", "owner", signal)).toEqual([target]);
    expect(courtApi.searchTargets).toHaveBeenCalledExactlyOnceWith("三角洲", signal);
    await searchTicketTargets("200100", "owner");
    expect(courtApi.searchTargets).toHaveBeenLastCalledWith("200100", undefined);
  });

  it("normalizes IDs and ignores duplicate or missing IDs", async () => {
    vi.mocked(courtApi.searchTargets).mockResolvedValue([
      { id: 42, nickname: "" }, { id: 42, nickname: "同一用户" }, { id: null, nickname: "无效" }, target,
    ] as unknown as TicketTarget[]);
    expect(await searchTicketTargets("42", "owner")).toEqual([{ id: "42", nickname: "同一用户" }, target]);
  });

  it("rejects responses from a previous account", async () => {
    vi.mocked(courtApi.searchTargets).mockImplementation(async () => {
      auth.accessToken = "another-owner";
      return [target];
    });
    await expect(searchTicketTargets("三角洲", "owner")).rejects.toThrow("登录状态已变化");
  });

  it("rejects signed-out searches before sending a request", async () => {
    auth.accessToken = null;
    await expect(searchTicketTargets("三角洲", "owner")).rejects.toThrow("登录状态已变化");
    expect(courtApi.searchTargets).not.toHaveBeenCalled();
  });

  it("handles the native AbortSignal without throwIfAborted", async () => {
    const signal = { aborted: true } as AbortSignal;
    await expect(searchTicketTargets("三角洲", "owner", signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(courtApi.searchTargets).not.toHaveBeenCalled();
  });

  it("discards a request cancelled while in flight", async () => {
    const controller = new AbortController();
    vi.mocked(courtApi.searchTargets).mockImplementation(async () => {
      controller.abort();
      return [target];
    });
    await expect(searchTicketTargets("三角洲", "owner", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("surfaces network errors for the retry state", async () => {
    vi.mocked(courtApi.searchTargets).mockRejectedValue(new Error("网络异常"));
    await expect(searchTicketTargets("三角洲", "owner")).rejects.toThrow("网络异常");
  });

  it("highlights every matching occurrence literally, without treating the query as a regex", () => {
    expect(highlightedParts("三角洲三角洲大神", "三角洲")).toEqual([
      { text: "三角洲", match: true }, { text: "三角洲", match: true }, { text: "大神", match: false },
    ]);
    expect(highlightedParts("user[1].+", "[1].+")).toEqual([{ text: "user", match: false }, { text: "[1].+", match: true }]);
    expect(highlightedParts("200100101001", "200100")[0]).toEqual({ text: "200100", match: true });
  });
});

describe("target confirmation sessions", () => {
  it("keeps the existing target until explicit confirmation and restores it when reopening", () => {
    const store = useCourtTargetSelection.getState();
    store.begin("form", "owner", target);
    expect(useCourtTargetSelection.getState().sessions.form).toMatchObject({ initialTarget: target, confirmedTarget: null });
    const another = { id: "2", nickname: "另一个用户" };
    expect(store.confirm("form", "owner", another)).toBe(true);
    expect(useCourtTargetSelection.getState().sessions.form.confirmedTarget).toEqual(another);
    store.begin("form", "owner", another);
    expect(useCourtTargetSelection.getState().sessions.form).toMatchObject({ initialTarget: another, confirmedTarget: null });
  });

  it("does not leak a selection to another form or account", () => {
    const store = useCourtTargetSelection.getState();
    store.begin("first", "owner", null);
    store.begin("second", "owner", null);
    expect(store.confirm("first", "other-owner", target)).toBe(false);
    store.confirm("first", "owner", target);
    expect(useCourtTargetSelection.getState().sessions.second.confirmedTarget).toBeNull();
    store.remove("first");
    expect(store.confirm("first", "owner", target)).toBe(false);
  });
});

describe("ticket submission and retries", () => {
  it("coalesces double submission into a single API request", async () => {
    const submit = createTicketSubmitter();
    const input = ticketInput(draft, []);
    const first = submit(input);
    const second = submit(input);
    expect(first).toBe(second);
    await first;
    expect(courtApi.createTicket).toHaveBeenCalledTimes(1);
  });

  it("reuses the same key after a failed or uncertain response, then changes it when the payload changes", async () => {
    const submit = createTicketSubmitter();
    const input = ticketInput(draft, []);
    vi.mocked(courtApi.createTicket).mockRejectedValueOnce(new Error("timeout"));
    await expect(submit(input)).rejects.toThrow("timeout");
    await submit(input);
    await submit({ ...input, content: "修改后的内容" });
    const calls = vi.mocked(courtApi.createTicket).mock.calls;
    expect(calls[0][0].idempotencyKey).toBe(calls[1][0].idempotencyKey);
    expect(calls[2][0].idempotencyKey).not.toBe(calls[1][0].idempotencyKey);
  });

  it("separates retained evidence and new uploads when resubmitting", async () => {
    const submit = createTicketSubmitter();
    await submit(ticketInput(draft, ["new.png"]), "42", ["original.png"]);
    expect(courtApi.resubmitTicket).toHaveBeenCalledWith("42", expect.objectContaining({
      evidenceObjectKeys: ["new.png"], idempotencyKey: expect.any(String),
    }), ["original.png"]);
    expect(courtApi.createTicket).not.toHaveBeenCalled();
  });
});
