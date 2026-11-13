import { describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";
import {
  deleteMyCircleVideo,
  fetchCircleFeedPage,
  fetchUserCirclePage,
  profileCirclePostToFeedPost,
} from "@/features/circle/circle.api";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));

describe("fetchCircleFeedPage", () => {
  it("视频描述优先使用服务端返回的带位置 @用户 引用", async () => {
    const mentions = [{ id: "42", label: "旧昵称", offset: 0, length: 4 }];
    vi.mocked(apiClient).mockResolvedValueOnce({
      code: "SUCCESS",
      data: {
        list: [{
          videoId: 1,
          url: "https://example.com/video.mp4",
          coverUrl: "https://example.com/cover.jpg",
          authorInfo: { headImage: "https://example.com/avatar.jpg" },
          content: "@旧昵称 #五杀",
          mentionUsers: { 42: "新昵称" },
          mentions,
        }],
        hasMore: false,
      },
    });

    const page = await fetchCircleFeedPage({ kind: "latest", cursor: null });

    expect(page.list[0].mentions).toEqual(mentions);
    expect(page.list[0].content).toBe("@旧昵称 #五杀");
  });

  it("个人主页视频播放页保留后端的 @用户 引用", async () => {
    const mentions = [{ id: "42", label: "xx", offset: 0, length: 3 }];
    vi.mocked(apiClient).mockResolvedValueOnce({
      code: "SUCCESS",
      data: {
        records: [{
          id: 2,
          url: "https://example.com/video.mp4",
          coverUrl: "https://example.com/cover.jpg",
          content: "@xx 视频",
          mentions,
        }],
      },
    });

    const page = await fetchUserCirclePage({ userId: "7", page: 1, pageSize: 10 });
    const post = profileCirclePostToFeedPost(page.list[0], {
      userId: "7",
      nickname: "作者",
      avatar: "https://example.com/avatar.jpg",
    });

    expect(post.mentions).toEqual(mentions);
  });
});

describe("deleteMyCircleVideo", () => {
  it("删除接口成功响应 data 为 null 时正常完成", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      code: "SUCCESS",
      data: null,
    });

    await expect(
      deleteMyCircleVideo({ videoId: "3", token: "t" }),
    ).resolves.toBeUndefined();
    expect(apiClient).toHaveBeenCalledWith(
      "/client/v1/moments/video/delete",
      expect.objectContaining({
        method: "POST",
        token: "t",
        body: { videoId: 3 },
      }),
    );
  });

  it("删除失败时抛出后端返回的错误文案", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      code: "FAILED",
      info: "无权删除该视频",
    });

    await expect(
      deleteMyCircleVideo({ videoId: "3", token: "t" }),
    ).rejects.toThrow("无权删除该视频");
  });
});
