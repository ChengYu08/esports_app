# 盼之电竞移动端(esports_app)鸿蒙 / H5 平台适配可行性与接缝清单

> 用途:评估 esports_app(Expo + React Native)后续支持纯血鸿蒙(HarmonyOS NEXT)与 H5(Web)的可行性,并盘清全仓平台适配接缝。
> 范围:仅涉及 `esports_app` 移动端仓库;后端 `pzdj-service`、PC 端 `pzdj-pc` 不在此列。

---

## 一、总体结论(TL;DR)

| 议题 | 结论 |
| --- | --- |
| 纯血鸿蒙可行性 | **低(≈2.5/5)**。直接平移不可行;主流走"RN 全保留 + 自研 ArkTS 桥接层",或 ArkTS 重写关键页。 |
| expo-harmony 社区方案 | 真实可用,但只支持到 SDK 54/55,本项目 SDK 57 超前;且核心原生服务(IM/RTC/一键登录)仍需自研桥接。 |
| H5 可行性 | **能构建、能浏览,但核心交互不可用**。IM/语聊房/一键登录在 web 上默认 no-op。完整 H5 需换 Web SDK 重做适配层。 |
| 复制整仓策略 | **不推荐**。用"平台文件 + 构建门控 + 分支"即可零成本达到同等隔离;复制整仓会造成长期双仓同步的坑。 |
| 现在最该做的事 | 把裸露的系统模块调用收口成窄接口/平台文件,让未来适配变成"加法"而非"改业务"。 |

---

## 二、项目技术栈概览

- **框架**:Expo SDK 57 + React Native 0.86.3 + React 19.2.3 + TypeScript
- **路由**:Expo Router(文件式,typedRoutes + reactCompiler)
- **状态**:Zustand(auth)+ TanStack React Query(服务端数据)
- **网络**:axios 封装 `apiClient`(自动 token 头)
- **核心原生服务**:融云 IM、声网 Agora 语聊房、阿里云一键登录(`modules/pz-one-click`)
- **架构分层**:`app → features → core → shared`;已有 npm workspaces(`packages/auth`、`packages/sso-sdk`)
- **平台意识**:多处 `Platform.OS === 'web'` 守卫 + `PzOneClickModule.web.ts` 桩,说明原作者已考虑多平台

---

## 三、纯血鸿蒙(HarmonyOS NEXT)可行性

### 3.1 关键障碍

1. **版本永远滞后**:RNOH(React Native for OpenHarmony)与 Expo 鸿蒙社区工具最高支持 RN 0.82/0.84(Expo SDK 54/55),本项目 SDK 57 超前,要用须整体降级。
2. **重原生服务缺 RN 绑定**:融云、声网、阿里均有**原生鸿蒙 SDK**,但**没有对应 RNOH RN 绑定**,需自研 ArkTS TurboModule。
3. **成熟度风险**:社区工具单人维护、star 数十级,已知暗坑(FormData 上传崩、ExpoAsset 404、Image/PixelRatio 白屏、Hermes 无 Intl)正好砸在本项目痛点。

### 3.2 expo-harmony 社区方案现状

| 工程 | 最高基线 | 定位 |
| --- | --- | --- |
| `expo-harmony-cli`(stonehill) | SDK 54 / RN 0.82,SDK 55+ 拒绝 | 修 Expo→鸿蒙桥、注入 patch、autolinking |
| `@expo-harmony/*`(renbaoshuo) | SDK 55 / RNOH 0.84.1 | 移植几十个 Expo 模块 + CNG 支持 |

结论:对"标准 Expo 模块为主的中等 App"可行;本项目因重度原生服务,仍需自研多个 ArkTS 桥接模块。

---

## 四、混合方案:桥接层(推荐主路径)

**核心认知:RN 缺的不是"页面",而是"原生 SDK 的 RN-OH 绑定"。** UI 全留在 RN,只把缺的能力用 ArkTS 实现。

三层结构:

```
RN JS 调用        桥接层(自研 ArkTS TurboModule)       厂商原生 SDK
rongcloud-im.ts → connectRongCloud()/sendRongText() → 融云 HarmonyOS SDK
   (JS)             注册进 RNOHPackagesFactory (ArkTS)    (原生 .ets/底层库)
```

