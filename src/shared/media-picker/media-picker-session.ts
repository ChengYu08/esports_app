type MediaPickResolver = ((uris: string[] | null) => void) | null;

/**
 * 调用方与媒体选择页（/media-picker）之间的会话桥接：
 * 调用方在跳转前调用 beginMediaPick() 持有 promise，
 * 选择页结束时调用 completeMediaPick(uris) 回传结果（null=取消）。
 * 同一时刻仅允许一个 pending 会话；未 begin 时 complete 为 no-op。
 */
let resolver: MediaPickResolver = null;

export function beginMediaPick(): Promise<string[] | null> {
  // 并发 begin 时旧会话直接终结（null），避免旧调用方永久悬挂
  const previous = resolver;
  return new Promise<string[] | null>((resolve) => {
    resolver = resolve;
    previous?.(null);
  });
}

export function completeMediaPick(uris: string[] | null): void {
  const current = resolver;
  resolver = null;
  current?.(uris);
}

/** 是否仍有未终结的会话（供页面卸载兜底判断，避免误吞已完成的会话）。 */
export function isMediaPickActive(): boolean {
  return resolver !== null;
}
