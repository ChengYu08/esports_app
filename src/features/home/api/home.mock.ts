import type { Club, GameKey } from "./home.types";

export const demoBanners = [
  { id: "demo-banner", title: "分享助攻商品", subtitle: "第5元限免" },
];

export const demoClubs: Record<GameKey, Club[]> = {
  pc: [
    { id: "pc-1", name: "盼之电竞自营俱乐部", description: "清一色暖男声线，情绪价值拉满，你的日常陪伴", onlineCount: 21, memberCount: 62, clubCode: "2338820", isSelfOperated: true },
    { id: "pc-2", name: "YC电子陪玩俱乐部", description: "清一色暖男声线，情绪价值拉满，你的日常陪伴", onlineCount: 21, memberCount: 62, clubCode: "2338820" },
    { id: "pc-3", name: "二次元萌妹俱乐部", description: "清一色暖男声线，情绪价值拉满，你的日常陪伴", onlineCount: 21, memberCount: 62, clubCode: "2338820" },
    { id: "pc-4", name: "三角洲陪玩俱乐部", description: "清一色暖男声线，情绪价值拉满，你的日常陪伴", onlineCount: 21, memberCount: 62, clubCode: "2338820" },
  ],
  mobile: [
    { id: "mobile-1", name: "三角洲手游自营俱乐部", description: "三角洲手游高质量陪玩，随时组队开黑", onlineCount: 18, memberCount: 48, clubCode: "2338831", isSelfOperated: true },
    { id: "mobile-2", name: "手游王牌陪玩俱乐部", description: "技术在线，耐心陪伴，快速匹配合适队友", onlineCount: 16, memberCount: 54, clubCode: "2338832" },
    { id: "mobile-3", name: "甜妹开黑俱乐部", description: "轻松开黑不尴尬，欢乐陪伴每一局", onlineCount: 12, memberCount: 39, clubCode: "2338833" },
  ],
};
