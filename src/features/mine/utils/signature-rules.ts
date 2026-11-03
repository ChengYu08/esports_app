/**
 * 编辑个性签名页的校验规则：
 * 超过 60 个字符（按字符计，emoji 计 1）→ "简介内容不能超过60字"。
 * 空值表示清空简介，校验通过。返回 null 表示校验通过。
 */
export function validateSignature(value: string): string | null {
  if (Array.from(value).length > 60) {
    return "简介内容不能超过60字";
  }
  return null;
}
