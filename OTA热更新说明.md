# OTA 热更新说明（Pushy + `pzdj_app_rn_update_config`）

本文说明盼之电竞 App（`esports_app`）如何通过 **配置中心门禁** + **Pushy（react-native-update）** 做 Android RN 热更新。

> 当前仅 Android 启用 Pushy；iOS 不挂载热更宿主。

---

## 1. 整体流程

```
用户同意隐私
    → 挂载 PushyUpdateHost
    → disableNativeCheck = false（恢复原生冷启动救援）
    → GET /client/v1/commonConfig/public/get?key=pzdj_app_rn_update_config
    → 解析 JSON，比较 version 与本地 RN_BUNDLE_VERSION
    → 仅当 远端 version > 本地版号 时：
         可选覆盖 updateStrategy → 手动 checkUpdate()
    → 否则 / 接口失败：不请求 Pushy（fail-closed）
```

要点：

- App **不会**自动按 Pushy 的 `checkStrategy` 巡检；本地固定 `checkStrategy: null`，只在门禁通过后手动 `checkUpdate`。
- 是否有「新业务版本」由 **我们自己的版号** 决定，而不是 Pushy 的 hash / name。

相关代码：

| 文件 | 作用 |
|------|------|
| `src/features/ota/rn-bundle-version.ts` | 本地业务版号常量 |
| `src/features/ota/pushy-client.ts` | Pushy 客户端（仅 Android） |
| `src/features/ota/PushyUpdateHost.tsx` | 隐私后挂载；拉配置 + 门禁 + checkUpdate |
| `src/features/ota/ota-config.api.ts` | 配置中心 key / 请求 |
| `src/features/ota/ota-update-gate.ts` | JSON 解析与版号比对 |
| `update.json` | Pushy `android.appKey` |

---

## 2. 配置中心：`pzdj_app_rn_update_config`

### 2.1 在哪里维护

- 管理后台：**系统管理 → 配置中心**
- 表：`dj_common_config`
- 配置键（`config_key`）：**`pzdj_app_rn_update_config`**（固定，与代码 `OTA_CONFIG_KEY` 一致）
- C 端公开查询（免登录）：

```http
GET /client/v1/commonConfig/public/get?key=pzdj_app_rn_update_config
```

- 后台将该行 **启用** 关掉后，接口按「无配置」返回 `null`，App 不会触发热更检查。

### 2.2 配置值 JSON Schema

`config_value` 为 **JSON 文本**，推荐形态：

