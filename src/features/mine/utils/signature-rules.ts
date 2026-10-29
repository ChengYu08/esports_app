/**
 * 编辑个性签名页的校验规则（与设计稿补充说明一致）：
 * 超过 100 个字符（按字符计，emoji 计 1）→ "简介内容不能超过100字"。
 * 空值表示清空简介，校验通过。返回 null 表示校验通过。
 */
export function validateSignature(value: string): string | null {
  if (Array.from(value).length > 100) {
    return "简介内容不能超过100字";
  }
  return null;
}
