import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";
import { voiceRoomApi } from "./voice-room.api";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));

const request = vi.mocked(apiClient);

describe("voice-room envelope unwrap", () => {
  beforeEach(() => {
    request.mockReset();
  });

  it("returns null when joined/current succeeds without data", async () => {
    request.mockResolvedValue({
      success: true,
      code: "SUCCESS",
      info: "操作成功",
      requestId: "1311413827148210176",
    });

    await expect(voiceRoomApi.getJoinedRoom("token")).resolves.toBeNull();
  });

  it("returns null when data is explicitly null", async () => {
    request.mockResolvedValue({ success: true, code: "SUCCESS", data: null });

    await expect(voiceRoomApi.getJoinedRoom("token")).resolves.toBeNull();
  });

  it("unwraps the room payload when data is present", async () => {
    const room = { id: "room-1", roomVersion: 3 };
    request.mockResolvedValue({ success: true, code: "SUCCESS", data: room });

    await expect(voiceRoomApi.getJoinedRoom("token")).resolves.toEqual(room);
    expect(request).toHaveBeenCalledWith("/client/v1/voiceRoom/joined/current", {
      method: "POST",
      token: "token",
      body: {},
    });
  });

  it("throws the business error when success is false", async () => {
    request.mockResolvedValue({ success: false, code: "FAIL", info: "房间已关闭" });

    await expect(voiceRoomApi.getJoinedRoom("token")).rejects.toThrow("房间已关闭");
  });

  it("unwraps the members snapshot with placeholder nicknames", async () => {
    request.mockResolvedValue({
      success: true,
      code: "SUCCESS",
      data: {
        roomVersion: 123,
        members: [
          { userId: "50100104", role: "owner" },
          { userId: "50100105", role: "guest" },
        ],
      },
    });

    await expect(voiceRoomApi.getRoomMembers("30100051", "123", "token")).resolves.toEqual({
      roomVersion: 123,
      members: [
        { userId: "50100104", nickname: "用户50100104", role: "owner" },
        { userId: "50100105", nickname: "用户50100105", role: "guest" },
      ],
    });
    expect(request).toHaveBeenCalledWith(
      "/client/v1/voiceRoom/30100051/members?roomVersion=123",
      { method: "POST", token: "token", body: undefined, suppressRealNameRedirect: undefined },
    );
  });

  it("normalizes an empty members list to an empty array", async () => {
    request.mockResolvedValue({
      success: true,
      code: "SUCCESS",
      data: { roomVersion: "7", members: [] },
    });

    await expect(voiceRoomApi.getRoomMembers("30100051", 7, "token")).resolves.toEqual({
      roomVersion: "7",
      members: [],
    });
  });
});
