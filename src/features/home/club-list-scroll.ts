/** 首页列表滚动状态：scrolling 驱动轮播暂停与分页挂起。 */
export type ClubListScrollState = {
  scrolling: boolean;
  /** 滚动中触底记录的意图，滚动稳定后由调用方补发分页。 */
  pendingEndReached: boolean;
};

/** 结束拖拽/惯性后等待稳定的时间；期间再拖拽会取消定时器。 */
export const CLUB_LIST_SCROLL_SETTLE_MS = 150;

export const initialClubListScrollState: ClubListScrollState = {
  scrolling: false,
  pendingEndReached: false,
};

export function beginClubListScroll(state: ClubListScrollState): ClubListScrollState {
  if (state.scrolling) {
    return state;
  }
  return { scrolling: true, pendingEndReached: state.pendingEndReached };
}

export function markClubListEndReached(state: ClubListScrollState): ClubListScrollState {
  if (!state.scrolling) {
    return state;
  }
  return { scrolling: true, pendingEndReached: true };
}

export function settleClubListScroll(state: ClubListScrollState): ClubListScrollState {
  if (!state.scrolling && !state.pendingEndReached) {
    return state;
  }
  return initialClubListScrollState;
}
