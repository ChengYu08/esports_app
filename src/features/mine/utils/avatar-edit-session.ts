type AvatarEditResolver = ((uri: string | null) => void) | null;

/**
 * 编辑资料页与相册/裁剪页之间的会话桥接：
 * EditProfileScreen 在进入流程前调用 beginAvatarEdit() 持有 promise，
 * 相册页/裁剪页结束时调用 completeAvatarEdit(uri) 回传结果（null=取消）。
 * 同一时刻仅允许一个 pending 会话；未 begin 时 complete 为 no-op。
 */
let resolver: AvatarEditResolver = null;

export function beginAvatarEdit(): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    resolver = resolve;
  });
}

export function completeAvatarEdit(uri: string | null): void {
  const current = resolver;
  resolver = null;
  current?.(uri);
}

/** 是否仍有未终结的会话（供页面卸载兜底判断，避免误吞已完成的会话）。 */
export function isAvatarEditActive(): boolean {
  return resolver !== null;
}
