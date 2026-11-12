// 盼友圈短视频流类型与 mock 数据。接口就绪后由 circle.api.ts 替换数据来源。

import type { CircleContentRef } from "@/features/circle/circle-publish.api";

export type CircleFeedKind = "latest" | "hot" | "follow";

export type CircleVideoPost = {
  id: string;
  videoUrl?: string;
  videoSourceType?: "m3u8" | "mp4";
  authorId?: string;
  /** 视频封面，接口接入后为远端 URL。 */
  cover: number | { uri: string };
  /** 视频时长（秒），搜索结果卡片展示角标。 */
  durationSec?: number;
  avatar: number | { uri: string };
  /** 作者昵称，如“@小非-认证野王”。 */
  author: string;
  /** 是否展示“去下单”入口。 */
  orderEnabled: boolean;
  /** 短文案行，展示为中等字重；与正文同时存在时才渲染。 */
  headline?: string;
  content: string;
  /** 正文中的 @用户 引用（后端返回带位置优先，字典为 id→昵称）。 */
  mentions?: CircleContentRef[] | Record<string, string>;
  /** 话题标签，展示为浅蓝色。 */
  tags: string[];
  /** 发布时间描述。 */
  publishedAt: string;
  /** 自主声明列表（后端 FeedItemVO.declaration，发布时选择；「无需添加自主声明」不展示）。 */
  declaration?: string[];
  likeCount: number;
  commentCount: number;
  liked?: boolean;
  /** 当前用户是否已关注作者，关注后头像下方加号按钮消失。 */
  followed?: boolean;
};

const coverImage = require("../../../assets/images/bg_publish_dark.webp");

const posts: CircleVideoPost[] = [
  {
    id: "1",
    cover: coverImage,
    avatar: require("../../../assets/images/radar-avatar-1.png"),
    author: "@小非-认证野王",
    orderEnabled: true,
    content: "聚光灯、欢呼声、极限反转，每一次操作都值得沸腾，保持热爱，为选手加油！",
    tags: ["#电竞赛事", "#高光时刻", "#电竞陪玩"],
    publishedAt: "5小时前",
    likeCount: 999,
    commentCount: 999,
  },
  {
    id: "2",
    cover: coverImage,
    avatar: require("../../../assets/images/radar-avatar-2.png"),
    author: "@阿哲-巅峰赛大神",
    orderEnabled: true,
    content: "五杀名场面，逆风翻盘只差一个开团时机，这波配合直接拉满！",
    tags: ["#巅峰赛", "#五杀时刻"],
    publishedAt: "8小时前",
    likeCount: 2134,
    commentCount: 326,
  },
  {
    id: "3",
    cover: coverImage,
    avatar: require("../../../assets/images/radar-avatar-3.png"),
    author: "@月月-国服辅助",
    orderEnabled: false,
    content: "今天带老板上分七连胜，视野、节奏、开团一个都不能少。",
    tags: ["#上分日记", "#双排日常"],
    publishedAt: "昨天",
    likeCount: 866,
    commentCount: 88,
  },
  {
    id: "4",
    cover: coverImage,
    avatar: require("../../../assets/images/radar-avatar-4.png"),
    author: "@大熊-全能打野",
    orderEnabled: true,
    content: "野区资源全掌控，小龙坑前一波完美先手，比赛节奏就是指挥的艺术。",
    tags: ["#打野教学", "#赛事解说"],
    publishedAt: "2天前",
    likeCount: 1201,
    commentCount: 156,
  },
];

export function getCirclePosts(kind: CircleFeedKind): CircleVideoPost[] {
  if (kind === "hot") {
    return [...posts].sort((a, b) => b.likeCount - a.likeCount);
  }
  if (kind === "follow") {
    return posts.filter((post) => post.id === "1" || post.id === "3");
  }
  return posts;
}

export function formatCircleCount(count: number): string {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}w`;
  }
  return String(count);
}
