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
  clubId?: string;
  note?: string;
};
