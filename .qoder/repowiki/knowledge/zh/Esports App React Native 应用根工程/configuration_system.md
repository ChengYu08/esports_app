# Expo + Zod 环境配置与运行时配置系统

## 1. 总体方案

本仓库采用 **Expo Config (`app.json` / `app.config.js`) + `EXPO_PUBLIC_*` 环境变量 + Zod 运行时校验** 的三层配置模型：

- **构建期元数据**（应用名、包名、版本号、权限、插件）集中在 `app.json`，由 `app.config.js` 在 prebuild 阶段用 `process.env.APP_VERSION` / `APP_BUILD_NUMBER` 覆盖。
- **运行期业务配置**通过 `EXPO_PUBLIC_*` 注入，由 `src/core/config/env.ts` 从 `expo-constants` 暴露的 `Constants.expoConfig.extra` 中读取，并用 Zod schema 统一校验、默认值与平台分支。
- **协议链接等派生常量**通过 `src/core/config/links.ts` 基于 `env` 组合出最终 URL。

该方案依赖 Expo 的 `@expo/env` 机制加载 `.env(.development|.production)`，并通过自研脚本 `scripts/with-env.cjs` 强化加载顺序控制。

## 2. 关键文件

| 文件 | 作用 |
|---|---|
| `src/core/config/env.ts` | 运行时 env schema 定义与解析入口，导出单例 `env` |
| `src/core/config/links.ts` | 基于 `env` 生成协议页面 URL 的常量对象 `APP_LINKS` |
| `app.json` | Expo 项目元数据、权限、插件、`extra` 段 |
| `app.config.js` | 预构建钩子，将 CI 传入的 `APP_VERSION` / `APP_BUILD_NUMBER` 写入产物 |
| `eas.json` | EAS Build/Submit 构建 profile（development / preview / production） |
| `scripts/with-env.cjs` | 自定义 `.env` 加载器，解决 `@expo/env` 在 prod 下仍加载 development 的问题 |
| `env.development.b` | 本地开发示例（模板），包含 iOS/Android 双端 API/SSO/RongCloud/Aliyun 等密钥占位 |

## 3. 架构与约定

### 3.1 配置来源优先级

`env.ts` 对每个字段遵循固定优先级（从高到低）：

1. `Constants.expoConfig.extra.<key>`（由 Expo 预构建阶段注入，通常来自 `app.json#expo.extra`）
2. `process.env.EXPO_PUBLIC_<KEY>`（Metro/babel 编译期替换为字面量）
3. 硬编码默认值（schema 中的 `.default(...)` 或条件逻辑）

平台相关字段（如 `apiBaseUrl`、`ssoBaseUrl`、`protocolBaseUrlIos`/`Android`）还会根据 `Platform.OS` 选择对应后缀变量：

```ts
// 示例：iOS 优先读 extra.apiBaseUrlIos → EXPO_PUBLIC_API_BASE_URL_IOS
// Android 优先读 extra.apiBaseUrlAndroid → EXPO_PUBLIC_API_BASE_URL_ANDROID
```

### 3.2 Environment 枚举

`environment` 字段限定为 `"development" | "preview" | "production"`，默认 `"development"`。生产环境下自动切换到正式域名（`djpc.jlgkj.top` / `dj.panzhi.com`），非生产使用 `djpc.yingbowl.com`。

### 3.3 Referer 风控适配

代码注释明确说明：后端 WAF 要求 Android 的 Referer 带尾斜杠，iOS 不带，因此 `referer` 在构造时按平台追加 `/`，并强制要求携带 Referer，否则会被拦截。

### 3.4 协议链接派生层

`links.ts` 不直接持有 URL，而是以 `env.protocolBaseUrlIos` / `Android` 为基础，按 `Platform.select` 拼接 `public/protocols?code=...`，并对 iOS 端统一追加 `_ios` 后缀（服务端据此区分协议内容）。新增协议只需在此处加一条键，无需散落在各业务模块。

### 3.5 `.env` 加载流程（`scripts/with-env.cjs`）

该脚本是配置系统的核心控制点，解决 Expo 原生 loader 的行为差异：

- 接受 `<test|prod> <command...>` 参数；test→`.env.development`，prod→`.env.production`。
- 若不存在目标文件，直接报错退出。
- **prod 模式**：复制 `.env.production` 到 `.env.development.local`，让 Metro 的 dev-local 合并策略生效。
- **test 模式**：删除已存在的 `.env.development.local`，避免它覆盖 `.env.development`。
- 清除 shell 中已有的所有 `EXPO_PUBLIC_*` 变量，再逐行解析 env 文件，以**文件内容为最高优先级**覆盖进程环境。
- 设置 `NODE_ENV=test/production` 对齐 `@expo/env` 的选择逻辑。
- 写入哨兵 `__EXPO_ENV_LOADED='[]'`，阻止 `@expo/env` 二次加载 `.env.development`。

调用方应始终通过 `node scripts/with-env.cjs test|prod ...` 启动命令，而不是直接执行 Metro/测试命令。

### 3.6 构建期版本覆盖

`app.config.js` 仅在 `process.env.APP_VERSION` / `APP_BUILD_NUMBER` 存在时覆盖 `version` / `ios.buildNumber`，未提供时回退到 `app.json` 的默认值。EAS Build 的 `production` profile 开启 `autoIncrement: true`，由云端递增版本号。

## 4. 约束与规则

1. **所有运行期配置必须经 Zod 校验**：新增配置需在 `envSchema` 中声明类型、默认值与是否必填，否则会在校验阶段抛出错误。
2. **敏感密钥走 `EXPO_PUBLIC_*`**：API BaseUrl、SSO client_secret、Aliyun auth key、RongCloud AppKey、Agora/Alipay AppId 等均通过此命名空间注入，不应硬编码在源码中。
3. **平台差异化变量需成对出现**：凡涉及 iOS/Android 不同的配置（`*_IOS` / `*_ANDROID`），应同时提供两端变量并在 `env.ts` 中按 `Platform.OS` 分支读取。
4. **Environment 仅允许三个枚举值**：`development` / `preview` / `production`，新增环境需同时修改 schema 与 `app.config.js` 中的域名分支。
5. **Referer 必须携带**：Android 端自动追加尾斜杠以匹配风控白名单，业务侧不得绕过 `env.referer`。
6. **协议链接集中管理**：新增协议页 URL 应在 `links.ts` 的 `APP_LINKS` 中添加，并通过 `protocolCode(code)` 获得平台化 code。
7. **本地开发模板位于 `env.development.b`**：新开发者需据此创建自己的 `.env.development`，而非直接编辑模板。
8. **CI 构建元数据通过环境变量注入**：`APP_VERSION`、`APP_BUILD_NUMBER` 由外部 CI（EAS/GitHub Actions）传入，不应写死在仓库中。

## 5. 扩展建议

如需新增一个运行期开关，推荐路径：

1. 在 `src/core/config/env.ts` 的 `envSchema` 中添加 Zod 字段及默认值。
2. 在 `env.development.b` 中添加对应的 `EXPO_PUBLIC_*` 示例。
3. 在 `src/core/config/links.ts`（或新的 config 文件）中消费该字段。
4. 若该配置需要被 `app.json#extra` 注入，则在 `app.json` 的 `extra` 段添加同名键。