```json
{
  "version": 1,
  "updateStrategy": "silentAndLater"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `version` | 是 | 非负整数。远端目标业务版号；仅当 **大于** App 内 `RN_BUNDLE_VERSION` 时才会 `checkUpdate` |
| `updateStrategy` | 否 | 覆盖 Pushy 弹窗/静默策略；省略则沿用客户端默认 `silentAndLater` |

**不要**再写 `checkStrategy`。即使旧配置里还有该字段，客户端会忽略，不影响解析。

#### `updateStrategy` 可选值

与 `react-native-update` 一致：

| 值 | 含义（简述） |
|----|----------------|
| `alwaysAlert` | 有更新始终弹窗 |
| `alertUpdateAndIgnoreError` | 有更新弹窗；检查失败不打扰 |
| `silentAndNow` | 静默下载并立即切换 |
| `silentAndLater` | 静默下载，稍后切换（**默认**） |
| `null` | 按 SDK 对 null 的处理（一般需业务自行处理 UI；本项目少用） |

### 2.3 首次上线

在配置中心新增一条（若尚未创建）：

- 配置键：`pzdj_app_rn_update_config`
- 配置值示例：`{"version":1,"updateStrategy":"silentAndLater"}`
- 启用：开

此时若 App 内 `RN_BUNDLE_VERSION === 1`，则 **不会**触发检查（需 `version > 本地`）。要推第一包热更时，本地先改为 `2` 打出包，再把远端 `version` 改为 `2`。

---

## 3. 本地业务版号：`RN_BUNDLE_VERSION`

文件：`src/features/ota/rn-bundle-version.ts`

```ts
/** 每次发布热更包前手动 +1，与配置中心 version 比对 */
export const RN_BUNDLE_VERSION = 1;
```

规则：

- 与远端 `version` **同一套递增整数**，从 1 起即可。
- **不要**用 `expo.version`（原生壳版本）或 Pushy `currentHash` 做门禁。
- 每个要下发的热更包，打包前必须先把该常量 +1，并打进该次 JS bundle。

门禁公式：

```text
trigger = (配置合法) && (远端 version > RN_BUNDLE_VERSION)
```

---

## 4. Pushy 发版步骤（推荐 checklist）

假设当前线上用户本地多为 `RN_BUNDLE_VERSION = 1`，远端配置也是 `version: 1`。要推一版热更到「业务版号 2」：

### 4.1 改代码版号

1. 将 `RN_BUNDLE_VERSION` 改为 `2`
2. 提交代码（保证本次 ppk / 产物里带的是新版号）

### 4.2 打热更包并发布到 Pushy

1. 使用项目既有的 **release** 构建流程产出可热更的 JS 资源（ppk）。
2. 使用全局 CLI（不要用 `npx` 替代）：

```bash
# 示例：按团队习惯调整路径与参数
pushy uploadApk <你的release.apk>   # 若本次还涉及原生基线变更，需先上传基线
pushy bundle --platform android     # 或团队惯用的打包命令
pushy publish <path-to.ppk> --platform android
```

具体命令以当前环境安装的 `react-native-update-cli` / `pushy` 帮助为准；**中国区用 Pushy，不要混用 Cresc**。

3. `update.json` 中的 `android.appKey` 须与 Pushy 控制台该应用一致。

> 仅改 JS/图片等 OTA 可交付内容才能热更。改了原生模块、Gradle、权限、原生依赖等，必须发新安装包并上传新基线，热更包无法带上原生能力。

### 4.3 打开配置门禁

Pushy 上包已发布后，在管理后台把配置改为：

```json
{
  "version": 2,
  "updateStrategy": "silentAndLater"
}
```

并确认该配置行 **已启用**。

之后：仍停留在本地版号 `1` 的用户下次同意隐私后的启动会拉到 `version: 2`，门禁通过 → `checkUpdate` → 静默下载并稍后切换；已是 `2` 的包不会再检查。

### 4.4 顺序注意

建议顺序：**先改常量并发布 Pushy 包 → 再提高远端 `version`**。

若先把远端 `version` 调高而 Pushy 上还没有对应包，用户会触发 `checkUpdate`，但可能无可用更新或体验异常（取决于 Pushy 侧状态）。默认 `silentAndLater` 不会弹窗打扰；若需强制弹窗可临时改远端为 `alertUpdateAndIgnoreError`。

---

## 5. 客户端 Pushy 默认行为

`pushy-client.ts` 初始化（同意隐私前）：

| 选项 | 值 | 原因 |
|------|-----|------|
| `checkStrategy` | `null` | 禁止 SDK 自动检查；由门禁后手动 `checkUpdate` |
| `updateStrategy` | `silentAndLater` | 默认静默下载，稍后切换；远端可覆盖 |
| `disableNativeCheck` | `true` | 同意隐私前禁止原生冷启动联网 |

同意隐私并挂载 `PushyUpdateHost` 后：

1. `disableNativeCheck: false`（恢复冷启动救援能力）
2. 拉配置；门禁通过时可覆盖 `updateStrategy`
3. `checkUpdate()` 一次

---

## 6. 紧急停更 / 回退运营手段

| 目的 | 做法 |
|------|------|
| 立刻停止触发检查 | 配置中心将该条 **停用**，或把 `version` 降到 ≤ 当前已放出包的 `RN_BUNDLE_VERSION` |
| 改弹窗策略 | 只改 JSON 里的 `updateStrategy`，无需发新包 |
| 撤回 Pushy 上的错误包 | 在 Pushy 控制台按官方流程下线/回滚对应热更；同时建议把远端 `version` 调回，避免继续 `checkUpdate` |

注意：已经下载并切换成功的用户，不会因为你降低远端 `version` 而自动退回旧 JS；回退需 Pushy 侧能力或发更高版号的修复包。

---

## 7. 联调与自测建议

1. 配置中心写入合法 JSON，启用。
2. 本地 `RN_BUNDLE_VERSION = N`，远端 `version = N + 1`，同意隐私后应发起热更检查（可用抓包看是否请求 Pushy / 是否出现更新弹窗）。
3. 远端 `version = N` 或停用配置：不应请求热更检查（日志可见 `ota.gate_blocked` / `ota.config_fetch_failed`）。
4. 非法 JSON（缺 `version`、非整数等）：按无配置处理，不检查。
5. **Debug 包** 通常无法真正切换热更包；完整验证请用 **Release** 安装包。

---

## 8. 常见问题

**Q: 为什么不直接用 Pushy 的版本名 / hash 做门禁？**  
A: hash 不利于运营比对；业务版号写死在包内，与后台 `version` 对齐即可，发版约定简单。

**Q: 为什么配置里没有 `checkStrategy`？**  
A: 自动检查会绕过「先比业务版号再连 Pushy」的门禁；因此本地固定关闭自动检查，只手动 `checkUpdate`。

**Q: 原生发版要不要动 `RN_BUNDLE_VERSION`？**  
A: 若本次只是商店整包、没有新的热更 JS，可不动。新热更内容才 +1。整包里带的常量应等于「该壳内置 JS」的业务版号，并与当时配置策略一致，避免一安装就被门禁误推。

**Q: 配置改了多久生效？**  
A: 服务端对配置值有 Redis 缓存；后台保存后会按 `config_key` 失效缓存。客户端仅在 Host 挂载时拉一次，需重新进入（同意隐私后的那次启动逻辑）才会读到新值。


