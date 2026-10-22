# 盼之电竞

基于 Expo 与 React Native 构建的移动端应用。

## 开发

```bash
npm install
npm start
```

路由页面位于 `src/app/`，业务代码位于 `src/` 的其他目录。

```
npm run ios
npm run android
```

## 环境配置

测试环境与正式环境通过 env 文件区分（由 `@expo/env` 按加载优先级自动选择，见 `.env.example` 顶部说明）：

| 文件               | 环境 | 内容                          |
| ------------------ | ---- | ----------------------------- |
| `.env.development` | 测试 | 测试后端域名、测试 SDK key    |
| `.env.production`  | 正式 | 正式后端域名、正式 SDK key    |
| `.env.example`     | 模板 | 脱敏模板，新建 env 文件时复制 |

加载规则（高优先级在前）：`.env.{NODE_ENV}.local` > `.env.{NODE_ENV}` > `.env.local` > `.env`；shell 中已设置的变量优先于所有文件。

运行脚本通过 `scripts/with-env.cjs` 把指定环境的 `EXPO_PUBLIC_*` 注入进程环境后再启动，明确锁定环境：

- `npm start` / `npm run start:test` — Metro 开发调试，测试环境（默认）
- `npm run start:prod` — Metro 开发调试，正式环境
- `npm run android` / `npm run android:prod`、`npm run ios` / `npm run ios:prod` — 真机调试，同理

临时用单个变量覆盖：`EXPO_PUBLIC_API_BASE_URL=https://djapi.jlgkj.top npm start`（shell 变量优先于 env 文件）。

`EXPO_PUBLIC_*` 变量在打包时内联进 JS bundle，**切换环境必须重新打包/重启 Metro，无法运行时切换**。

## 打包

```bash
npm run build:apk        # 正式包（ARM64）
npm run build:apk:test   # 测试包（ARM64）
npm run build:apk:all    # 正式包（ARM64 + 双架构）
```

打包脚本 `scripts/build_apk.cjs` 通过 `--env prod|test` 选择 env 文件（默认 `prod`，即 `.env.production`；`test` 读取 `.env.development`），构建前会打印所选环境的各变量值以便确认。产物文件名带环境标识，例如 `盼之电竞-1.0.0-arm64-prod-202610221430.apk`。详见 `scripts/BUILD_APK.md`。

EAS 云构建默认 `NODE_ENV=production`，走 `.env.production`；如需 EAS 打测试包，在 `eas.json` 对应 profile 中加 `env` 字段覆盖。

### 脚本说明

命名规则：`<动作>` 或 `<动作>:<环境>`，环境后缀 `:test` 为测试环境、`:prod` 为正式环境；不带后缀的动作类脚本默认测试环境（打包类默认正式环境）。

| 脚本                                       | 环境 | 说明                                         |
| ------------------------------------------ | ---- | -------------------------------------------- |
| `npm start`                                | 测试 | Metro 开发调试（等同 `start:test`）          |
| `npm run start:test`                       | 测试 | 同上                                         |
| `npm run start:prod`                       | 正式 | Metro 开发调试，连正式后端                   |
| `npm run ios` / `npm run ios:test`         | 测试 | 真机调试 iOS（`--device`）                   |
| `npm run ios:prod`                         | 正式 | 真机调试 iOS，连正式后端                     |
| `npm run android` / `npm run android:test` | 测试 | 真机调试 Android（`--device`）               |
| `npm run android:prod`                     | 正式 | 真机调试 Android，连正式后端                 |
| `npm run build:apk`                        | 正式 | 打正式 APK（ARM64）                          |
| `npm run build:apk:test`                   | 测试 | 打测试 APK（ARM64）                          |
| `npm run build:apk:universal`              | 正式 | 打正式 APK（双架构 universal）               |
| `npm run build:apk:test:universal`         | 测试 | 打测试 APK（双架构 universal）               |
| `npm run build:apk:arm64`                  | 正式 | 等同 `build:apk`（显式写法）                 |
| `npm run build:apk:all`                    | 正式 | ARM64 + universal 一起打                     |
| `npm run build:apk:prod`                   | 正式 | 等同 `build:apk`（显式写法）                 |
| `npm run start:prod-only`                  | 正式 | Metro 开发调试，连正式后端且仅监听 localhost |
| `npm run web`                              | —    | Web 模式启动（未适配，不常用）               |
| `npm run build:apk:init-signing`           | —    | 初始化 Android 签名后退出                    |
| `npm run lint`                             | —    | ESLint 检查                                  |
| `npm run prebuild`                         | —    | 生成原生目录（`expo prebuild`）              |

运行与打包脚本的底层实现：

- `scripts/with-env.cjs <test|prod> <command...>` — 从对应 env 文件读 `EXPO_PUBLIC_*` 注入进程环境后启动命令，`start` / `ios` / `android` 系列均经由此脚本
- `scripts/build_apk.cjs --env prod|test [--abi arm64|universal|all]` — APK 打包，`--env` 选择 env 文件，默认 `prod`
- `scripts/archive-apk.cjs` — 归档 APK 到 `apks/`，文件名含架构与环境标识

## Drone CI 构建

仓库根目录的 `.drone.yml` 定义了 Android APK 的 CI 构建（pipeline: `android-deployment`），push 到匹配分支或手动（custom 事件）触发。

### 分支规则

按分支名自动选择构建环境：

| 分支名                         | 环境 | 说明                          |
| ------------------------------ | ---- | ----------------------------- |
| `main`、`prod`                 | 正式 | `.env.production`             |
| 包含 `main` 或 `prod` 的分支   | 正式 | 如 `prod-fix`、`feature-main` |
| `test`、`dev`                  | 测试 | `.env.development`            |
| 包含 `test` 或 `dev` 的分支    | 测试 | 如 `dev-jwt`、`test-pay`      |
| 其它分支（不匹配以上任意规则） | 测试 | 默认兜底为测试包              |

**触发分支白名单**（trigger）：`main`、`prod`、`*main*`、`*prod*`、`*test*`、`*dev*`。不匹配白名单的分支 push 不会触发构建；需要为其它分支构建时，把分支名改到包含以上任一关键字，或扩展 `.drone.yml` 的 `trigger.branch`。

### 构建流程

1. **build-android** — `npm ci` → `node scripts/build_apk.cjs --env <prod|test> --abi arm64`（自动完成 clean prebuild、`assembleRelease`、归档到 `apks/`）
2. **move-to-dev-server** — scp 把 `apks/*.apk` 上传到 `dev.jinliwangluo.com`，目标路径 `…/android/esportsapp/<分支>/<app版本>/`

镜像 `panzhi/android-build-box`（JDK17 + Android SDK）来自自建 nexus；Gradle 与 npm 走宿主机卷缓存（`/var/lib/drone/cache/android-*`）；NDK（RN 0.86 要求 `27.1.12297006`）首次构建时由 `sdkmanager` 自动安装。

### 手动触发参数（custom 事件）

| 变量        | 取值                          | 说明                         |
| ----------- | ----------------------------- | ---------------------------- |
| `DRONE_ENV` | `prod` / `test`               | 强制构建环境，跳过分支名判断 |
| `DRONE_ABI` | `arm64` / `universal` / `all` | 构建架构，默认 `arm64`       |

### 依赖的 Drone secrets

| Secret         | 用途                              |
| -------------- | --------------------------------- |
| `dockerconfig` | 拉取自建 nexus 私有镜像           |
| `ssh_rsa`      | 上传 APK 到 dev 服务器的 SSH 私钥 |
