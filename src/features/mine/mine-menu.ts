/**
 * 我的页功能入口组装规则（与 PC 端对齐，前端只做展示映射）：
 * - 优先使用服务端 login/info 下发的 sidebarMenus（SidebarMenuEnum code，按展示顺序）；
 * - 服务端未下发时按本地身份推导兜底，规则与 pzdj-service resolveSidebarMenus 一致
 *   （clubAdmin 字段本地推导无法识别负责人，负责人入口以服务端下发为准）。
 */
export type MineMenuKey =
  | "CLUB_JOIN"
  | "BECOME_PLAYMATE"
  | "CLUB_ADMIN"
  | "PLAYMATE_MANAGE"
  | "MY_ORDERS";

const KNOWN_MENU_KEYS: readonly string[] = [
  "CLUB_JOIN",
  "BECOME_PLAYMATE",
  "CLUB_ADMIN",
  "PLAYMATE_MANAGE",
  "MY_ORDERS",
];

export function resolveMineMenuKeys(
  sidebarMenus: string[] | undefined,
  identity: { hasClub: boolean; isCompanion: boolean },
): MineMenuKey[] {
  if (sidebarMenus && sidebarMenus.length > 0) {
    const known = sidebarMenus.filter((code): code is MineMenuKey =>
      KNOWN_MENU_KEYS.includes(code),
    );
    if (known.length > 0) {
      return known;
    }
  }
  const menus: MineMenuKey[] = [];
  if (identity.hasClub) {
    if (identity.isCompanion) {
      menus.push("PLAYMATE_MANAGE");
    } else {
      menus.push("BECOME_PLAYMATE");
    }
  } else {
    menus.push("CLUB_JOIN");
    menus.push("BECOME_PLAYMATE");
  }
  menus.push("MY_ORDERS");
  return menus;
}
