import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/core/network/api-client";
import { cancelClubJoin, fetchClubJoinState, fetchJoinClubs, submitClubJoin } from "./club-join.api";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));
afterEach(() => vi.resetAllMocks());

describe("加入俱乐部申请接口", () => {
  it("没有申请记录时将缺省数据统一处理为 null", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS" });
    await expect(fetchClubJoinState("token")).resolves.toBeNull();
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: null });
    await expect(fetchClubJoinState("token")).resolves.toBeNull();
  });
  it("使用当前账号查询申请状态并按 Web 参数提交及取消", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { id: 11, clubId: 12, clubName: "俱乐部", status: "PENDING" } });
    expect(await fetchClubJoinState("token")).toMatchObject({ id: 11, status: "PENDING" });
    expect(apiClient).toHaveBeenLastCalledWith("/client/v1/club/join/application/state", { method: "POST", token: "token", body: {} });
    await submitClubJoin("token", 12);
    expect(apiClient).toHaveBeenLastCalledWith("/client/v1/club/join/application/submit", { method: "POST", token: "token", body: { clubId: 12 } });
    await cancelClubJoin("token", 11);
    expect(apiClient).toHaveBeenLastCalledWith("/client/v1/club/join/application/cancel", { method: "POST", token: "token", body: { id: 11 } });
  });
  it("后端拒绝时展示服务端原因", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "FAILED", info: "已有待审核申请" });
    await expect(submitClubJoin("token", 12)).rejects.toThrow("已有待审核申请");
  });
  it("分页搜索公开俱乐部并去掉搜索词首尾空格", async () => {
    vi.mocked(apiClient).mockResolvedValue({ code: "SUCCESS", data: { records: [{ id: 1, clubName: "测试" }], total: 21 } });
    expect(await fetchJoinClubs(2, " 测试 ")).toEqual({ records: [{ id: 1, clubName: "测试" }], total: 21 });
    expect(apiClient).toHaveBeenCalledWith("/client/v1/club/public/page", { method: "POST", body: { page: 2, pageSize: 20, action: { clubName: "测试" } }, signal: undefined });
  });
});
