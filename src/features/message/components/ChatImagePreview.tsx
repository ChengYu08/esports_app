import { useCallback } from "react";

import type { ManagedMessage } from "@/features/message/message-state";
import { messageStore, useMessageStore } from "@/features/message/message-store";
import { ImagePreview } from "@/shared/ui/ImagePreview";

type ChatImagePreviewProps = {
  conversationId: string;
  images: string[];
  index: number;
  onClose: () => void;
};

export function ChatImagePreview({
  conversationId,
  images,
  index,
  onClose,
}: ChatImagePreviewProps) {
  const resolveImagePreview = useMessageStore((state) => state.resolveImagePreview);

  // 融云远端图片地址直连会 401，必须经 SDK 下载；本地文件地址直接原样返回。
  // 用 getState 取消息而不是订阅，避免预览期间收到新消息时回调换引用、当前页重复下载
  const resolveUri = useCallback(
    async (uri: string) => {
      const messages = messageStore.getState().messagesByPeerId[conversationId];
      const message = messages?.find(
        (item): item is Extract<ManagedMessage, { kind: "image" }> =>
          item.kind === "image" && item.imageUrl === uri,
      );
      if (!message) {
        return uri;
      }
      return resolveImagePreview(message);
    },
    [conversationId, resolveImagePreview],
  );

  return (
    <ImagePreview
      images={images}
      index={index}
      onClose={onClose}
      resolveUri={resolveUri}
    />
  );
}