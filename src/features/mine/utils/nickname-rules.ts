/**
 * 编辑名字页的昵称校验规则（与设计稿补充说明一致）：
 * 1. 不能包含 @ < > / 等无效字符 → "不能包含@<>/等无效字符"
 * 2. 去除首尾空格后长度须为 2-24 个字符（按字符计，emoji 计 1）
 *    → "请设置2-24个字符"
 * 返回 null 表示校验通过。
 */
export function validateNickname(value: string): string | null {
  if (/[@<>//]/.test(value)) {
    return "不能包含@<>/等无效字符";
  }
  const length = Array.from(value.trim()).length;
  if (length < 2 || length > 24) {
    return "请设置2-24个字符";
  }
  return null;
}
