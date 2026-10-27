# Android release APK

推荐用 npm scripts（Windows / macOS / Linux 一致）：

```bash
npm run build:apk              # 仅 ARM64（默认）
npm run build:apk:arm64        # 同上
npm run build:apk:universal    # ARM64 + ARM32（armeabi-v7a,arm64-v8a）
npm run build:apk:all          # 一轮打出上述两个 APK
npm run build:apk:init-signing # 仅校验/初始化签名
```

也可直接跑底层脚本（功能等价）：

```bash
node scripts/build_apk.cjs --abi arm64
node scripts/build_apk.cjs --abi universal
node scripts/build_apk.cjs --abi all
./scripts/build_apk.sh --abi all
```

- `build_apk.cjs`：Node 实现，各平台均可直接使用。
- `build_apk.sh`：bash 实现，适合 macOS / Linux / Git Bash。

依赖已安装的 Node/npm、JDK（包含 keytool）、Android SDK/NDK 和项目 node_modules。
脚本先检查签名；若已有 `android/`，会先停掉 Gradle/Kotlin daemon、再删除 `android/`，然后 clean prebuild（避免 Windows 上 dex 被占用导致 EBUSY），再构建 release APK，启用 R8 和资源裁剪。
若仍删不掉，请关掉 Android Studio，或暂停 Cursor 的 Java/Gradle 扩展对本仓库的索引后再试。
`build:apk:all` 时 **prebuild 只做一次**，再串行执行两次 gradle + 归档（先 arm64，再 universal），耗时约接近两次 gradle。
`build_apk.cjs` 会将 Gradle 堆内存写入 `android/gradle.properties`（`-Xmx4096m`）；`build_apk.sh` 通过命令行 `-Dorg.gradle.jvmargs=...` 传入同等参数。
签名配置通过 Expo config plugin 注入，clean prebuild 后依然生效；release 不会回退使用 debug 签名。
Kotlin 使用进程内非增量编译，避免本机缓存损坏后备用编译流程对中文项目路径的解析问题。

输出到 `apks/应用名称-版本号-架构标签-年月日时分.apk`（本地时间，精确到分钟），例如：

```text
apks/盼之电竞-1.0.0-arm64-202610201430.apk
apks/盼之电竞-1.0.0-universal-202610201430.apk
```

名称来自根目录 `app.json`，版本使用 APK 输出元数据并校验与 `app.json` 一致。
归档时会校验复制前后 APK 的 MD5；控制台会打印路径、MD5 与体积。同一分钟、同一架构标签会覆盖同名文件；不同架构标签可并存。
R8 的 `mapping.txt` 也以相同文件名前缀保存在 `apks/`，便于还原混淆后的崩溃堆栈。
命名由共用的 `archive-apk.cjs`（读取 `APK_ABI_LABEL`）完成。

## 签名

首次初始化自动生成随机密码的 PKCS12 RSA 私钥，之后每次构建复用，不会重新生成。
也可以只初始化或校验签名：

```bash
npm run build:apk:init-signing
```

```bash
node scripts/build_apk.cjs --init-signing
./scripts/build_apk.sh --init-signing
```

**请安全备份整个 `.android-signing/` 目录**：

- `release.keystore`：发布私钥。
- `credentials.json`：别名及密码；不要提交或分享。
- `release-cert.pem`：公钥证书，可用来查询 SDK 控制台所需的签名指纹。

签名目录位于 android 生成目录之外，不受 clean prebuild 影响，已加入 .gitignore。
若只剩部分签名文件，脚本会报错要求恢复备份，不会自动换签名。
此前安装的 debug 签名包不能被新 release 签名包直接覆盖安装；正式发布后必须持续使用同一私钥。
若第三方 SDK 有包名/签名白名单，需登记 release 证书对应的指纹。

## 架构

| 模式 | ABI | 命令 |
|------|-----|------|
| arm64 | `arm64-v8a` | `npm run build:apk` |
| universal | `armeabi-v7a,arm64-v8a` | `npm run build:apk:universal` |
| all | 上两者各打一包 | `npm run build:apk:all` |

未传 `--abi` 时仍兼容环境变量 `REACT_NATIVE_ARCHITECTURES`；都不设则默认 arm64。

## 包体积

手机 64 位包使用 `arm64-v8a`，不是 `x86_64`。本地默认打包命令和 Drone CI 默认都只生成 ARM64 包；CI 未设置 `DRONE_ABI` 时使用 `arm64`。

Expo config plugin 会设置 `expo.useLegacyPackaging=true`，将原生 `.so` 库压缩进 APK，clean prebuild 后也会保留。安装时 Android 会解压这些库，因此下载包会更小，但安装后的占用不一定减少。JS bundle 保持默认不压缩，以保留 Hermes 的启动性能。

正式环境已启用 R8 混淆和资源裁剪；`build_apk.cjs --env test` 为加快构建关闭了这两项，因此测试包可能更大。比较包体积时应使用相同环境、架构和版本。实际缩减量需要重新构建后比较 `archive-apk.cjs` 打印的 `Size`。

universal / all 中的双架构包体积更大。当前 R8 规则只忽略融云可选、未安装的厂商推送 SDK 缺失类；
这些规则不会提供离线推送能力，启用对应通道时仍需添加 SDK 和配置。
