# 项目初始化规范

本文档定义 `esports_app` 的商业级初始化范围、技术选型、目录约定和验收标准。目标是在不牺牲 Expo 托管工作流和跨平台能力的前提下，建立可维护、可观测、可扩展的移动端基础设施。

## 1. 当前基线

- Expo SDK：`57`（React Native `0.86`、React `19`）。所有 Expo 包必须通过 `npx expo install` 安装，以确保版本兼容。
- 路由：Expo Router，路由文件位于 `src/app/`。
- 原生目录：当前未提交 `ios/` 和 `android/`，继续使用 Continuous Native Generation；原生行为通过 `app.json` 或 Config Plugin 配置。
- TypeScript：启用严格类型检查，禁止用 `any` 绕过领域模型和接口校验。
- 构建与发布：使用 EAS Build、EAS Submit 和 EAS Update；开发、预览、生产环境分别配置。

## 2. 初始化范围与选型

| 能力 | 推荐方案 | 约束 |
| --- | --- | --- |
| 路由与深链 | Expo Router + typed routes | 页面只能放在 `src/app/`，业务组件不得直接充当路由文件 |
| 服务端状态 | TanStack Query | 统一处理请求缓存、重试、失效和分页；不把服务端数据复制到全局 UI 状态 |
| 本地 UI 状态 | Zustand | 仅保存跨页面的短期状态；按领域拆分 Store |
| 持久化存储 | `expo-secure-store`（令牌等机密）+ `@react-native-async-storage/async-storage`（非机密） | 不得把密码、刷新令牌或隐私数据写入 AsyncStorage |
| 网络请求 | `fetch` 封装层 + TanStack Query | 统一超时、鉴权、错误模型、取消请求和日志脱敏；业务代码不得直接散落调用 `fetch` |
| 数据校验 | Zod | 对环境变量、接口响应和表单输入进行运行时校验 |
| 权限 | Expo Modules（按需使用 `expo-camera`、`expo-location` 等） | 只在用户触发功能时申请权限，并处理拒绝、受限和系统设置跳转 |
| 屏幕适配 | `useWindowDimensions`、Safe Area、Flex 布局 | 禁止依赖固定屏幕宽度；刘海、底部 Home Indicator 和横屏策略必须验证 |
| 静态资源 | `assets/` 分层管理 + `expo-image` | 图片提供尺寸、占位和失败态；大图压缩并避免在列表中重复解码 |
| 日志与崩溃 | 分级 Logger + Sentry（生产环境） | 默认不输出敏感信息；用户标识、令牌、手机号等必须脱敏 |
| 启动图与应用图标 | `expo-splash-screen` + `app.json` 图标配置 | 启动图只承担品牌展示；资源需同时覆盖 iOS、Android 自适应图标和 Web favicon |
| 测试 | Jest/React Native Testing Library + E2E（按核心链路接入） | 至少覆盖鉴权、网络错误、关键表单和主导航链路 |
| 代码质量 | ESLint + Prettier + TypeScript | 提交前执行 lint、类型检查和测试；禁止提交调试日志与密钥 |

第三方依赖必须满足：维护活跃、兼容 Expo SDK 57、具备明确的原生配置方式，并说明引入理由。新增原生依赖后必须使用 Development Build 验证，不能只依赖 Expo Go。

## 3. 目标目录结构

```text
src/
  app/                    # Expo Router 页面、布局、错误页和 API 路由（如需要）
    _layout.tsx
    (auth)/               # 登录、注册、找回密码
    (tabs)/               # 主导航
    +not-found.tsx
  components/             # 可复用展示组件
  features/               # 按业务域组织的页面片段、hooks 和模型
    auth/
    home/
    match/
  services/               # API Client、鉴权、分析、日志等基础服务
  store/                  # Zustand stores
  hooks/                  # 跨业务通用 hooks
  lib/                    # queryClient、storage、logger、validation 等基础设施
  constants/              # 主题、路由常量、业务常量
  theme/                  # 颜色、字体、间距、圆角、阴影和断点
  types/                  # 全局类型和 API 类型
  utils/                  # 无副作用的纯函数
  assets/                 # 如需随源码复用，可在此建立资源索引
```

路由层只负责组合页面和导航参数。请求、状态、表单校验和业务规则放在 `features/`、`services/` 或 `lib/` 中，避免路由文件膨胀。

## 4. 路由与导航

1. 在根布局中配置 `QueryClientProvider`、主题、Safe Area 和全局错误边界。
2. 使用路由组区分认证区和主应用区；由认证状态决定重定向，避免在每个页面重复判断。
3. 开启并保持 typed routes，路由参数使用明确类型，不拼接未经编码的用户输入。
4. 统一处理登录后回跳、登出清栈、冷启动深链和未知路由。
5. 页面必须提供加载态、空态、错误态和返回行为；Android 返回手势与 iOS 导航行为都要验证。

## 5. 存储与鉴权

- 设计 `accessToken`、`refreshToken`、过期时间和用户会话模型；访问令牌过期时只允许单次刷新，避免并发请求形成刷新风暴。
- 令牌使用 SecureStore 保存；登出时清理令牌、Query 缓存、用户私有 Store 和相关深链状态。
- 应用启动先恢复会话，再渲染受保护页面；恢复失败进入登录页并显示可理解的提示。
- 不在日志、崩溃报告、URL、剪贴板或通知内容中暴露令牌和个人敏感信息。
- 如接入生物识别、相册、相机、定位或通知，必须提供权限说明、拒绝后的降级路径和系统设置入口。

