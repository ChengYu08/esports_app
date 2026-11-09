import { useCallback, useEffect } from "react";

import {
  closeChatImagePreviewSession,
  readChatImagePreviewSession,
} from "@/features/message/chat-image-preview-session";
import { messageStore } from "@/features/message/message-store";
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

  // 融云远端图片地址直连会 401，必须经 SDK 下载；点开的那张打开前已下载好。
  // 用 getState 取消息而不是订阅，避免预览期间收到新消息时回调换引用、当前页重复下载
  const resolveAtIndex = useCallback(
    async (index: number) => {
      const target = session?.messages[index];
      if (!session || !target) {
        throw new Error("预览会话已失效，请重新打开");
      }
      if (index === session.index) {
        return session.resolvedUri;
      }
      return messageStore.getState().resolveImagePreview(target);
    },
    [session],
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
    />
  );
}
