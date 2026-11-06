# Drone 分支与环境打包说明

本文说明盼之电竞 App（`esports_app`）在 Drone 上如何按分支打出**测试环境**或**正式环境** APK，以及如何手动覆盖环境。

配置源文件：仓库根目录 [`.drone.yml`](../.drone.yml)。本地打包见 [README.md](../README.md)「打包」一节与 `scripts/BUILD_APK.md`。

---

## 1. 环境与 env 文件

| 构建环境 | env 文件 | 含义 |
| -------- | -------- | ---- |
| `test` | `.env.development` | 测试后端、测试 SDK key |
| `prod` | `.env.production` | 正式后端、正式 SDK key |

`EXPO_PUBLIC_*` 在打包时写入 JS bundle，**切换环境必须重新打包**，无法运行时切换。

产物文件名会带环境标识，例如：`盼之电竞-1.0.0-arm64-prod-202610221430.apk`。

---

## 2. 两条流水线（先看这个）

| 流水线名 | 触发分支 | 默认环境 | 默认 ABI | 上传目录 |
| -------- | -------- | -------- | -------- | -------- |
| `android-deployment` | `test`、`test_debug` | 测试（`test`） | `arm64` | `…/android/esportsapp/<分支名>/<版本>/` |
| `android-prod` | `prod`、名称含 `prod` 的分支 | 正式（`prod`，不可改） | `all`（arm64 + universal） | `…/android/esportsapp/prod/<版本>/` |

触发事件：`push` 或 `custom`（手动触发）。

**功能分支 push 不会触发 CI。** 需要装机验证时：本地 `npm run build:apk:test`，或合入 `test` 后再由 CI 出包。

---

## 3. APK 存放目录

构建成功后，产物上传到 `dev.jinliwangluo.com` 下载站。服务器路径与下载 URL 对应关系如下。

| 流水线 | 服务器目录 | 下载 URL 前缀 |
| ------ | ---------- | ------------- |
| `android-deployment`（`test` / `test_debug`，含手动 `DRONE_ENV=prod`） | `/home/apps/data/baota/wwwroot/dev.jinliwangluo.com/android/esportsapp/<分支名>/<版本>/` | `http://dev.jinliwangluo.com/android/esportsapp/<分支名>/<版本>/` |
| `android-prod`（`prod` 等） | `/home/apps/data/baota/wwwroot/dev.jinliwangluo.com/android/esportsapp/prod/<版本>/` | `http://dev.jinliwangluo.com/android/esportsapp/prod/<版本>/` |

说明：

- `<版本>` 来自 `app.json` 的 `expo.version`
- `<分支名>` 为触发构建时的 `DRONE_BRANCH`（例如 `test`）
- 在 `test` 上用 `DRONE_ENV=prod` 打的正式包，仍落在 `…/esportsapp/test/<版本>/`，以 APK 文件名中的 `prod` 标识区分环境
- CI 容器内临时产物目录为仓库下的 `apks/`，上传完成后以服务器目录为准

示例：

```text
# test 分支测试包
http://dev.jinliwangluo.com/android/esportsapp/test/1.0.0/盼之电竞-1.0.0-arm64-test-202611061130.apk

# prod 分支正式包
http://dev.jinliwangluo.com/android/esportsapp/prod/1.0.0/盼之电竞-1.0.0-arm64-prod-202611061130.apk
```

---

## 4. 常见场景怎么打

### 4.1 打测试包（日常）

1. 把代码合入 / push 到 **`test`**（或 `test_debug`）
2. 自动跑 `android-deployment`，环境 = **测试**
3. 下载地址示例：

```text
http://dev.jinliwangluo.com/android/esportsapp/test/<版本>/<apk文件名>
```

也可在 Drone 上对 `test` 做 **Custom 手动触发**（不设 `DRONE_ENV` 时仍是测试包）。

### 4.2 打正式包（发版）

1. 把代码合入 / push 到 **`prod`**（或分支名包含 `prod`）
2. 自动跑 `android-prod`，环境固定为 **正式**，默认一次出 arm64 + universal 两个包
3. 下载地址示例：

```text
http://dev.jinliwangluo.com/android/esportsapp/prod/<版本>/<apk文件名>
```

### 4.3 基于 `test` 分支临时打正式包

`test` 默认只会出测试包。若要用 **test 分支代码** 打 **正式环境** 包：

1. 打开 Drone → 选择仓库 `esports_app`
2. 选择分支 **`test`**
3. 使用 **Custom / 手动触发**（不要只靠 push）
4. 填写参数：

| 变量 | 取值 | 说明 |
| ---- | ---- | ---- |
| `DRONE_ENV` | `prod` | **必填**。强制使用 `.env.production` |
| `DRONE_ABI` | `arm64` / `universal` / `all` | 可选，默认 `arm64` |

注意：

- 仍走 **`android-deployment`**，不会走 `android-prod`
- 上传路径仍按分支名，在 **`…/esportsapp/test/<版本>/`**，不是 `prod/` 目录
- 以 APK 文件名中的 `prod` 标识区分环境，不要只看目录名

### 4.4 基于 `prod` 分支只打单架构

`android-prod` 默认 `DRONE_ABI=all`。若只要一个包，对 `prod` 做 Custom 触发并设置：

| 变量 | 取值 |
| ---- | ---- |
| `DRONE_ABI` | `arm64` 或 `universal` |

`android-prod` **忽略** `DRONE_ENV`，始终用正式环境。

---

## 5. 手动触发参数一览

| 变量 | 适用流水线 | 取值 | 说明 |
| ---- | ---------- | ---- | ---- |
| `DRONE_ENV` | 仅 `android-deployment` | `prod` / `test` | 覆盖默认环境；不设则按分支规则（`test`/`test_debug` → 测试） |
| `DRONE_ABI` | 两条流水线均可 | `arm64` / `universal` / `all` | `android-deployment` 默认 `arm64`；`android-prod` 默认 `all` |

---

## 6. 分支 → 环境速查

| 你想要的结果 | 推荐操作 |
| ------------ | -------- |
| test 代码 + 测试后端 | push / 合入 `test` |
| test 代码 + 正式后端 | `test` 上 Custom，设 `DRONE_ENV=prod` |
| prod 代码 + 正式后端（双包） | push / 合入 `prod` |
| prod 代码 + 正式后端（单包） | `prod` 上 Custom，设 `DRONE_ABI=arm64` 或 `universal` |
| 功能分支临时验证 | 本地 `npm run build:apk` / `build:apk:test`（CI 不触发） |

---

## 7. 本地对照（不经过 Drone）

| 命令 | 环境 |
| ---- | ---- |
| `npm run build:apk` / `build:apk:prod` | 正式 |
| `npm run build:apk:test` | 测试 |
| `npm run build:apk:all` | 正式（arm64 + universal） |

底层：`node scripts/build_apk.cjs --env prod|test [--abi arm64|universal|all]`。

---

## 8. 依赖的 Secrets

| Secret | 用途 |
| ------ | ---- |
| `dockerconfig` | 拉取 nexus 私有构建镜像 |
| `ssh_rsa` | 上传 APK 到 `dev.jinliwangluo.com` |

---

## 更新记录

- 2026-11-06 初版：整理两条流水线、分支默认环境、以及 test 分支手动打正式包的步骤
- 2026-11-06 补充 APK 存放目录（服务器路径与下载 URL）说明
