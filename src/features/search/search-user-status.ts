export function getSearchUserStatus(onlineStatus?: number, gameStatus?: number) {
  if (onlineStatus !== 1 || (gameStatus !== 0 && gameStatus !== 1)) {
    return null;
  }
  return gameStatus === 1 ? "playing" : "idle";
}
