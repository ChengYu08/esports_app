const { withProjectBuildGradle } = require("expo/config-plugins");

const LIBS_MARKER = "modules/pz-one-click/android/libs";

// pz-one-click 本地 .aar 依赖（AGP 禁止 library 直接 fileTree 引用 .aar，
// 模块内用 flatDir 按名引用；:app 解析运行时类path时也需要同名仓库，见下）
// 注意：必须插入 allprojects 块内的 repositories 中，不能落在
// buildscript.repositories 里——后者只对 classpath 生效，app 的
// debugRuntimeClasspath 解析不到本地 AAR 会报 "Could not find :xxx-release"。
// 也不能紧跟 "allprojects {" 之后——模板还会注入自己的 repositories 块，
// 插在块外会报 "Could not find method maven()"。
const FLATDIR_LINE = `        flatDir { dirs "$rootDir/../${LIBS_MARKER}" } // pz-one-click 本地 .aar 依赖`;

/**
 * 根 android/build.gradle 的 allprojects.repositories 里注入 pz-one-click 本地 AAR 的 flatDir 仓库。
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
    // 锚定 allprojects 内第一个仓库语句，保证 flatDir 落在 allprojects 的 repositories 块里
    const anchor = mod.modResults.contents.match(/allprojects\s*\{[\s\S]*?^\s+mavenCentral\(\)/m);
    if (!anchor) {
      throw new Error("withPzOneClickLibs: 未找到 allprojects 内的 mavenCentral() 锚点");
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      anchor[0],
      anchor[0].replace(/mavenCentral\(\)/, `${FLATDIR_LINE}\n    mavenCentral()`),
    );
    return mod;
  });
}

module.exports = withPzOneClickLibs;
