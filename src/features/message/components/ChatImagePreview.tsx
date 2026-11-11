import { useCallback, useEffect, useRef } from "react";

import {
  closeChatImagePreviewSession,
  readChatImagePreviewSession,
} from "@/features/message/chat-image-preview-session";
import { messageStore } from "@/features/message/message-store";
import { saveChatImageToAlbum } from "@/features/message/save-chat-image";
import { ImagePreview } from "@/shared/ui/ImagePreview";

type ChatImagePreviewProps = {
  sessionId: string;
  onClose: () => void;
};

export function ChatImagePreview({ sessionId, onClose }: ChatImagePreviewProps) {
  const session = readChatImagePreviewSession(sessionId);

  useEffect(
    () => () => {
      closeChatImagePreviewSession(sessionId);
    },
    [sessionId],
  );

  // 已解析的地址按页缓存：SDK 下载不保证去重，保存时复用同一次下载结果
  const resolvedByIndex = useRef(new Map<number, string>());
  // 融云远端图片地址直连会 401，必须经 SDK 下载；点开的那张打开前已下载好。
  // 用 getState 取消息而不是订阅，避免预览期间收到新消息时回调换引用、当前页重复下载
  const resolveAtIndex = useCallback(
    async (index: number) => {
      const target = session?.messages[index];
      if (!session || !target) {
        throw new Error("预览会话已失效，请重新打开");
      }
      const cached = resolvedByIndex.current.get(index);
      if (cached) {
        return cached;
      }
      const uri = index === session.index
        ? session.resolvedUri
        : await messageStore.getState().resolveImagePreview(target);
      resolvedByIndex.current.set(index, uri);
      return uri;
    },
    [session],
  );

  // 保存当前页：先按预览同一套逻辑拿到可访问的本地文件（远端图片经 SDK 下载），再写相册
  const saveAt = useCallback(
    async (index: number) => {
      const target = session?.messages[index];
      if (!session || !target) {
        throw new Error("预览会话已失效，请重新打开");
      }
      const uri = await resolveAtIndex(index);
      await saveChatImageToAlbum(uri);
    },
    [resolveAtIndex, session],
  );

  if (!session) {
    return <ImagePreview images={[]} index={0} onClose={onClose} />;
  }

  return (
    <ImagePreview
      images={session.messages.map((message) => message.imageUrl)}
      index={session.index}
      onClose={onClose}
      resolveAtIndex={resolveAtIndex}
      onSaveImage={saveAt}
    />
  );
}
