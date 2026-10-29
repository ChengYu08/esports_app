/** 生日滚轮选择的纯函数集合（不依赖 react-native，可在 vitest 中测试）。 */

/** 某年某月的天数（month: 1-12）。 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 生日可选年份范围：当年往前 101 年（含当年），月固定 1-12。 */
export function buildBirthdayColumns(today: Date): {
  years: number[];
  months: number[];
  currentYear: number;
} {
  const currentYear = today.getFullYear();
  const years: number[] = [];
  for (let year = currentYear - 100; year <= currentYear; year += 1) {
    years.push(year);
  }
  return { years, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], currentYear };
}

/** 日随年月联动：超出当月最大日时钳回。 */
export function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

/** 解析 "YYYY-MM-DD"，非法时回退 fallback。 */
export function parseBirth(
  birth: string | null | undefined,
  fallback: { y: number; m: number; d: number },
): { y: number; m: number; d: number } {
  const match = (birth ?? "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    return fallback;
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    return fallback;
  }
  return { y, m, d };
}

/** 输出 "YYYY-MM-DD"（月日两位补零）。 */
export function formatBirth(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}
