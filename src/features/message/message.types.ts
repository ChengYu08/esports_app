import type { ImageSource } from "expo-image";

export type MessageListItemModel = {
  id: string;
  kind: "system" | "conversation";
  title: string;
  preview: string;
  time: string;
  avatar: ImageSource | number;
  unreadCount?: number;
  isOnline?: boolean;
  isPinned?: boolean;
  /** 官方客服会话：昵称右侧展示「官方客服」标签 */
  isCustomerService?: boolean;
  clubId?: string;
  note?: string;
};
