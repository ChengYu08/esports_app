## 总体方案

该项目是一个基于 Expo Router + Next.js App Router 的 React Native 工程，构建体系围绕 **Expo (SDK 57) + EAS Build** 组织，辅以自研 Node 脚本完成 Android APK 发布、环境变量注入、签名以及 Gradle 环境调优；iOS 侧通过 GitHub Actions `ios-build.yml` 在 `macos-latest` Runner 上执行 Xcode Archive 并导出 IPA。

## 关键文件与职责

- `package.json`：声明依赖、workspace（`packages/*`）与所有 npm scripts。开发/运行入口统一经 `scripts/with-env.cjs` 包装（`start`、`android`、`ios`、`web` 等），发布入口为 `build:apk*`。
- `eas.json`：EAS CLI ≥24.7.0，定义 development / preview / production 三种 build profile；production 开启 `autoIncrement`。
- `app.config.js` + `app.json`：Expo 工程配置与元信息（Bundle ID `com.esportsapp.apps` 见 workflow）。`eas.json` 中 `cli.appVersionSource=remote` 表示版本号从远程读取。
- `Gemfile` / `Gemfile.lock`：固定 CocoaPods 1.16.2，供本地预检与 CI Ruby 缓存使用。
- `scripts/with-env.cjs`：运行时环境变量注入器，加载 `.env.development` / `.env.production` 中的 `EXPO_PUBLIC_*` 变量并以最高优先级注入子进程，同时处理 `NODE_ENV` 与 `__EXPO_ENV_LOADED` 哨兵，避免与 `@expo/env` 冲突。
- `scripts/build_apk.cjs`：Android release APK 主构建脚本，支持 `--init-signing`、`--abi arm64|universal|all`、`--env prod|test`。
- `scripts/android-signing.cjs`、`scripts/archive-apk.cjs`：签名与产物归档辅助脚本。
- `ci/github-actions/ios-build/`：由 `ipa-cli actions init-ios-build` 生成的 iOS CI 模板，含 workflow、README、secrets 模板、签名目录及 `preflight-ios-build.sh`。
- `.github/workflows/ios-build.yml`：GitHub Actions iOS IPA 构建工作流。
- `plugins/`：Expo Prebuild 插件集（`withAndroidReleaseBuild.js`、`withRongCloudPush.js` 等），在 `expo prebuild` 阶段注入原生资源与 Gradle 变更。
- `.drone.yml`：Drone CI 配置文件（仓库根存在，但本分析以 GitHub Actions 为主证据）。

## 构建流程与约定

### 开发/调试

- 通过 `pnpm workspaces`（`pnpm-workspace.yaml` + `package.json.workspaces=["packages/*"]`）管理 monorepo。
- 启动命令统一走 `node scripts/with-env.cjs <test|prod> expo start`，区分 test/prod 两套 `.env` 文件。
- `postinstall` 自动执行 `scripts/patch-reanimated.cjs`。

### Android APK 发布

`scripts/build_apk.cjs` 的流程如下：

1. 解析参数 `--init-signing | --abi arm64|universal|all | --env prod|test`。
2. 调用 `scripts/android-signing.cjs` 完成签名准备。
3. 删除 `android/` 目录并执行 `expo prebuild --platform android --clean --no-install`（优先 `bunx`，回退到 `npx`）。
4. 动态写入 `android/gradle.properties`：设置 `org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=2048m`、`org.gradle.daemon=false`。
5. 根据 `GRADLE_DIST_MIRROR` 重写 `android/gradle/wrapper/gradle-wrapper.properties` 的 `distributionUrl`（默认腾讯云镜像 `https://mirrors.cloud.tencent.com/gradle`，传 `none` 恢复官方源）。
6. 按 ABI 目标循环执行 `./gradlew :app:assembleRelease`，测试包关闭 R8 混淆与资源收缩，生产包启用；随后调用 `scripts/archive-apk.cjs` 归档。

ABI 预设：`arm64 → arm64-v8a`，`universal → armeabi-v7a,arm64-v8a`，`all → 两者都构建`。也可通过 `REACT_NATIVE_ARCHITECTURES` 环境变量传入自定义架构。

环境变量映射：`prod → .env.production + NODE_ENV=production`，`test → .env.development + NODE_ENV=development`。

