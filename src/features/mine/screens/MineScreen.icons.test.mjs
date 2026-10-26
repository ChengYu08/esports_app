import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("./MineScreen.tsx", import.meta.url);

test("首页菜单固定为我的房间/陪玩管理/基础设置三项且使用设计稿 SVG 图标", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.doesNotMatch(source, /@expo\/vector-icons/);
  // 菜单顺序固定：我的房间 → 陪玩管理/成为陪玩师 → 基础设置
  assert.match(source, /title: (openingVoiceRoom \? "正在进入房间" : )?"我的房间"/);
  assert.match(source, /title: isCompanion \? "陪玩管理" : "成为陪玩师"/);
  assert.match(source, /title: "基础设置"/);
  assert.match(source, /icon: menuRoomIcon/);
  assert.match(source, /icon: menuCompanionIcon/);
  assert.match(source, /icon: menuSettingsIcon/);
});
