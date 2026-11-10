import { describe, expect, it } from "vitest";

import { resolveMineMenuKeys } from "./mine-menu";

describe("resolveMineMenuKeys", () => {
  it("服务端下发时按展示顺序原样采用，未知 code 过滤", () => {
    expect(
      resolveMineMenuKeys(["CLUB_ADMIN", "UNKNOWN_CODE", "MY_ORDERS"], {
        hasClub: true,
        isCompanion: true,
      }),
    ).toEqual(["CLUB_ADMIN", "MY_ORDERS"]);
  });

  it("服务端下发空列表时按本地身份兜底：未入俱乐部", () => {
    expect(
      resolveMineMenuKeys(undefined, { hasClub: false, isCompanion: false }),
    ).toEqual(["CLUB_JOIN", "BECOME_PLAYMATE", "MY_ORDERS"]);
  });

  it("兜底：已入俱乐部普通成员只给成为大神", () => {
    expect(
      resolveMineMenuKeys([], { hasClub: true, isCompanion: false }),
    ).toEqual(["BECOME_PLAYMATE", "MY_ORDERS"]);
  });

  it("兜底：已入俱乐部大神给大神管理", () => {
    expect(
      resolveMineMenuKeys([], { hasClub: true, isCompanion: true }),
    ).toEqual(["PLAYMATE_MANAGE", "MY_ORDERS"]);
  });

  it("兜底无法识别俱乐部负责人（负责人入口以服务端下发为准）", () => {
    expect(
      resolveMineMenuKeys(undefined, { hasClub: true, isCompanion: false }),
    ).toEqual(["BECOME_PLAYMATE", "MY_ORDERS"]);
  });
});
