import { createImagePreviewParams } from "./image-preview.params.ts";

export function createProfileAvatarPreviewParams(avatarUrl?: string) {
  const normalizedUrl = avatarUrl?.trim();
  return normalizedUrl ? createImagePreviewParams([normalizedUrl], 0) : null;
}
