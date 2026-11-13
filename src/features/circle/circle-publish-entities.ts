import type { CircleContentRef } from "@/features/circle/circle-publish.api";

/**
 * 发布正文的实体提取（纯函数，RN 无富文本编辑器的替代方案）。
 *
 * 与 PC mention-core 契约对齐：
 * - offset/length 按 Unicode 码点计（emoji 不致错位）；
 * - 正文里必须真实出现 "触发符+label"（用户删半截则降级为纯文本，不提交实体）；
 * - 同一选中项的多次出现各生成一个实体，按 offset 升序输出。
 */

const toCodePoints = (text: string): string[] => Array.from(text);

/**
 * 从正文扫描已选中话题/@用户的出现位置，构建后端 ContentRef 列表。
 *
 * @param selected 用户经面板选中过的话题/用户（手打且未选中的不成为实体）
 * @param trigger 话题为 "#"，@用户为 "@"
 */
export function buildCircleContentRefs(
  content: string,
  selected: { id: string; label: string }[],
  trigger: "#" | "@",
): CircleContentRef[] {
  if (selected.length === 0 || !content) {
    return [];
  }
  const points = toCodePoints(content);
  const refs: CircleContentRef[] = [];
  const seen = new Set<string>();

  for (const item of selected) {
    if (!item.id || !item.label) {
      continue;
    }
    const target = toCodePoints(`${trigger}${item.label}`);
    for (let start = 0; start + target.length <= points.length; start += 1) {
      let matched = true;
      for (let i = 0; i < target.length; i += 1) {
        if (points[start + i] !== target[i]) {
          matched = false;
          break;
        }
      }
      if (!matched) {
        continue;
      }
      const key = `${start}:${target.length}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push({
          id: item.id,
          label: item.label,
          offset: start,
          length: target.length,
        });
      }
    }
  }

  return refs.sort((a, b) => a.offset - b.offset);
}

/**
 * 按码点截取正文（提交前自检用，slice(offset, offset+length) 应等于触发符+label）。
 */
export function sliceByCodePoints(content: string, start: number, length: number): string {
  return toCodePoints(content).slice(start, start + length).join("");
}

/** 内容结尾处的待选关键词：形如 "#游戏"、"@张三"（用于面板自动唤起与过滤）。 */
export function activeTriggerDraft(content: string): { trigger: "#" | "@"; keyword: string } | null {
  const match = /([#@])([^#\s@]*)$/.exec(content);
  if (!match) {
    return null;
  }
  return { trigger: match[1] as "#" | "@", keyword: match[2] };
}

/**
 * 选中话题/用户后回写正文：把结尾的触发符草稿替换为完整 "触发符+label "。
 * 结尾没有草稿时直接追加（与评论面板交互一致）。
 */
export function applyTriggerSelection(content: string, trigger: "#" | "@", label: string): string {
  const draft = activeTriggerDraft(content);
  if (draft && draft.trigger === trigger) {
    return `${content.slice(0, content.length - draft.keyword.length)}${label} `;
  }
  const prefix = content.endsWith(trigger) ? content : `${content}${trigger}`;
  return `${prefix}${label} `;
}

/** 记录面板选中的实体位置；同名用户也保留各自的 ID。 */
export function applyCircleRefSelection(
  content: string,
  trigger: "#" | "@",
  selected: { id: string; label: string },
): { content: string; ref: CircleContentRef } {
  const nextContent = applyTriggerSelection(content, trigger, selected.label);
  const length = toCodePoints(`${trigger}${selected.label}`).length;
  return {
    content: nextContent,
    ref: {
      id: selected.id,
      label: selected.label,
      offset: toCodePoints(nextContent).length - length - 1,
      length,
    },
  };
}

/** 输入框改变文字时移动未受影响的实体；改到实体内部则取消关联。 */
export function shiftCircleContentRefs(
  before: string,
  after: string,
  refs: CircleContentRef[],
  trigger: "#" | "@",
): CircleContentRef[] {
  const oldPoints = toCodePoints(before);
  const newPoints = toCodePoints(after);
  let prefix = 0;
  while (prefix < Math.min(oldPoints.length, newPoints.length)
    && oldPoints[prefix] === newPoints[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (suffix < Math.min(oldPoints.length, newPoints.length) - prefix
    && oldPoints[oldPoints.length - suffix - 1] === newPoints[newPoints.length - suffix - 1]) {
    suffix += 1;
  }
  const oldChangedEnd = oldPoints.length - suffix;
  const delta = newPoints.length - oldPoints.length;

  return refs.flatMap((ref) => {
    let offset = ref.offset;
    if (ref.offset + ref.length <= prefix) {
      // 实体在修改位置之前。
    } else if (ref.offset >= oldChangedEnd) {
      offset += delta;
    } else {
      return [];
    }
    const nextRef = { ...ref, offset };
    return sliceByCodePoints(after, offset, ref.length) === `${trigger}${ref.label}`
      ? [nextRef]
      : [];
  });
}
