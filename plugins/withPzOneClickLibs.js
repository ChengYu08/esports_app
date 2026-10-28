const { withProjectBuildGradle } = require("expo/config-plugins");

const LIBS_MARKER = "modules/pz-one-click/android/libs";

// pz-one-click 本地 .aar 依赖（AGP 禁止 library 直接 fileTree 引用 .aar，
// 模块内用 flatDir 按名引用；:app 解析运行时类path时也需要同名仓库，见下）
const FLATDIR_SNIPPET = [
  "    repositories {",
  "        // pz-one-click 本地 .aar 依赖（AGP 禁止 library 直接 fileTree 引用 .aar，改 flatDir）",
  `        flatDir { dirs "$rootDir/../${LIBS_MARKER}" }`,
  "    }",
].join("\n");

/**
 * 根 android/build.gradle 的 allprojects 里注入 pz-one-click 本地 AAR 的 flatDir 仓库。
 * android/ 走 CNG（gitignore），CI 每次全新 prebuild，没有这一步 :app 解析
 * pz-one-click 的 AAR 依赖会报 "Could not find :auth_number_product-..."。
 */
function withPzOneClickLibs(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy") {
      throw new Error("withPzOneClickLibs 仅支持 Groovy 版根 build.gradle");
    }
    // 已存在则跳过，避免重复写入
    if (mod.modResults.contents.includes(LIBS_MARKER)) {
      return mod;
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      /allprojects\s*\{/,
      (match) => `${match}\n${FLATDIR_SNIPPET}`,
    );
    return mod;
  });
}

module.exports = withPzOneClickLibs;
