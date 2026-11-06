# 版本号升级说明

## 单一源头

版本号只在 **一处** 修改：`app.json` 的 `expo.version`（semver 格式，如 `1.0.0`）。

```bash
# 例：从 1.0.0 升到 1.1.0，只需改 app.json 的 expo.version
```

其余全部自动推导，见下表：

| 字段 | 来源 | 说明 |
|------|------|------|
| Android `versionCode` | `major*10000 + minor*100 + patch` 由 `app.config.js` 的 `deriveVersionCode()` 推导 | 例：`1.2.3` → `10203` |
| Android `versionName` | 同 `expo.version` | 由 prebuild 写入生成的 `build.gradle` |
| iOS `buildNumber` | 同上推导值（字符串） | CI 提供 `APP_BUILD_NUMBER` 时以环境变量为准 |
| 应用展示版本 | 同 `expo.version` | CI 提供 `APP_VERSION` 时以环境变量为准 |

> `package.json` 的 `version` 与打包无关，不用改。
> 不要手改 `android/` 目录下的任何文件——它由 `npx expo prebuild` 重新生成，手改会被覆盖。

## 推导规则与约束

- 公式：`versionCode = major * 10000 + minor * 100 + patch`
- **semver 三段每段必须 < 100**：`1.2.100` 这类号段推不出合法值（会与 `1.3.0` 冲突）；patch 用满 99 后应进位 minor。
- Android `versionCode` 上限为 2^31-1，即 major < 214748，实际不会触及。
- `versionCode` 只增不减：升级后不要把 `expo.version` 改回更小的版本再发整包（Android 会拒绝降级安装）。

## CI 环境变量（可选覆盖）

| 变量 | 作用 | 影响范围 |
|------|------|----------|
| `APP_VERSION` | 覆盖 `expo.version`，推导随之联动 | 双端 version/versionName/buildNumber |
| `APP_BUILD_NUMBER` | 覆盖 iOS buildNumber | 仅 iOS，**不影响** Android versionCode |

## 升级步骤

1. 修改 `app.json` 的 `expo.version`（如 `1.1.0`）。
2. 验证解析结果：

   ```bash
   npx expo config --type prebuild
   ```

   确认输出中 `version`、`android.versionCode`、`ios.buildNumber` 三者对应（例：`1.1.0` → `10100`）。

3. 运行相关测试：

   ```bash
   npx vitest run app.config.test.ts
   ```

4. 正常走打包流程（prebuild 会把推导值写入 `android/app/build.gradle` 与 iOS 工程）。

## 历史背景

- 2026-11 引入本机制前，`android/app/build.gradle` 硬编码 `versionCode 1` / `versionName "1.0.0"`，与 `app.json` 不同步。
- 推导值从 `10000`（1.0.0）起步，高于历史硬编码值 `1`，升级安装安全；前提是历史从未分发过 versionCode ≥ 10000 的包。
