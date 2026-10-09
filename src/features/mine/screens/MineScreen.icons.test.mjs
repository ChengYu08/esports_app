import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("./MineScreen.tsx", import.meta.url);

test("uses Fluent UI icons for every account menu item", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /from "@fluentui\/react-native-icons"/);
  assert.doesNotMatch(source, /@expo\/vector-icons/);
  assert.match(source, /title: "基础设置",\s*icon: Settings24Regular/s);
  assert.match(source, /title: "修改密码",\s*icon: Password24Regular/s);
  assert.match(source, /title: "黑名单",\s*icon: PersonProhibited24Regular/s);
  assert.match(source, /title: "用户协议",\s*icon: DocumentText24Regular/s);
  assert.match(source, /title: "隐私协议",\s*icon: ShieldKeyhole24Regular/s);
  assert.match(source, /title: "注销账号",\s*icon: PersonDelete24Regular/s);
});
