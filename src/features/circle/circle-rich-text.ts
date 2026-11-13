/**
 * 视频正文/评论正文中的 @用户、#话题 结构化渲染（纯函数）。
 *
 * 契约与 PC mention-core 对齐：
 * - offset/length 按 Unicode 码点计（不是 UTF-16 的 string.length）；
 * - 后端带位置的实体数组优先；只有 id→昵称 字典时按昵称最长前缀匹配推导位置。
 */
import type { CircleContentRef } from "@/features/circle/circle-publish.api";
import { splitCircleTopicText } from "@/features/circle/circle-topic";

export type CircleRichTextSegment =
  | { text: string }
  | { text: string; topic: string }
  | { text: string; userId: string }
  | { text: string; unresolvedMention: true };

type MentionSource = CircleContentRef[] | Record<string, string> | undefined | null;

type RichEntity = { offset: number; length: number; text: string; topic?: string; userId?: string };

const toCodePoints = (text: string): string[] => Array.from(text);

function toRefEntities(source: MentionSource): CircleContentRef[] | null {
  if (!Array.isArray(source) || source.length === 0) {
    return null;
  }
  const refs = source
    .filter((item) => item != null && item.offset != null && item.length != null)
    .map((item) => ({
      id: String(item.id),
      label: item.label ?? "",
      offset: Number(item.offset),
      length: Number(item.length),
    }));
  return refs.length ? refs : null;
}

function toNameDict(source: MentionSource): Record<string, string> | null {
  if (!source) {
    return null;
  }
  if (!Array.isArray(source)) {
    return Object.keys(source).length ? source : null;
  }
  const dict: Record<string, string> = {};
  for (const item of source) {
    if (item?.id != null && item.label) {
      dict[String(item.id)] = item.label;
    }
  }
  return Object.keys(dict).length ? dict : null;
}

/** 按码点校验实体：slice(offset, offset+length) 必须等于 `@昵称`，否则降级为纯文本。 */
function cleanRefs(content: string, refs: CircleContentRef[]): CircleContentRef[] {
  const points = toCodePoints(content);
  return refs
    .filter((ref) => ref.id && ref.label)
    .map((ref) => {
      const target = toCodePoints(`@${ref.label}`);
      if (ref.offset < 0 || ref.offset + ref.length > points.length) {
        return null;
      }
      if (ref.length !== target.length) {
        return null;
      }
      for (let i = 0; i < target.length; i += 1) {
        if (points[ref.offset + i] !== target[i]) {
          return null;
        }
      }
      return ref;
    })
    .filter((ref): ref is CircleContentRef => ref != null)
    .sort((a, b) => a.offset - b.offset);
}

/** 只有字典（无位置）时，按昵称最长前缀匹配推导 @用户 位置。 */
function resolveByName(content: string, dict: Record<string, string>): CircleContentRef[] {
  const candidates = Object.entries(dict)
    .filter(([, name]) => Boolean(name))
    .map(([id, name]) => ({ id, label: name, points: toCodePoints(name) }))
    .sort((a, b) => b.points.length - a.points.length);
  const points = toCodePoints(content);
  const refs: CircleContentRef[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (points[i] !== "@") {
      continue;
    }
    const hit = candidates.find((candidate) => {
      if (i + 1 + candidate.points.length > points.length) {
        return false;
      }
      for (let k = 0; k < candidate.points.length; k += 1) {
        if (points[i + 1 + k] !== candidate.points[k]) {
          return false;
        }
      }
      return true;
    });
    if (!hit) {
      continue;
    }
    refs.push({ id: hit.id, label: hit.label, offset: i, length: hit.points.length + 1 });
    i += hit.points.length;
  }
  return refs;
}

/**
 * 把正文切成渲染片段：已绑定 ID 的 @用户 和 #话题 可点击；未绑定的 @文本可单独着色。
 *
 * @param mentions 后端 @用户 引用；RefVO 数组（带位置）优先，字典（id→昵称）回退推导。
 * @param highlightUnresolvedMentions 是否标记未绑定用户 ID 的 @文本。
 */
export function splitCircleRichText(
  content: string,
  mentions?: MentionSource,
  highlightUnresolvedMentions = false,
): CircleRichTextSegment[] {
  if (!content) {
    return [];
  }
  const points = toCodePoints(content);
  const byPosition = cleanRefs(content, toRefEntities(mentions) ?? []);
  const mentionRefs = byPosition.length ? byPosition : resolveByName(content, toNameDict(mentions) ?? {});

  // 话题沿用正则切分，换算成码点偏移。
  const topicEntities: RichEntity[] = [];
  let cursor = 0;
  for (const segment of splitCircleTopicText(content)) {
    const length = toCodePoints(segment.text).length;
    if (segment.topic) {
      topicEntities.push({ offset: cursor, length, text: segment.text, topic: segment.topic });
    }
    cursor += length;
  }

  const entities: RichEntity[] = [
    ...topicEntities,
    ...mentionRefs.map((ref) => ({
      offset: ref.offset,
      length: ref.length,
      text: points.slice(ref.offset, ref.offset + ref.length).join(""),
      userId: ref.id,
    })),
  ]
    // 同一位置若同时命中话题与 @用户，@用户优先；其余按 offset 升序。
    .sort((a, b) => {
      if (a.offset !== b.offset) {
        return a.offset - b.offset;
      }
      return (a.userId ? 0 : 1) - (b.userId ? 0 : 1);
    });

  const segments: CircleRichTextSegment[] = [];
  let offset = 0;
  let occupiedUntil = -1;
  for (const entity of entities) {
    if (entity.offset < occupiedUntil) {
      continue;
    }
    if (entity.offset > offset) {
      segments.push({ text: points.slice(offset, entity.offset).join("") });
    }
    segments.push(
      entity.userId != null
        ? { text: entity.text, userId: entity.userId }
        : { text: entity.text, topic: entity.topic as string },
    );
    offset = entity.offset + entity.length;
    occupiedUntil = offset;
  }
  if (offset < points.length) {
    segments.push({ text: points.slice(offset).join("") });
  }
  if (!highlightUnresolvedMentions) {
    return segments;
  }
  return segments.flatMap((segment) => {
    if ("topic" in segment || "userId" in segment) {
      return [segment];
    }
    const parts: CircleRichTextSegment[] = [];
    const pattern = /@[\p{L}\p{N}_-]+/gu;
    let previousEnd = 0;
    for (const match of segment.text.matchAll(pattern)) {
      if (match.index > previousEnd) {
        parts.push({ text: segment.text.slice(previousEnd, match.index) });
      }
      parts.push({ text: match[0], unresolvedMention: true });
      previousEnd = match.index + match[0].length;
    }
    if (previousEnd < segment.text.length) {
      parts.push({ text: segment.text.slice(previousEnd) });
    }
    return parts;
  });
}