- **桥接层是适配器(facade)**,不写业务,真正能力在厂商 SDK。
- 通信走 **RNOH 自带的原生桥**(方法调用 + Emitter 事件),不需自研协议。
- 设计要点:① 接口契约与现有 JS 封装对齐(上层页面不动);② 异步用 Promise、SDK 主动推送用事件;③ 连接生命周期与 RN 挂载/前后台对齐;④ token 单一可信源(原生安全存储)。

---

## 五、H5(Web)可行性现状

### 5.1 已具备的 web 基础
- 依赖含 `react-native-web` + `react-dom`,脚本 `expo start --web`,`app.json` 配 `web.output: "static"`。
- 纯 HTTP 页面(首页/俱乐部/订单浏览/协议)基本可用。

### 5.2 核心功能在 web 上被关掉
| 能力 | web 行为 |
| --- | --- |
| 融云 IM | `isRongCloudAvailable()` 返回 false,聊天不可用 |
| 声网语聊房 | `Platform.OS === 'web'` return null,RTC 不加载 |
| 阿里一键登录 | `.web.ts` 桩直接 reject |

### 5.3 做完整 H5 需补
- 融云换 **Web IM SDK**、声网换 **Agora Web SDK**、登录走 H5 SSO/短信;并做移动端响应式打磨。
- 提醒:工作区已有 `pzdj-pc`(Nuxt+TDesign+Electron)承担 PC/H5 C 端,移动端 web 构建通常非交付目标。

---

## 六、仓库策略建议(复制整仓 vs 单仓接缝隔离)

**不推荐复制整个仓库**,原因:
1. 业务逻辑被复制两份,每个改动/修复要同步两遍,成本随功能线性增长且越拖越贵。
2. clone 后共享 git 历史一旦断裂,cherry-pick/merge 退化为人肉对照 diff。
3. 测试翻倍。

**推荐做法**:
- **单仓 + 平台接缝隔离**:用 RN 平台文件(`.web.ts` / ArkTS 桥)+ 构建门控(CI 里 iOS/安卓流水线根本不构建 harmony/web target)。
- 真要物理隔离,用**分支(branch)**而非新仓库(保留 merge 能力)。
- 万不得已独立仓库:只复制"壳",共享业务沉到私有包/subtree,两仓只保留壳+适配层。
- H5 与鸿蒙适配机制差异大,别塞进同一个兼容仓互相污染。

---

## 七、平台适配接缝清单(全仓调用点盘点)

图例:
- **现状**:✅ 已守卫(有 web 降级/Platform 分支)|⚠️ 部分|❌ 裸露(直接调用无分支)
- **鸿蒙**:📦 有 RNOH/@expo-harmony 适配包|🛠️ 需自研 ArkTS TurboModule|🟢 原生 SDK 存在但无 RN 绑定|➖ 纯 JS 无需

### 组1 · 核心三方服务 SDK(最重,桥接层所在)

| 能力 | 调用点 | 现状 | 鸿蒙要补 | H5 要补 |
| --- | --- | --- | --- | --- |
| 融云 IM | `rongcloud-im.ts`、`voice-room-rongcloud.ts`、`conversation-loader.ts` | ✅ | 🟢→🛠️ 自研 ArkTS TurboModule + 事件桥 | 🛠️ 融云 Web IM SDK + `.web.ts` |
| 声网语聊房 RTC | `voice-room-rtc.ts` | ✅ | 🟢→🛠️ 自研 ArkTS TurboModule | 🛠️ Agora Web SDK |
| 阿里一键登录 | `packages/sso-sdk/native-quick-login.ts` → `modules/pz-one-click` | ✅ 最规范 | 🟢→🛠️ 用 `.ets` 重写 PzOneClickModule | ✅ 已 reject,走短信/SSO |

> 这三处写法(窄接口 + require 懒加载 + 平台守卫)是全仓模板。

### 组2 · 系统能力原生模块(裸奔重灾区)

