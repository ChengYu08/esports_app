import { describe, expect, it } from "vitest";

import {
  buildCircleTopicRoute,
  normalizeCircleTopicName,
  splitCircleTopicText,
} from "@/features/circle/circle-topic";

describe("normalizeCircleTopicName", () => {
  it("去掉话题前缀并保留完整名称", () => {
    expect(normalizeCircleTopicName("  ##新建话题  ")).toBe("新建话题");
  });

  it("空话题返回空字符串", () => {
    expect(normalizeCircleTopicName("###  ")).toBe("");
  });

  it("生成与搜索话题一致的精确搜索路由", () => {
    expect(buildCircleTopicRoute("#新建话题")).toEqual({
      pathname: "/circle/search",
      params: { topic: "新建话题" },
    });
  });

  it("从正文提取多个话题并保留标点", () => {
    expect(splitCircleTopicText("看看#五杀时刻，加入 #电竞赛事！")).toEqual([
      { text: "看看" },
      { text: "#五杀时刻", topic: "五杀时刻" },
      { text: "，加入 " },
      { text: "#电竞赛事", topic: "电竞赛事" },
      { text: "！" },
    ]);
  });
});
