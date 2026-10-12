# Android release APK

在项目根目录运行（脚本也支持从其他目录调用）：

```bash
./scripts/build_apk.sh
```

依赖已安装的 Node/npm、JDK（包含 keytool）、Android SDK/NDK 和项目 node_modules。
脚本先检查签名，运行 Android clean prebuild，然后构建 ARM64 release APK，启用 R8 和资源裁剪。
签名配置通过 Expo config plugin 注入，clean prebuild 后依然生效；release 不会回退使用 debug 签名。
Kotlin 使用进程内非增量编译，避免本机缓存损坏后备用编译流程对中文项目路径的解析问题。

输出到 `apks/应用名称-版本号-32位小写MD5.apk`，例如：

```text
apks/盼之电竞-1.0.0-<MD5>.apk
```

名称来自根目录 app.json，版本使用 APK 输出元数据并校验与 app.json 一致。
MD5 根据最终签名 APK 的完整内容计算，复制后再次校验。同名同内容覆盖，不同 MD5 保留历史包。
R8 的 mapping.txt 也以相同文件名前缀保存在 apks，便于还原混淆后的崩溃堆栈。

## 签名

首次初始化自动生成随机密码的 PKCS12 RSA 私钥，之后每次构建复用，不会重新生成。
也可以只初始化或校验签名：

```bash
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

默认仅支持 ARM64 真机。需要同时兼容 32 位 ARM 时：

```bash
REACT_NATIVE_ARCHITECTURES=armeabi-v7a,arm64-v8a ./scripts/build_apk.sh
```

包含两种架构会增大 APK。当前 R8 规则只忽略融云可选、未安装的厂商推送 SDK 缺失类；
这些规则不会提供离线推送能力，启用对应通道时仍需添加 SDK 和配置。