| 能力 | 调用点 | 现状 | 鸿蒙要补 | H5 要补 |
| --- | --- | --- | --- | --- |
| expo-secure-store | `core/storage/storage.ts`(token/隐私持久化) | ❌ 无 web 分支,库本身无 web 实现(已埋雷) | 🛠️ 映射鸿蒙 AssetStore/Preferences | 🛠️ 加 storage 平台实现 |
| expo-audio | `shared/audio/use-voice-player.ts`、VoiceRoomScreen | ❌ | 🛠️ 无 OH 实现,自研录音/播放 | 🛠️ Web Audio/getUserMedia |
| expo-image-picker | `OrderReviewSheet.tsx`(评价图上传) | ❌ | 🛠️ 需适配/自研 | 🛠️ input type=file |
| expo-file-system | `oss-upload.ts`(File)、`BasicSettingsScreen`(Paths) | ⚠️ | 📦 @expo-harmony/expo-file-system | 🛠️ 上传改 fetch/FormData |
| expo-clipboard | `order/[id].tsx`、`MineScreen` | ❌ | 📦/🛠️ 需适配包 | 🟢 web 有实现 |
| expo-web-browser | `shared/navigation/open-external-link.ts` | ❌ | 🛠️ 鸿蒙 Ability 拉起浏览器 | 🟢 window.open |
| netinfo | `core/query/use-network-recovery.ts` | ❌(库自带 web 版) | 📦 @react-native-ohos | 🟢 |

### 组3 · UI/渲染组件(web 多自动可用,鸿蒙才是难点)

| 能力 | 规模 | 现状 | 鸿蒙要补 |
| --- | --- | --- | --- |
| react-native-safe-area-context | Provider + insets 8+ 处 | ❌ | 📦 有适配包,但 RNOH 头号白屏点,需补 4 处原生注册 |
| expo-image | 全局最广泛(含 order types) | ➖ web 自动 | 🛠️ Harmony backend 未完成,需自研或降级 RN Image |
| react-native-gesture-handler | MiniPlayer 拖拽 + 根 GestureHandlerRootView | ❌ | 🛠️/⚠️ RNOH 支持需验证,根布局白屏风险 |
| react-native-reanimated + worklets | VoiceWaveform/MiniPlayer | ❌ | 📦 官方适配推进中,版本强绑定 |
| react-native-screens | 根 Stack | ❌ | 🛠️ RNOH 导航适配 |
| expo-linear-gradient / react-native-svg | 多处 | ➖ | 📦 @expo-harmony / RNOH svg |
| expo-glass-effect / @expo/ui / expo-symbols | iOS 专属装饰 | ⚠️ 需条件化 | ➖ 非 iOS 应 no-op |
| rn-emoji-keyboard / image-zoom / root-toast | Chat/image-preview/全局 | ➖ 主体纯 JS | 🟢 随 RNOH 渲染,低风险 |

### 组4 · 纯 JS,零适配(列出防遗漏)
`axios`、`crypto-js`、`zustand(@esports/auth)`、`@tanstack/react-query`、`zod`、`expo-router(JS 层)`、`expo-constants`。`expo-font` 鸿蒙需 OH 端口。

---

## 八、关键判断与建议动作

1. **鸿蒙"总闸"在根 `_layout.tsx`**:`SafeAreaProvider` + `GestureHandlerRootView` + `RootSiblingParent` 任一在 RNOH 没接好即整屏白屏,攻克顺序应从它们开始而非业务页。
2. **最高危裸露点 = `secureStorage`**:token 持久化单点,web/OH 都无实现,建议优先收口成窄接口。
3. **最省心的是核心三大服务**:反而是接缝最规范处,说明原作者有平台意识,只是没覆盖系统模块。
4. **现在就该做(近乎零风险)**:把组2/组3 裸露调用改成组1 的窄接口/平台文件模式;先建 `core/storage` 平台实现与 `expo-image`/`safe-area` 显式适配入口。这样将来无论单仓还是复制仓,适配只是"补对应 `.web.ts`/`.ets`",不回改业务页。

---

## 附:推荐的下一步产出
- **组1 三个服务的 ArkTS TurboModule 接口契约表**(RN 侧方法签名 + 事件名 + 参数结构),开发可直接照写。
