/**
 * 版本号比较（与后端 VersionNoUtils 行为对齐）：
 * 按 "." 分段取前导数字逐段比较，缺失段补 0；v 前缀与非数字段容错。
 * 返回：a<b → -1，相等 → 0，a>b → 1。
 */
export function compareVersionNos(a: string, b: string): -1 | 0 | 1 {
  const parse = (version: string): number[] => {
    const normalized = (version ?? "").trim().replace(/^[vV]/, "");
    if (!normalized) {
      return [0];
    }
    return normalized.split(".").map((part) => {
      const match = part.match(/^\d+/);
      return match ? Number(match[0]) : 0;
    });
  };

  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const x = i < left.length ? left[i] : 0;
    const y = i < right.length ? right[i] : 0;
    if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}
