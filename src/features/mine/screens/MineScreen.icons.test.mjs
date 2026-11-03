import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("./MineScreen.tsx", import.meta.url);

test("我的页菜单使用动态入口与设计稿 SVG 图标", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.doesNotMatch(source, /@expo\/vector-icons/);
  assert.match(source, /title: (openingVoiceRoom \? "正在进入房间" : )?"我的房间"/);
  assert.match(source, /case "BECOME_PLAYMATE"/);
  assert.match(source, /title: "成为陪玩"/);
  assert.match(source, /case "PLAYMATE_MANAGE"/);
  assert.match(source, /title: "陪玩中心"/);
  assert.match(source, /title: "基础设置"/);
  assert.match(source, /title: "在线客服"/);
  assert.match(source, /icon: menuIcon\(menuRoomIcon\)/);
  assert.match(source, /icon: menuIcon\(menuCompanionIcon\)/);
  assert.match(source, /icon: menuIcon\(menuSettingsIcon\)/);
  assert.match(source, /icon: menuIcon\(menuServiceIcon\)/);
});
