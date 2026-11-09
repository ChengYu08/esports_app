/** 接口话题可能自带多个 #，路由参数只传纯话题名。 */
export function normalizeCircleTopicName(tag: string) {
  return tag.trim().replace(/^#+/, "").trim();
}

/** 所有话题入口统一进入搜索页的话题瀑布流。 */
export function buildCircleTopicRoute(tag: string) {
  const topic = normalizeCircleTopicName(tag);
  if (!topic) {
    return null;
  }
  return {
    pathname: "/circle/search" as const,
    params: { topic },
  };
}

/** 提取正文和评论中以 # 开头的话题，保留普通文字及标点。 */
export function splitCircleTopicText(content: string) {
  const segments: { text: string; topic?: string }[] = [];
  const pattern = /#[\p{L}\p{N}_-]+/gu;
  let previousEnd = 0;

  for (const match of content.matchAll(pattern)) {
    const start = match.index;
    if (start > previousEnd) {
      segments.push({ text: content.slice(previousEnd, start) });
    }
    segments.push({ text: match[0], topic: match[0].slice(1) });
    previousEnd = start + match[0].length;
  }

  if (previousEnd < content.length) {
    segments.push({ text: content.slice(previousEnd) });
  }

  return segments;
}
