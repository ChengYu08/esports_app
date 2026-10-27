# Pushy 打包说明（esports_app / Android）

本文说明如何为本项目打 **原生基线** 与 **热更包（ppk）** 并发布到 Pushy。  
业务门禁（`RN_BUNDLE_VERSION` / `pzdj_app_rn_update_config`）见 [OTA热更新说明.md](./OTA热更新说明.md)。

> 当前仅 Android；中国区服务用 **Pushy**（`pushy` CLI + `new Pushy(...)`），不要混用 Cresc。

---

## 1. 环境准备（一次性）

```bash
# 全局安装 CLI（不要用 npx 替代日常命令）
npm i -g react-native-update-cli

pushy login
pushy version
```

进入项目根目录，确认应用已绑定：

```bash
cd d:\PZDJ\esports_app

# 查看 / 选择 Android 应用（应与 update.json 一致）
pushy selectApp --platform android
```

项目已提交 [`update.json`](./update.json)，示例字段：

```json
{
  "android": {
    "appId": 34179,
    "appKey": "..."
  }
}
```

`appKey` 必须与 `src/features/ota/pushy-client.ts`、Pushy 控制台为同一应用。

依赖：`react-native-update`（见 `package.json`）。热更验证请用 **Release** 包；Debug 通常无法真正切换 bundle。

---

## 2. 两种产物

| 产物 | 何时需要 | 怎么做 |
|------|----------|--------|
| **原生基线** | 新发安装包；改了原生代码 / 依赖 / 权限 / Gradle 等 | 打 Release APK → `pushy uploadApk` |
| **热更包 ppk** | 只改 JS、样式、图片等 RN 资源 | `pushy bundle --platform android` |

规则：

- 热更 **不能** 带上原生变更。
- 发给用户的 APK 与上传基线的 APK 必须是 **同一份构建产物**（不要中间重签、再编、裁剪后再传）。
- 改过原生或内置 JS 后，应重新上传基线；同版本反复重打但不上传基线容易出现 `unknownBundle`，客户端会退回全量下载兜底。

---

## 3. 打 Release APK（基线原料）

使用项目脚本（详见 [scripts/BUILD_APK.md](./scripts/BUILD_APK.md)）：

```bash
cd d:\PZDJ\esports_app

# 正式环境 ARM64（常用）
npm run build:apk

# 测试环境
npm run build:apk:test
```

产物目录：`apks/`，例如：

```text
apks/盼之电竞-1.0.0-arm64-202610201430.apk
```

首次需签名目录 `.android-signing/`（已 gitignore），可用：

```bash
npm run build:apk:init-signing
```

---

## 4. 上传原生基线

```bash
cd d:\PZDJ\esports_app

# 将「即将分发」的那份 APK 原样上传
pushy uploadApk apks\盼之电竞-1.0.0-arm64-xxxxxxxx.apk
```

若使用 AAB：

```bash
pushy uploadAab <file.aab>
```

同一业务版本若同时有 APK / AAB，应在同一次 Gradle 构建中产出并分别上传。

上传成功后，该壳上的内置 JS 会在 Pushy 登记为基线，后续热更包需绑定到对应基线。

---

## 5. 打热更包并发布

### 5.1 发版前改业务版号

编辑 `src/features/ota/rn-bundle-version.ts`：

```ts
export const RN_BUNDLE_VERSION = 2; // 每次热更 +1
```

保证本次打进 ppk 的常量已更新。

### 5.2 打包发布

在项目根执行：

```bash
cd d:\PZDJ\esports_app
pushy bundle --platform android
```

说明：

- 命令会按当前工程打 JS bundle 并生成 / 发布 `.ppk`（交互提示以本机 CLI 为准）。
- 若 CLI 拆成「先出 ppk 再发布」，按提示使用：

```bash
pushy publish <path-to.ppk> --platform android
```

非交互（CI）可参考：

```bash
# 具体开关以 pushy --help / 当前 CLI 版本文档为准
set NO_INTERACTIVE=true
pushy bundle --platform android
```

### 5.3 绑定基线

在 Pushy 控制台将本次热更绑定到目标原生基线（对应已 `uploadApk` 的壳版本）。  
未绑定则装了该壳的用户拉不到包。

### 5.4 打开业务门禁

Pushy 发布完成后再改配置中心 `pzdj_app_rn_update_config`，例如：

```json
{
  "version": 2,
  "updateStrategy": "silentAndLater"
}
```

**推荐顺序**：改 `RN_BUNDLE_VERSION` → `pushy bundle` → 控制台绑定 → 再提高远端 `version`。

---

## 6. Expo 入口注意

`package.json` 的 `main` 为 `expo-router/entry`。Pushy CLI 打包默认入口是根目录 `index.js`，项目已提供该文件并转发到 Expo Router：

```js
// index.js
import "expo-router/entry";
```

不要删除该文件，否则 `pushy bundle --platform android` 会报 `Unable to resolve module ./index`。

---

## 7. 推荐 checklist

### A. 全新 / 原生有变更

1. [ ] 完成原生与 JS 改动  
2. [ ] `npm run build:apk`（或 test 对应脚本）  
3. [ ] `pushy uploadApk <产物.apk>`  
4. [ ] 分发该 APK 给测试 / 用户  
5. [ ] （若同时有纯 JS 热更）再走小节 B

### B. 仅 JS/资源热更

1. [ ] `RN_BUNDLE_VERSION` +1  
2. [ ] `pushy bundle --platform android`  
3. [ ] Pushy 控制台绑定基线  
4. [ ] 配置中心 `version` 调到与本地常量相同  
5. [ ] 用 **Release** 旧壳验证：同意隐私后能静默下载并稍后生效（默认 `silentAndLater`）

---

## 8. 常见问题

| 现象 | 处理 |
|------|------|
| `pushy` 命令不存在 | `npm i -g react-native-update-cli`，重新开终端 |
| Debug 包不更新 | 换 Release 安装包验证 |
| 检查更新无包 | 确认基线已上传、ppk 已绑定该基线、远端 `version` 大于用户包内 `RN_BUNDLE_VERSION`、配置已启用 |
| `unknownBundle` | 当前安装的内置 JS 未登记；把对应分发 APK 再 `uploadApk` |
| 改了原生却只发了 ppk | 无效；必须重新打 APK 并上传基线 |
| 登录 / 选错应用 | `pushy login`、`pushy selectApp --platform android`，核对 `update.json` |

查看本机命令帮助：

```bash
pushy --help
pushy bundle --help
pushy uploadApk --help
```

---

## 9. 相关文件

| 路径 | 说明 |
|------|------|
| `update.json` | Pushy Android `appId` / `appKey` |
| `src/features/ota/pushy-client.ts` | Pushy 客户端初始化 |
| `src/features/ota/rn-bundle-version.ts` | 本地热更业务版号 |
| `scripts/BUILD_APK.md` | Release APK 构建 |
| `OTA热更新说明.md` | 配置门禁与运营约定 |
