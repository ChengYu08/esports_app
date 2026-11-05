/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");

// 对齐 Reanimated 上游 #10435：跳过已卸载视图的同步更新。
const packageDir = path.join(__dirname, "..", "node_modules", "react-native-reanimated");
const version = require(path.join(packageDir, "package.json")).version;
if (version !== "4.5.1") {
  throw new Error(`请检查 Reanimated ${version} 是否已包含上游 #10435，然后更新补丁。`);
}
const file = path.join(packageDir, "android", "src", "main", "java", "com", "swmansion", "reanimated", "NativeProxy.kt");
let source = fs.readFileSync(file, "utf8");
const marker = "private val getViewExistsMethod by lazy";
if (source.includes(marker) && !source.includes("getViewExistsMethod.invoke(mountingManager, viewTag) != true")) {
  throw new Error("Reanimated 视图检查补丁不完整，请检查依赖源码。");
}
if (!source.includes(marker)) {
  const declaration = "    private val updatePropsSynchronouslyMethod by lazy {";
  const invoke = "                    updatePropsSynchronouslyMethod.invoke(mountingManager, viewTag, props)";
  if (!source.includes(declaration) || !source.includes(invoke)) {
    throw new Error("Reanimated 源码与预期不一致，无法安全应用视图检查补丁。");
  }
  source = source.replace(declaration, `    private val getViewExistsMethod by lazy {
        mountingManager.javaClass.getMethod("getViewExists", Int::class.javaPrimitiveType)
            .apply { isAccessible = true }
    }

${declaration}`);
  source = source.replace(invoke, `                    if (getViewExistsMethod.invoke(mountingManager, viewTag) != true) {
                        return@parse
                    }
${invoke}`);
  fs.writeFileSync(file, source);
  console.log("已应用 Reanimated Android 已卸载视图保护补丁。");
}
