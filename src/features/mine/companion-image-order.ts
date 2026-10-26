import type { ManagedImage } from "./api/companion-management.contract";

/** 接口按递增的 sortNo 追加图片，因此展示时最新的排在最前面。 */
export function newestCompanionImages(images: readonly ManagedImage[]) {
  return [...images].sort(
    (a, b) => (b.sortNo ?? 0) - (a.sortNo ?? 0) || b.id - a.id,
  );
}