## 6. 网络请求与数据层

建立统一 `apiClient`，至少包含：

- 基础 URL、请求 ID、超时、取消信号和 JSON 编解码；
- 统一错误结构（网络不可达、超时、鉴权失败、业务错误、服务端错误）；
- 自动附加鉴权头和版本信息；
- 仅对幂等请求执行有限次数、带退避的重试；
- 开发环境可查看请求耗时，生产环境只记录脱敏元数据；
- 响应通过 Zod 校验，服务端字段变更时快速失败并上报。

TanStack Query 负责缓存、失效、分页和乐观更新。Mutation 必须定义成功、失败、回滚和重复点击策略；列表请求必须支持空数据、下拉刷新、分页加载和错误重试。

## 7. 屏幕适配与设计系统

- 所有页面包裹 Safe Area，统一处理状态栏、导航栏和键盘遮挡。
- 使用 Flex、百分比和 `useWindowDimensions` 实现响应式布局；只在设计稿明确要求时使用固定尺寸。
- 建立颜色、字体、间距、圆角、阴影和 z-index tokens，禁止业务组件散落硬编码颜色。
- 设计并验证小屏、常见大屏、刘海屏、深色模式、字体放大和横屏（若支持）场景。
- 触控目标不小于平台建议尺寸；列表使用稳定 key、虚拟化和图片尺寸约束，避免首屏卡顿。

## 8. 静态资源、启动图与图标

建议按用途管理资源：`assets/images/`、`assets/icons/`、`assets/fonts/`、`assets/animations/`。文件名使用小写 kebab-case，并记录来源、授权和目标尺寸。

- 启动图由 `expo-splash-screen` 管理，启动阶段只执行必要初始化；网络请求不得阻塞启动图隐藏。
- `app.json` 同时配置主图标、iOS 图标、Android adaptive icon、单色图标和 Web favicon。
- 图标提供安全留白，Android 前景图与背景图分离；每次替换资源后在真实 iOS 和 Android 构建中检查裁切、缩放和深色模式效果。
- 图片优先使用 `expo-image`，提供占位图、缓存策略和加载失败兜底。

## 9. 日志、监控与隐私

实现统一 Logger，至少支持 `debug`、`info`、`warn`、`error` 四级，并按环境控制输出。生产日志必须包含时间、版本、平台、请求 ID 和可关联但不可识别个人的上下文。

接入崩溃监控后，配置 source map 上传、发布版本标识、用户主动反馈和网络错误聚合。监控事件必须遵守隐私政策、最小化采集原则和数据保留期限；上线前确认第三方 SDK 的隐私清单与 App Store/Google Play 申报一致。

## 10. 环境变量与发布

至少维护 `development`、`preview`、`production` 三套配置。环境变量只保存非机密的客户端配置（例如 API 地址、环境名和公开项目 ID）；密钥放在 EAS Secrets 或 CI 密钥系统中，禁止提交 `.env` 和签名文件。

建议提供 `.env.example`，并在启动时校验必填变量。EAS profile 应明确渠道、Bundle Identifier/Application ID、运行时版本、更新分支和构建产物；每次发布记录 Git commit、版本号、变更说明和回滚方式。

## 11. 实施顺序

- [ ] 阶段一：清理模板代码，确认 `src/app` 路由、根布局、主题和错误边界（已完成根布局 Provider 接入，模板页面与错误边界待业务实现）。
- [ ] 阶段二：建立 API Client、Zod 模型、Query Client、SecureStore/AsyncStorage 封装和鉴权状态机（已完成 API Client、环境校验、Query Client 和双存储封装，鉴权状态机待接入后端）。
- [ ] 阶段三：建立设计 tokens、Safe Area、响应式布局工具、通用加载/空/错误组件（已完成 Safe Area Provider，通用状态组件待实现）。
- [ ] 阶段四：整理图片、字体、启动图、iOS/Android/Web 图标，并完成真实设备检查。
- [ ] 阶段五：接入 Logger、崩溃监控、分析事件和隐私脱敏策略。
- [ ] 阶段六：补齐 lint、类型检查、单元测试、关键链路 E2E 与 EAS 多环境配置（lint 与类型检查已通过，测试和 EAS 多环境待补齐）。
- [ ] 阶段七：执行预发布验收，确认权限、深链、离线、弱网、升级、登出和回滚场景。

## 12. 完成标准

初始化完成后必须满足：

1. `npx expo lint` 和 `npx tsc --noEmit` 通过，且无未解释的警告。
2. 冷启动、热启动、登录、登出、深链和未知路由在 iOS 与 Android 真机或模拟器上可用。
3. 断网、超时、401、服务端错误、空数据和重复提交均有可恢复的用户反馈。
4. 令牌、个人信息和生产接口响应不会出现在控制台、崩溃报告或构建产物中。
5. 启动图、应用图标、状态栏、安全区、深色模式和字体放大通过视觉检查。
6. 开发、预览、生产构建可以独立配置、发布和回滚，并有对应的操作记录。

本文档是初始化基线。任何新增基础设施、原生依赖或权限都应同步补充选型理由、风险、隐私影响和验收项。
