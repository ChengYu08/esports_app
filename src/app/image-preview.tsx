import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";

import { ChatImagePreview } from "@/features/message/components/ChatImagePreview";
import { parseImagePreviewParams } from "@/features/mine/image-preview.params";
import { ImagePreview } from "@/shared/ui/ImagePreview";

export default function ImagePreviewScreen() {
  const params = useLocalSearchParams<{
    images?: string | string[];
    index?: string | string[];
    conversationId?: string | string[];
  }>();
  const { images, index } = useMemo(
    () => parseImagePreviewParams({ images: params.images, index: params.index }),
    [params.images, params.index],
  );
  const conversationId = Array.isArray(params.conversationId)
    ? params.conversationId[0]
    : params.conversationId;
  useEffect(() => {
    if (images.length === 0) {
      router.back();
    }
  }, [images]);
  if (conversationId) {
    return (
      <ChatImagePreview
        conversationId={conversationId}
        images={images}
        index={index}
        onClose={router.back}
      />
    );
  }
  return <ImagePreview images={images} index={index} onClose={router.back} />;
}
