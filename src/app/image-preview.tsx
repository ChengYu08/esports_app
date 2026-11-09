import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";

import { ChatImagePreview } from "@/features/message/components/ChatImagePreview";
import { parseImagePreviewParams } from "@/features/mine/image-preview.params";
import { ImagePreview } from "@/shared/ui/ImagePreview";

export default function ImagePreviewScreen() {
  const params = useLocalSearchParams<{
    images?: string | string[];
    index?: string | string[];
    previewSessionId?: string | string[];
  }>();
  const { images, index } = useMemo(
    () => parseImagePreviewParams({ images: params.images, index: params.index }),
    [params.images, params.index],
  );
  const previewSessionId = Array.isArray(params.previewSessionId)
    ? params.previewSessionId[0]
    : params.previewSessionId;
  useEffect(() => {
    // 聊天图片预览只带会话 id，此时 images 必然为空，不能当成空列表直接返回
    if (!previewSessionId && images.length === 0) {
      router.back();
    }
  }, [images, previewSessionId]);
  if (previewSessionId) {
    return (
      <ChatImagePreview sessionId={previewSessionId} onClose={router.back} />
    );
  }
  return <ImagePreview images={images} index={index} onClose={router.back} />;
}
