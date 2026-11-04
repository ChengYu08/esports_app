import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";

import { parseImagePreviewParams } from "@/features/mine/image-preview.params";
import { ImagePreview } from "@/shared/ui/ImagePreview";

export default function ImagePreviewScreen() {
  const params = useLocalSearchParams<{ images?: string | string[]; index?: string | string[] }>();
  const { images, index } = useMemo(
    () => parseImagePreviewParams({ images: params.images, index: params.index }),
    [params.images, params.index],
  );
  useEffect(() => {
    if (images.length === 0) {
      router.back();
    }
  }, [images]);
  return <ImagePreview images={images} index={index} onClose={router.back} />;
}
