/**
 * 昵称编辑页的昵称校验规则（与后端 UserNicknameUtils 对齐）：
 * 1. 仅支持中文、英文、数字、空格、下划线、短横线和英文点号
 *    → "不能包含@<>/等无效字符"
 * 2. 去除首尾空格后长度须为 2-20 个字符 → "请设置2-20个字符"
 * 返回 null 表示校验通过。
 */
const NICKNAME_ALLOWED = /^[\u4E00-\u9FFFA-Za-z0-9_. -]+$/;
const ARCHIVED_SUFFIX = /_已注销_[0-9]+$/;

export function validateNickname(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed && !NICKNAME_ALLOWED.test(trimmed)) {
    return "不能包含@<>/等无效字符";
  }
  const length = Array.from(trimmed).length;
  if (length < 2 || length > 20) {
    return "请设置2-20个字符";
  }
  if (ARCHIVED_SUFFIX.test(trimmed)) {
    return "昵称不能使用系统注销保留格式";
  }
  return null;
}
