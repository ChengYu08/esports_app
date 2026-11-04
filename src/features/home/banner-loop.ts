/** 无限轮播缓冲页：页数大于 1 时首尾各补一页，滑入缓冲页后瞬间跳回内容一致的真实页。 */
export function withLoopBuffers<T>(pages: T[]): T[] {
  if (pages.length < 2) {
    return pages;
  }
  return [pages[pages.length - 1], ...pages, pages[0]];
}

/** 缓冲布局下的物理页码转逻辑页码（0 起，用于指示点与自动轮播）。 */
export function toLogicalIndex(physicalIndex: number, pageCount: number): number {
  if (pageCount < 2) {
    return physicalIndex;
  }
  return (physicalIndex - 1 + pageCount) % pageCount;
}

/** 滑入首/尾缓冲页时应跳回的真实页偏移；不在缓冲页上时返回 null。 */
export function loopSnapOffset(
  physicalIndex: number,
  pageCount: number,
  width: number,
): number | null {
  if (pageCount < 2) {
    return null;
  }
  if (physicalIndex <= 0) {
    return width * pageCount;
  }
  if (physicalIndex >= pageCount + 1) {
    return width;
  }
  return null;
}
