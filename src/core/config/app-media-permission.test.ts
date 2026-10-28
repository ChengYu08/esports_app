import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type MediaLibraryPluginEntry = [
  string,
  { photosPermission: string; savePhotosPermission: boolean },
];

describe("expo-media-library 相册权限配置（双端审核要求）", () => {
  const appJson = JSON.parse(
    readFileSync(resolve(process.cwd(), "app.json"), "utf8"),
  ) as {
    expo: {
      plugins: unknown[];
    };
  };

  it("注册了 expo-media-library 插件并带中文相册权限文案", () => {
    const entry = appJson.expo.plugins.find(
      (plugin): plugin is MediaLibraryPluginEntry =>
        Array.isArray(plugin) && plugin[0] === "expo-media-library",
    );
    expect(entry).toBeTruthy();
    expect(entry![1].photosPermission).toContain("照片");
  });

  it("未配置保存到相册的多余权限（savePhotosPermission: false）", () => {
    const entry = appJson.expo.plugins.find(
      (plugin): plugin is MediaLibraryPluginEntry =>
        Array.isArray(plugin) && plugin[0] === "expo-media-library",
    );
    expect(entry).toBeTruthy();
    expect(entry![1].savePhotosPermission).toBe(false);
  });
});
