import type { MessageListItemModel } from "./message.types";

const avatars = {
  system: require("../../../assets/message/message-system.svg"),
  wangzhe: require("../../../assets/message/avatar-wangzhe.svg"),
  sorry: require("../../../assets/message/avatar-sorry.svg"),
  delta: require("../../../assets/message/avatar-delta.svg"),
  ada: require("../../../assets/message/avatar-ada.svg"),
};

export const MESSAGE_ITEMS = [
  {
    id: "system-notice",
    kind: "system",
    title: "系统通知",
    preview: "帖子举报成功",
    time: "11:40",
    avatar: avatars.system,
  },
  {
    id: "wangzhe-xiaodaji",
    kind: "conversation",
    title: "王者小妲己",
    preview: "谢谢你的关注！欢迎友好交流呀～",
    time: "9:40",
    avatar: avatars.wangzhe,
  },
  {
    id: "sorry-quanchang",
    kind: "conversation",
    title: "Sorry全场",
    preview: "你指的方法具体是什么？那关怎么过啊？能不能详细给我说说，我真求求了🥺",
    time: "昨天 23:24",
    avatar: avatars.sorry,
  },
  {
    id: "delta-guide",
    kind: "conversation",
    title: "三角洲攻略哥",
    preview:
      "刚发现运河地图有个邪道点位：开局用C4炸码头木箱，能卡进集装箱夹层，视野覆盖全部人质房窗口。需要队友配合声东击西",
    time: "1-15",
    avatar: avatars.delta,
  },
  {
    id: "ada-wang",
    kind: "conversation",
    title: "A达王",
    preview: "嗯嗯，下次聊👋",
    time: "2025-12-29",
    avatar: avatars.ada,
  },
] satisfies readonly MessageListItemModel[];
