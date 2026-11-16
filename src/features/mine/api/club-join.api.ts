import { apiClient } from "@/core/network/api-client";

export type ClubJoinApplication = {
  id: number;
  clubId: number;
  clubName: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
};
export type JoinClub = { id: number; clubName: string };
type Envelope<T> = { code?: string; info?: string; data?: T };

async function applicationRequest<T>(action: string, token: string, body: object = {}): Promise<T> {
  const response = await apiClient<Envelope<T>>(`/client/v1/club/join/application/${action}`, {
    method: "POST", token, body,
  });
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || "操作失败，请稍后重试");
  }
  return response.data as T;
}

export async function fetchClubJoinState(token: string): Promise<ClubJoinApplication | null> {
  const state = await applicationRequest<ClubJoinApplication | null | undefined>("state", token);
  return state ?? null;
}
export function submitClubJoin(token: string, clubId: number) {
  return applicationRequest<void>("submit", token, { clubId });
}
export function cancelClubJoin(token: string, id: number) {
  return applicationRequest<void>("cancel", token, { id });
}
export async function fetchJoinClubs(page: number, keyword: string, signal?: AbortSignal) {
  const response = await apiClient<Envelope<{ records?: JoinClub[]; total?: number }>>("/client/v1/club/public/page", {
    method: "POST",
    body: { page, pageSize: 20, action: { clubName: keyword.trim() || undefined } },
    signal,
  });
  if (response.code !== "SUCCESS") {
    throw new Error(response.info || "俱乐部列表加载失败");
  }
  return { records: response.data?.records ?? [], total: Number(response.data?.total ?? 0) };
}
