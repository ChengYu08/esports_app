import type { ImageSource } from "expo-image";

export type MessageListItemModel = {
  id: string;
  kind: "system" | "conversation";
  title: string;
  preview: string;
  time: string;
  avatar: ImageSource | number;
  unreadCount?: number;
  clubId?: string;
  note?: string;
};
