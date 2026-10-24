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
});
