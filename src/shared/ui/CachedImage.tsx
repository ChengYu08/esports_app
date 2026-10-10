import { Image, type ImageProps } from "expo-image";

export function CachedImage({ cachePolicy = "memory-disk", ...props }: ImageProps) {
  return <Image {...props} cachePolicy={cachePolicy} />;
}
