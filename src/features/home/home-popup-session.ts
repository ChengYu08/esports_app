/** 本进程是否已展示过首页开屏弹窗（冷启动一次）。 */
let homePopupShownThisSession = false;

export function hasHomePopupShownThisSession(): boolean {
  return homePopupShownThisSession;
}

export function markHomePopupShownThisSession(): void {
  homePopupShownThisSession = true;
}

/** 仅供单测重置。 */
export function resetHomePopupShownThisSessionForTests(): void {
  homePopupShownThisSession = false;
}
