const { withProjectBuildGradle } = require("expo/config-plugins");

const LIBS_MARKER = "modules/pz-one-click/android/libs";

// pz-one-click 本地 .aar 依赖（AGP 禁止 library 直接 fileTree 引用 .aar，
// 模块内用 flatDir 按名引用；:app 解析运行时类path时也需要同名仓库，见下）
// 注意：必须锚定已有仓库语句插入，不能紧跟 "allprojects {" 之后——
// 模板自身还会往 allprojects 里注入 repositories 块，插在块外会导致
// 后续 maven 调用被解析到 root project 上而报
// "Could not find method maven()"（Drone 构建失败即此因）。
const FLATDIR_LINE = `        flatDir { dirs "$rootDir/../${LIBS_MARKER}" } // pz-one-click 本地 .aar 依赖`;

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
    // 锚定 allprojects 内第一个仓库语句，保证 flatDir 落在 repositories 块里
    const anchor = mod.modResults.contents.match(/^\s+mavenCentral\(\)/m);
    if (!anchor) {
      throw new Error("withPzOneClickLibs: 未找到 mavenCentral() 锚点");
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      anchor[0],
      `${FLATDIR_LINE}\n${anchor[0]}`,
    );
    return mod;
  });
}

module.exports = withPzOneClickLibs;