### iOS IPA 发布（CI）

`.github/workflows/ios-build.yml` 是 `ipa-cli actions init-ios-build` 生成的通用模板，对 RN 项目的主要行为：

- 在 `macos-latest` 上运行，超时 60 分钟。
- 自动检测包管理器（`pnpm-lock.yaml` → pnpm，`yarn.lock` → yarn，否则 npm），并据此选择安装命令（`pnpm install --frozen-lockfile` / `yarn install --frozen-lockfile` / `npm ci --prefer-offline --no-audit --no-fund`）。
- 通过 `setup-node@v4` 安装 Node（默认 LTS），可缓存 npm 依赖。
- 可选启用 ccache（`USE_CCACHE`）、Metro 缓存、禁用 Swift Package Manager（默认 true）。
- 非 Flutter 分支执行 `xcodebuild archive` + `xcodebuild -exportArchive`，输出 IPA。
- 版本来源：若存在 `pubspec.yaml` 则读 Flutter 版本；RN 项目从 `app.json` 读取 `app_version`，构建号默认 Expo 的 `1`；可通过 workflow inputs 覆盖 `app_version` / `app_build_number`。
- 预检脚本 `ci/github-actions/ios-build/signing/scripts/preflight-ios-build.sh` 会清理主 App Target 的 Release 配置、校验 bundle build phase、检查签名身份与 provisioning profile。

### 环境变量策略

- 运行时：`scripts/with-env.cjs` 负责加载 `.env.development` / `.env.production` 中的 `EXPO_PUBLIC_*` 变量，将其作为最高优先级注入子进程，并清除 shell 中可能残留的同名变量；同时设置 `NODE_ENV` 与 `__EXPO_ENV_LOADED='[]'` 哨兵，阻止 `@expo/env` 二次加载 `.env.development`。
- 构建时：`build_apk.cjs` 单独读取对应 env 文件，仅暴露给 Gradle 子进程，不污染父进程。

### 原生模块与 Prebuild 插件

- 原生模块位于 `modules/`，每个模块自带 `expo-module.config.json`、`android/build.gradle` 和 `ios/*.podspec`，通过 Expo autolinking 集成。
- `plugins/` 下的 `*.js` 是 `@expo/config-plugins` 插件，在 `expo prebuild` 阶段修改 Android/iOS 原生工程（融云推送、全屏启动图、R8 配置、语音房背景等）。

### 依赖与工具链锁定

- JS 依赖：`package-lock.json`（npm 锁文件，workflow 也据此推断包管理器）。
- Ruby/CocoaPods：`Gemfile` + `Gemfile.lock` 固定 `cocoapods@1.16.2`。
- EAS CLI：`eas.json` 要求 `>=24.7.0`。
- Expo SDK：`~57.x`，React `19.2.3`，React Native `0.86.3`。

## 约束与规则（来自实现强制）

- Android 构建必须经 `scripts/build_apk.cjs` 或 `build_apk.sh` 调用，该脚本会在每次构建前删除 `android/` 并重新 `prebuild`，因此手动修改 `android/` 不会被保留。
- Gradle JVM 参数被脚本强制改写为 `-Xmx4096m -XX:MaxMetaspaceSize=2048m`；CI 容器内强制 `org.gradle.daemon=false`。
- `REACT_NATIVE_ARCHITECTURES` 仅接受 `arm64-v8a` 或 `armeabi-v7a,arm64-v8a` 两个预设值，其他值触发 usage 错误退出。
- `--env` 仅允许 `prod` 或 `test`，对应 `.env.production` / `.env.development`，其他值直接退出。
- `with-env.cjs` 只注入 `EXPO_PUBLIC_` 前缀的变量，其余 `.env` 行被忽略。
- iOS CI 默认禁用 Swift Package Manager（`disable_swift_package_manager=true`），强制走 CocoaPods；如需 SPM 需显式传入 `false`。
- iOS 预检脚本要求 Bundle ID 与 provisioning profile 一致，且当前模板不支持多 App Target（多个 App Target 会明确失败）。
- `eas.json` 的 production 构建启用 `autoIncrement`，版本号由 EAS remote 提供（`cli.appVersionSource=remote`）。