## 1. 使用的系统/方案

本仓库是一个 React Native / Expo 应用，同时包含 Ruby（CocoaPods）与 Node.js 两套依赖体系：

- **Node.js**：使用 `package.json` + `package-lock.json`（npm v5+ lockfile v2），并通过 `pnpm-workspace.yaml` 声明 workspace。根工程通过 `workspaces: ["packages/*"]` 将 `packages/auth`、`packages/sso-sdk` 纳入本地包管理。
- **Ruby/CocoaPods**：使用 `Gemfile` + `Gemfile.lock` 锁定 CocoaPods 版本（`cocoapods 1.16.2`），用于 iOS 原生依赖解析。
- **Expo/React Native 原生模块**：通过 `react-native.config.js` 和 `app.json` 的 `autolinking.exclude` 手动排除部分模块的自动链接（Android 排除 `expo-store-review`，iOS 排除 `react-native-update`），其余走 Expo autolink。
- **私有内部包**：`@esports/sso-sdk` 与 `@esports/auth` 以本地 workspace 形式存在，不发布到公共 registry；根工程的 `dependencies` 中直接引用其包名而非文件路径，由 pnpm workspace 解析。

未发现 `.npmrc`、`.yarnrc`、`pnpm-workspace.yaml` 以外的私有 registry 配置，也未发现 vendored node_modules 或 `vendor/` 目录。因此所有第三方包均从公共源下载，仅本地 workspace 包是“内联”依赖。

## 2. 关键文件

| 文件 | 作用 |
|---|---|
| `package.json` | 根工程依赖声明、scripts、Expo autolink 排除项、workspace 定义 |
| `package-lock.json` | npm lockfile v2，锁定全部已安装依赖树及子依赖版本 |
| `pnpm-workspace.yaml` | 声明 `packages/*` 为 workspace 子包 |
| `packages/auth/package.json` | 上层认证包，声明对 `@esports/sso-sdk` 的依赖及 peerDependencies |
| `packages/sso-sdk/package.json` | 底层 SSO SDK，仅依赖 `axios`，无业务依赖 |
| `Gemfile` | 锁定 CocoaPods `1.16.2`，注释说明需与现有 iOS 项目版本一致 |
| `Gemfile.lock` | 完整锁定 CocoaPods 及其依赖树的 sha256 校验值 |
| `react-native.config.js` | RN autolink 配置（结合 app.json 的 exclude） |
| `app.json` | Expo 配置，含 `autolinking.android.exclude` / `ios.exclude` |
| `scripts/patch-reanimated.cjs` | `postinstall` 钩子中执行的 reanimated 补丁脚本 |
| `scripts/with-env.cjs` | 启动/构建脚本包装器，注入环境变量后执行 expo 命令 |

## 3. 架构与约定

### 3.1 分层依赖模型

```text
根工程 (esportsappapp)
├── 业务代码 src/features/**
├── 共享 UI/能力 src/shared/**
├── 原生模块 modules/** (Alipay、PzOneClick、VoiceRoomBackground、AppToolkit)
└── 共享包 packages/**
    ├── @esports/sso-sdk  → 纯 JS SDK，依赖 axios
    └── @esports/auth     → RN 登录/SSO 适配层，peer 依赖 react-native、zustand 等
```

- 共享包均为 `private: true`，只供本仓库内部 workspace 引用，不对外发布。
- `@esports/auth` 通过 `peerDependencies` 声明宿主应提供的运行时依赖（react、react-native、zustand 等），避免在包内重复打包。
- `@esports/sso-sdk` 作为最底层 SDK，仅依赖 `axios`，保持最小化。

### 3.2 版本范围策略

观察 `package.json` 中的版本号模式：

- Expo 生态包统一使用 `~57.x.x`（tilde，允许 patch 升级），如 `expo-router ~57.0.22`、`expo-image ~57.0.5`。
- React 固定精确版本：`react 19.2.3`、`react-dom 19.2.3`、`react-native 0.86.3`。
- 其他三方库多用 `^`（caret）或精确版本混用，例如 `axios ^1.20.0`、`zod ^4.6.5`、`zustand ^5.0.15`。
- workspace 内包在根工程中用 `*` 引用（如 `@esports/sso-sdk: "*"`），表示始终取 workspace 解析到的本地版本。

### 3.3 Autolink 白名单/黑名单

根 `package.json` 中显式排除：

- Android：`expo-store-review` 不走 autolink
- iOS：`react-native-update` 不走 autolink

对应地，`react-native-update` 通过 `modules/pz-one-click/ios/Vendor/...` 下以 Vendor 方式引入原生代码（见 `modules/pz-one-click/ios/PzOneClick.podspec` 与 `Vendor` 目录），属于手工集成而非 autolink。

### 3.4 构建期脚本

- `postinstall`：运行 `scripts/patch-reanimated.cjs`，在安装阶段打补丁。
- `start` / `android` / `ios` / `build:apk*` 等脚本均通过 `node scripts/with-env.cjs <env> ...` 包裹，以便按环境切换配置。

## 4. 约定与约束

- **workspace 包必须放在 `packages/*` 目录下**：由 `pnpm-workspace.yaml` 与 `package.json.workspaces` 共同约束，新增共享包需遵循此布局。
- **共享包不得发布**：`packages/auth/package.json` 与 `packages/sso-sdk/package.json` 均设置 `"private": true`，禁止被发布到 npm。
- **CocoaPods 版本必须与 iOS 项目一致**：`Gemfile` 注释明确说明 `Match the CocoaPods version used by the existing iOS project`，且 CI 的 ruby/setup-ruby 会缓存该锁定 gem。
- **Lockfile 需提交**：`package-lock.json` 与 `Gemfile.lock` 均在仓库中，确保 CI 复现相同依赖树。
- **需要手动维护 autolink 排除项**：新增原生模块时若不希望被 Expo autolink 处理，需在 `app.json` 的 `autolinking.*.exclude` 中显式加入。
- **未启用私有 npm registry**：未发现 `.npmrc` 或 `package.json` 中的 `publishConfig.registry`，所有非 workspace 包均从公共 npm 源拉取。
- **未发现 pnpm 专用配置文件**：没有 `.npmrc`、`.pnpmrc`、`pnpm-lock.yaml`，实际锁文件由 npm 生成（`package-lock.json`），但 workspace 元数据来自 `pnpm-workspace.yaml`——这暗示实际包管理器可能是 pnpm（读取 workspace 配置），而锁文件仍为 npm 格式。