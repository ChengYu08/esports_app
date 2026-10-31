# 融云离线推送集成方案

> 状态：iOS ✅ 已完成客户端集成（待配置 APNs 证书）/ Android 代码就绪（待配置厂商凭证）
> 范围：Android（小米/华为/OPPO/vivo/荣耀/魅族）+ iOS（APNs）
> SDK 基线：`@rongcloud/react-native-im-wrapper@5.34.0`（Android IMLib 5.34.2 / iOS IMLib 5.34.0）

---

## 1. 现状结论

离线推送**客户端已就绪**。App 当前仅有前台应用内横幅提醒（`src/features/message/notification-hub.ts`），无系统级推送通道。

| 检查项 | 结果 |
|---|---|
| RN 引擎创建传 `pushOptions` | ✅ 已配置 |
| Android 厂商 Push 插件依赖 | ✅ 已注入（`plugins/withRongCloudPush.js`） |
| Android `RongPushPlugin.init()` | ✅ 已注入（`plugins/withRongCloudAndroidInit.js`） |
| iOS `setDeviceToken` 调用 | ✅ 已在原生层调用（`plugins/withRongCloudIosPush.js`） |
| iOS `aps-environment` entitlement | ✅ 已注入（development / production 自动切换） |
| `POST_NOTIFICATIONS` 权限（Android 13+） | ✅ 已声明 + JS 层运行时请求 |
| iOS `UIBackgroundModes` 含 `remote-notification` | ✅ 已添加 |
| 融云控制台推送通道配置 | ❌ 待管理员配置 |

---

## 2. 总体架构

```
发消息方 → 融云服务端 → 检测接收方离线 → 调用厂商推送 API → 厂商服务器 → 设备系统通知栏
                                                                              ↓
                                                                        用户点击通知 → 启动 App → IM SDK 连接 → 收取离线消息
```

**前提条件**：用户必须至少在设备上连接成功过一次，该设备才能接收推送。

---

## 3. 融云控制台配置（由管理员操作）

### 3.1 通用步骤

1. 登录融云控制台 → IM 服务功能配置页（`im_service_config`）→ 离线推送 → 应用标识及推送证书管理
2. 确保应用标识的 **Android ApplicationId** 填 `com.esportsapp.apps`
3. 在各厂商通道填入对应凭证（详见下文）
4. 保存后 **15 分钟生效**

### 3.2 各厂商控制台配置项

#### 小米推送

| 配置位置 | 字段 | 获取途径 |
|---|---|---|
| 小米开放平台 | AppID、AppKey、AppSecret | https://dev.mi.com/console/appservice/push.html |
| 融云控制台 | AppSecret | 填小米 AppSecret |

- **推送通道类型**：建议选**私信消息**（聊天消息不受数量限制），需在小米运营平台申请私信 channelId 和模板 ID
- **模板建议**：单聊用 `M12378`（标题 `新消息：{$keywords1$}`），群聊用 `M10306`
- ⚠️ 2026-12-31 前必须完成私信模板接入，否则影响私信下发

#### 华为推送

| 配置位置 | 字段 | 获取途径 |
|---|---|---|
| AppGallery Connect | Client ID、Client Secret | https://developer.huawei.com/consumer/cn/service/josp/agc/index.html |
| 融云控制台 | Client ID、Client Secret | 同上 |

- 需先在 AGC 下载 `agconnect-services.json`，放入 `android/app/` 目录（客户端集成用）
- 可选配置消息自分类标识（如 `IM`），提升推送优先级
- 华为推送不维护应用角标数量

#### OPPO 推送

| 配置位置 | 字段 | 获取途径 |
|---|---|---|
| OPPO 推送运营平台 | AppKey、AppSecret、MasterSecret | https://push.oppo.com/conf/app-configuration |
| 融云控制台 | AppKey、MasterSecret | 同上 |

- **推送通道类型**：公信通道单日限量（注册用户数×2），IM 类应用建议申请**私信通道**并在融云控制台填 channelId
- 需要 OPPO 企业开发者账号

#### vivo 推送

| 配置位置 | 字段 | 获取途径 |
|---|---|---|
| vivo 推送平台 | AppID、AppKey、AppSecret | https://vpush.vivo.com.cn |
| 融云控制台 | AppID、AppKey、AppSecret | 同上 |

- 可选配置推送模式（正式/测试）、推送通道类型与 Category

#### 荣耀推送

| 配置位置 | 字段 | 获取途径 |
|---|---|---|
| 荣耀开发者服务平台 | Client ID、Client Secret | https://developer.hihonor.com |
| 融云控制台 | Client ID、Client Secret | 同上 |

- 需先在荣耀平台下载 `mcs-services.json`，放入 `android/app/` 目录（客户端集成用）
- ⚠️ IMLib SDK 从 5.6.7 开始支持荣耀推送；荣耀 Magic OS 8.0+ 设备必须集成荣耀推送才能收到通知

#### 魅族推送

| 配置位置 | 字段 | 获取途径 |
|---|---|---|
| 魅族推送平台 | AppID、AppKey、AppSecret | https://push.meizu.com |
| 融云控制台 | AppID、AppSecret | 同上 |

---

## 4. 客户端集成

### 4.1 Android 集成（Expo CNG 项目，通过 config plugin 实现）

> ⚠️ 本项目 `android/` 目录由 `npx expo prebuild` 生成，禁止手改。
> 所有原生改动通过 `plugins/` 目录下的 config plugin 完成，然后重新 `prebuild`。

#### 步骤 1：新建 config plugin

新建 `plugins/withRongCloudPush.js`，内容要点：

```js
const { withAppBuildGradle, withProjectBuildGradle, withGradleProperties, withAndroidManifest } = require('expo/config-plugins');

// 各厂商 manifestPlaceholders + push 依赖 + 厂商 Maven 仓库
```

#### 步骤 2：project-level `build.gradle` 追加仓库

在 `plugins/withRongCloudPush.js` 的 `withProjectBuildGradle` 回调中，往 `allprojects > repositories` 追加：

```groovy
// 华为 Maven 仓库
maven { url 'https://developer.huawei.com/repo/' }
// 荣耀 Maven 仓库
maven { url 'https://developer.hihonor.com/repo' }
```

#### 步骤 3：app-level `build.gradle` 追加配置

```groovy
android {
  defaultConfig {
    manifestPlaceholders = [
      // 融云自建推送通道（RongPush）
      RONG_PUSH_ENABLE      : "true",
      // 小米
      XIAOMI_APP_ID         : "\"${MI_PUSH_APPID}\"",
      XIAOMI_APP_KEY        : "\"${MI_PUSH_APPKEY}\"",
      // 华为（值为 true 即可，具体凭证在 agconnect-services.json）
      HW_PUSH_ENABLE        : "true",
      // OPPO
      OPPO_APP_KEY          : "${OPPO_APPKEY}",
      OPPO_APP_SECRET       : "${OPPO_APPSECRET}",
      // vivo
      VIVO_APP_ID           : "${VIVO_APPID}",
      VIVO_APP_KEY          : "${VIVO_APPKEY}",
      // 荣耀
      HONOR_APP_ID          : "${HONOR_APPID}",
      // 魅族
      MEIZU_APP_ID          : "${MEIZU_APPID}",
      MEIZU_APP_KEY         : "${MEIZU_APPKEY}",
    ]
  }
}

dependencies {
  def rongPushVersion = '5.34.2'  // 与 im_libcore 版本对齐
  implementation "cn.rongcloud.sdk.push:rong:$rongPushVersion"        // RongPush 基础通道
  implementation "cn.rongcloud.sdk.push:xiaomi:$rongPushVersion"
  implementation "cn.rongcloud.sdk.push:huawei:$rongPushVersion"
  implementation "cn.rongcloud.sdk.push:oppo:$rongPushVersion"
  implementation "cn.rongcloud.sdk.push:vivo:$rongPushVersion"
  implementation "cn.rongcloud.sdk.push:honor:$rongPushVersion"
  implementation "cn.rongcloud.sdk.push:meizu:$rongPushVersion"
}

// 华为 AGC 插件（需加在文件底部）
apply plugin: 'com.huawei.agconnect'
```

#### 步骤 4：`gradle.properties` 配置厂商密钥

在 `plugins/withRongCloudPush.js` 的 `withGradleProperties` 回调中追加：

```properties
MI_PUSH_APPID=xxxxxxxx
MI_PUSH_APPKEY=xxxxxxxx
OPPO_APPKEY=xxxxxxxx
OPPO_APPSECRET=xxxxxxxx
VIVO_APPID=xxxxxxxx
VIVO_APPKEY=xxxxxxxx
HONOR_APPID=xxxxxxxx
MEIZU_APPID=xxxxxxxx
MEIZU_APPKEY=xxxxxxxx
```

> ⚠️ 这些密钥会打包进 APK，属于客户端标识，非服务端密钥。不要提交真实密钥到公共仓库。

#### 步骤 5：`MainApplication.kt` 初始化 RongPushPlugin

在 `plugins/withRongCloudPush.js` 中新建一个 `withMainApplication` 修改，在 `loadReactNative(this)` **之前**插入：

```kotlin
import cn.rongcloud.push.RongPushPlugin

override fun onCreate() {
    super.onCreate()
    RongPushPlugin.init(this)  // ← 必须早于 IM SDK init（即 JS 层 create() 调用）
    // ...原有代码
}
```

#### 步骤 6：`AndroidManifest.xml` 加权限

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

> Android 13（API 33）及以上必须动态申请通知权限，需在 JS 层做运行时权限请求。

#### 步骤 7：配置文件放入原生目录

将以下文件放入 `android/app/`（通过 plugin 的 `withDangerousMod` 拷贝，或直接放入 `modules/` 目录引用）：

| 文件 | 来源 |
|---|---|
| `agconnect-services.json` | 华为 AppGallery Connect 下载 |
| `mcs-services.json` | 荣耀开发者服务平台下载 |

> ⚠️ `agconnect-services.json` 和 `mcs-services.json` 包含应用签名信息，**不要提交到 git**。

---

### 4.2 iOS 集成 ✅ 已完成

> 实现方式：`plugins/withRongCloudIosPush.js` 在 prebuild 时自动注入以下代码到 `ios/app/AppDelegate.swift`。

#### 步骤 1：AppDelegate 推送权限请求 + deviceToken 上报

```swift
import UserNotifications

// didFinishLaunchingWithOptions 内：
let rongPushCenter = UNUserNotificationCenter.current()
rongPushCenter.delegate = self
rongPushCenter.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
  if granted {
    DispatchQueue.main.async {
      application.registerForRemoteNotifications()
    }
  }
}

// deviceToken 回调：
public override func application(
  _ application: UIApplication,
  didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
) {
  RongCloudPushHandler.shared.didRegisterForRemoteNotifications(deviceToken: deviceToken)
}

// RongCloudPushHandler（文件末尾）：
import RongIMWrapper

final class RongCloudPushHandler {
  static let shared = RongCloudPushHandler()
  private var didSetToken = false

  func didRegisterForRemoteNotifications(deviceToken: Data) {
    guard !didSetToken else { return }
    didSetToken = true
    RCIMIWEngine.setDeviceToken(deviceToken)
  }
}
```

#### 步骤 2：`app.json` iOS 配置

```json
"ios": {
  "infoPlist": {
    "UIBackgroundModes": ["audio", "remote-notification"]
  }
}
```

#### 步骤 3：`aps-environment` entitlement

由 `withRongCloudIosPush.js` 自动注入：
- `development`（本地 debug / EAS development 构建）
- `production`（`EAS_BUILD_PROFILE=production` 时）

#### 步骤 4：融云控制台配置 APNs（待管理员操作）

- 方式一（推荐）：上传 **P8 证书**（Apple 开发者账户 → Keys → 创建 APNs 密钥），永久有效，不区分沙盒/生产
- 方式二：上传 **P12 通用证书**（Sandbox & Production），每年需更换
- 填 Bundle ID：`com.esportsapp.apps`
- 打包方式必须与证书环境匹配：开发证书 → Xcode 运行/Development 包；生产证书 → AdHoc/Release 包

---

### 4.3 JS 层改动

#### 步骤 1：`rongcloud-im.ts` 引擎创建传 `pushOptions`

`src/features/message/rongcloud-im.ts` 第 439 行附近：

```ts
// 改前
engine = sdk.RCIMIWEngine.create(env.rongCloudAppKey);

// 改后
engine = sdk.RCIMIWEngine.create(env.rongCloudAppKey, {
  pushOptions: {
    idMI: Env.miPushAppId,
    appKeyMI: Env.miPushAppKey,
    appIdMeizu: Env.meizuPushAppId,
    appKeyMeizu: Env.meizuPushAppKey,
    appKeyOPPO: Env.oppoPushAppKey,
    appSecretOPPO: Env.oppoPushAppSecret,
    enableHWPush: true,
    enableVIVOPush: true,
  },
});
```

> 注：`enableFCM` 默认关闭（国内应用不上 Google Play）。如需 FCM，另行集成。

#### 步骤 2：`env.ts` 加厂商推送密钥

`src/core/config/env.ts` 增加：

```ts
export const env = {
  // ...原有字段
  miPushAppId: process.env.EXPO_PUBLIC_MI_PUSH_APP_ID ?? '',
  miPushAppKey: process.env.EXPO_PUBLIC_MI_PUSH_APP_KEY ?? '',
  meizuPushAppId: process.env.EXPO_PUBLIC_MEIZU_PUSH_APP_ID ?? '',
  meizuPushAppKey: process.env.EXPO_PUBLIC_MEIZU_PUSH_APP_KEY ?? '',
  oppoPushAppKey: process.env.EXPO_PUBLIC_OPPO_PUSH_APP_KEY ?? '',
  oppoPushAppSecret: process.env.EXPO_PUBLIC_OPPO_PUSH_APP_SECRET ?? '',
};
```

> ⚠️ 这些密钥与 `gradle.properties` 中的密钥是同一份，需保持一致。建议统一从 `.env` 文件注入。

---

### 4.4 Android 通知权限请求（运行时）

Android 13+ 需在 JS 层请求通知权限。用 `expo-notifications` 或原生模块：

```ts
import * as Notifications from 'expo-notifications';

async function requestNotificationPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  }
}
```

在登录成功后调用。

---

## 5. 推送通道选择策略

融云 SDK 根据设备 ROM 智能选择推送通道：

| 通道 | 启用条件 | 优先级 |
|---|---|---|
| 华为 | 华为 ROM + 已配置 | 高 |
| 荣耀 | 荣耀 ROM + 已配置 | 高 |
| OPPO | ColorOS/realme/OnePlus ROM + 已配置 | 高 |
| vivo | vivo ROM + 已配置 | 高 |
| 小米 | 小米 ROM + 已配置 | 高 |
| 魅族 | Flyme ROM + 已配置 | 高 |
| RongPush | 默认通道，不满足以上条件时兜底 | 低（国内大部分机型无法存活） |

---

## 6. 不落地通知（可选）

融云支持通过服务端 API 直接发通知（不写入会话），例如营销通知、系统公告：

```
POST /push/user.json        # 单用户不落地通知
POST /push/broadcast.json   # 全量用户不落地通知
```

需要后端在融云控制台获取 Server API 凭证后调用。此能力依赖客户端已完成厂商推送集成。

---

## 7. 验证清单

### Android

- [ ] 各厂商真机离线（App 被杀死），发送单聊消息，收到系统通知
- [ ] 点击通知后 App 启动并跳转到对应会话
- [ ] 前台运行时收到消息**不弹系统通知**（走应用内横幅）
- [ ] 华为/荣耀设备：确认未装 HMS Core 时的降级行为

### iOS

- [ ] 真机 kill App 后收推送
- [ ] 开发证书 + Xcode 运行可收推送（P8 证书不区分环境）
- [ ] 生产证书 + AdHoc 包可收推送
- [ ] 前台运行时收到消息不弹系统通知

### 通用

- [ ] 用户设置免打扰后不再收到该会话推送
- [ ] 多端登录时仅最后一个登录设备收到推送
- [ ] Web/PC 在线时移动端默认不推（可在融云控制台开启"Web/PC 在线手机端接收 Push"）

---

## 8. 常见问题

### Q: 为什么 App 在前台时没收到推送？

前台时 IM 长连接活跃，融云认为用户在线，不走推送通道。前台提醒需应用内自行实现（已有 `notification-hub.ts`）。

### Q: 为什么 App 退到后台 2 分钟后才收到推送？

iOS 限制：App 退到后台超过 ~2 分钟后系统会挂起 App，此时长连接断开，融云转为 APNs 推送。Android 厂商 ROM 的省电策略类似。

### Q: 为什么聊天室消息没有推送？

聊天室消息仅在线时下发，不支持离线推送。

### Q: 用户调用了 logout 还能收到推送吗？

不能。`logout()` 会注销融云服务端登录信息，彻底禁用当前设备推送。`disconnect(true)` 则保留推送能力。

### Q: 融云不维护应用角标数量？

是的。华为/荣耀明确不支持角标控制。如需角标，需自行维护未读数并通过厂商 API 设置。

### Q: 小米私信消息 2026-12-31 是什么意思？

小米要求私信消息必须通过模板方式发送。2026-12-31 前未完成模板接入，私信通道将被限制。建议尽早接入。

---

## 9. 推送点击跳转方案

### 9.1 PC 端参考实现

PC 端无系统推送，使用**应用内全局通知弹窗**，点击后跳转：

```
收到消息 → 全局通知弹窗（带操作按钮）
    ↓ 用户点击按钮
按消息类型分发：
  - 订单通知（order-notify）→ acceptOrderFromNotify() → 接单 → openChat({ type:'chat', id: buyerId })
  - 派单邀请（cs-invite）   → 进入语聊房 → openChat({ type:'chat-room', id: roomId, v: roomVersion })
  - 普通私聊消息            → openChat({ type:'chat', id: targetId })
```

关键文件：
- `stores/chat.ts` — `notifyOrderStatus()` / `acceptOrderFromNotify()` / `notifyCustomerServiceInvite()`
- `stores/ui.ts` — `openChat()` 打开全局聊天弹窗
- `composables/useNotifyGuard.ts` — 通知上限守卫 + 降级通知中心

### 9.2 移动端会触发推送的消息类型

#### 消息类型梳理

根据 `chat-message.ts` 和 `rongcloud-commands.ts`，移动端涉及的消息类型：

| 消息类型 | RC 消息标识 | 触发推送 | 说明 |
|---|---|---|---|
| 文本消息 | `RC:TxtMsg` | ✅ | 普通私聊文本，必然触发 |
| 图片消息 | `RC:ImgMsg` | ✅ | 普通私聊图片，必然触发 |
| 售后卡片 | `PZAfterSaleApply`（自定义） | ⚠️ 视配置 | 持久化消息，是否触发取决于融云控制台"自定义消息推送"开关 |
| 订单通知卡片 | `ORDER_NOTIFY`（自定义） | ⚠️ 视配置 | 同上映响，需确认控制台配置 |
| 接待邀请卡片 | `dispatchInvite`（自定义） | ⚠️ 视配置 | 同上映响，需确认控制台配置 |
| 语聊房邀请 | 文本消息（含链接） | ✅ | 本质是文本消息，走 `RC:TxtMsg` 推送 |
| 平台通知 | `TEXT_NOTIFY_MSG`（自定义） | ⚠️ 视配置 | 持久化消息，是否触发取决于控制台配置 |
| 命令消息 | `RC:CmdMsg` | ❌ | 不持久化、不计未读，融云默认不推送 |

#### 关键结论

1. **确定会触发推送的**：`RC:TxtMsg`、`RC:ImgMsg`（文本 + 图片私聊消息）
2. **视融云控制台配置而定的**：所有 `RC:CustomMsg` 类型（售后/订单通知/接待邀请/平台通知）
3. **不会触发推送的**：`RC:CmdMsg`（命令消息，非持久化）

> ⚠️ 需要管理员在融云控制台确认：**IM 服务功能配置 → 离线推送 → 自定义消息推送** 是否已开启。若未开启，所有自定义消息类型都不触发离线推送。

#### 后端自定义消息格式详解

后端通过 `RongCloudClientImpl` 发送两类融云消息：

**1. 命令消息 `RC:CmdMsg`**（不触发推送）

```java
// sendPrivateCommandMessage — 实时信令，不持久化、不计未读
CmdMsgMessage content = new CmdMsgMessage(commandName, JSON.toJSONString(command));
PrivateMessage message = new PrivateMessage()
    .setObjectName("RC:CmdMsg")
    .setContent(content)
    .setIsPersisted(0)   // 不持久化
    .setIsCounted(0);    // 不计未读
```

**2. 自定义持久化消息 `RC:CustomMsg`**（触发推送，需控制台开启）

```java
// sendPrivateCustomPersistentMessage — 聊天栏留痕，持久化 + 计未读
RcCustomMessage content = new RcCustomMessage(commandName, JSON.toJSONString(command));
PrivateMessage message = new PrivateMessage()
    .setObjectName("RC:CustomMsg")
    .setContent(content)
    .setIsPersisted(1)   // 持久化
    .setIsCounted(1);    // 计未读
```

**`RC:CustomMsg` 消息体结构**：

```json
{
  "name": "ORDER_NOTIFY",        // RongMsgCommandEnum.code，客户端用此字段区分业务类型
  "data": "{...}"                 // BaseMsgCommand 子类序列化 JSON 字符串
}
```

**`data` 字段内容（以订单通知为例）**：

```json
{
  "commandName": "ORDER_NOTIFY",
  "expireTime": "2026-10-31T12:00:00",
  "title": "老板已支付，请尽快接单~",
  "orderId": 12345,
  "orderNo": "DJ20261031xxxx",
  "buyerNickname": "张三",
  "buyerHeadImage": "https://...",
  "gameName": "王者荣耀",
  "serviceDesc": "排位赛",
  "numDesc": "3",
  "totalPriceDesc": "￥99.00",
  "createTime": "2026-10-31T10:00:00"
}
```

**各业务类型的 `name` 与 `data` 字段**：

| `name`（RongMsgCommandEnum） | 发送者（SystemUserEnum） | `data` 类型 | 说明 |
|---|---|---|---|
| `ORDER_NOTIFY` | `ORDER_ASSISTANT`（50000002） | `OrderNotifyCommand` | 订单状态变更通知，持久化到聊天栏 |
| `dispatchInvite` | `DISPATCH_ASSISTANT`（50000001） | `CustomerServiceInviteCommand` | 接待邀请卡片，持久化到聊天栏 |
| `TEXT_NOTIFY_MSG` | `PLATFORM_NOTICE`（50000000） | `TextNotifyMsgCommand` | 平台文本通知，支持 markdown |
| `QUICK_MATCH_NOTICE` | 按业务定 | `QuickMatchNoticeCommand` | 快速匹配抢单通知（命令消息，不推送） |
| `QUICK_MATCH_EXPIRED` | 按业务定 | `QuickMatchExpiredCommand` | 快速匹配超时（命令消息，不推送） |
| `CUSTOMER_SERVICE_INVITE` | 按业务定 | `CustomerServiceInviteCommand` | 拉客服实时信令（命令消息，不推送） |
| `ROOM_KICKED` | 按业务定 | `RoomKickedCommand` | 语音房踢人通知（命令消息，不推送） |

**`BaseMsgCommand` 公共字段**（所有命令 DTO 的父类）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `commandName` | `RongMsgCommandEnum` | 融云命令名称，序列化时输出 code |
| `expireTime` | `LocalDateTime` | 命令过期时间 |

#### 各消息类型点击后目标页面

| 消息来源 | targetId | 点击跳转目标 |
|---|---|---|
| 普通用户私聊 | 对方 userId | `/chat/{userId}` |
| 订单助手（系统） | `50000002` | `/chat/50000002` |
| 派单助手（系统） | `50000001` | `/chat/50000001` |
| 平台通知（系统） | `50000000` | `/chat/50000000` |
| 语聊房邀请 | 发送者 userId | `/chat/{userId}`（打开会话看邀请卡片） |

### 9.3 移动端推送点击流程

移动端是**系统通知栏点击**，链路如下：

```
用户点击系统推送通知
    ↓
iOS：userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:
Android：PendingIntent → MainActivity.onNewIntent() / onCreate()
    ↓
解析融云推送数据 → 提取 targetId + conversationType + 消息类型
    ↓
通过 NativeEventEmitter / Intent extra 传给 JS 层
    ↓
JS 层按 targetId 分发：
  - targetId = "50000002"  → /chat/50000002（订单助手会话）
  - targetId = "50000001"  → /chat/50000001（派单助手会话）
  - targetId = "50000000"  → /chat/50000000（平台通知会话）
  - 其他 targetId          → /chat/{targetId}（普通私聊）
  - 无 targetId / 解析失败   → 回首页 /(tabs)/message
```

### 9.4 iOS 实现步骤

#### 步骤 1：AppDelegate 添加通知点击回调

在 `plugins/withRongCloudIosPush.js` 注入的代码基础上，追加：

```swift
// 在 AppDelegate 类内注入：
public override func userNotificationCenter(
  _ center: UNUserNotificationCenter,
  didReceive response: UNNotificationResponse,
  withCompletionHandler completionHandler: @escaping () -> Void
) {
  let userInfo = response.notification.request.content.userInfo
  // 融云推送数据格式：userInfo 包含 rc 字段（融云协议）
  // 提取 targetId / conversationType
  if let rcData = userInfo["rc"] as? [String: Any] {
    let targetId = rcData["tId"] as? String ?? ""
    let conversationType = rcData["cType"] as? String ?? ""
    // 通过 UserDefaults 暂存，JS 层启动时读取
    UserDefaults.standard.set(["targetId": targetId, "conversationType": conversationType],
                              forKey: "rongPushPendingClick")
  }
  completionHandler()
}
```

> **注意**：iOS 点击推送时 JS 层可能尚未就绪（React Native 桥接还没初始化），所以先存 UserDefaults，等 JS 层初始化完成后再读取并清除。

#### 步骤 2：冷启动捕获（在 `super.application()` 之后）

```swift
// 替换 "return super.application(...)" 为：
let rongLaunchResult = super.application(application, didFinishLaunchingWithOptions: launchOptions)

// RongCloudPush: capture cold-start push notification
if let rongRemoteNotification = launchOptions?[UIApplication.LaunchOptionsKey.remoteNotification] as? [AnyHashable: Any],
   let rongRcData = rongRemoteNotification["rc"] as? [String: Any] {
  let rongTargetId = rongRcData["tId"] as? String ?? ""
  if !rongTargetId.isEmpty {
    UserDefaults.standard.set(["targetId": rongTargetId], forKey: "rongPushPendingClick")
  }
}

return rongLaunchResult
```

> **关键**：冷启动捕获必须在 `super.application()` 之后执行。`super.application()` 会触发 React Native 初始化（异步），如果在之前写入 UserDefaults，JS 层可能在写入完成前就开始读取，导致丢失跳转数据。

#### 步骤 3：JS 层读取并跳转

```typescript
// src/features/message/push-click-handler.ts
import { NativeModules, Platform } from "react-native";
import { router } from "expo-router";
import {
  getSystemConversationTitle,
  normalizeSystemConversationId,
} from "./system-conversations";

export type PendingPushClick = {
  targetId: string;
  conversationType: string;
};

function navigateToPushTarget(targetId: string, conversationType: string) {
  if (!targetId) {
    router.push("/(tabs)/message");
    return;
  }
  // 系统会话 ID 统一使用 rc_p_ 前缀格式（system-conversations.ts）
  const normalizedId = normalizeSystemConversationId(targetId);
  const title = getSystemConversationTitle(normalizedId, "");
  router.push({ pathname: "/chat/[id]", params: { id: normalizedId, title } });
}

export async function handlePendingPushClick() {
  try {
    const pending = await NativeModules.RongCloudPushModule?.getPendingPushClick?.();
    if (!pending?.targetId) return;
    await NativeModules.RongCloudPushModule?.clearPendingPushClick?.().catch(() => undefined);
    navigateToPushTarget(pending.targetId, pending.conversationType ?? "");
  } catch { /* ignore */ }
}
```

#### 步骤 4：App 启动时调用

```typescript
// src/app/_layout.tsx useEffect 内（IM 初始化完成后）
void handlePendingPushClick();
```

### 9.5 Android 实现步骤

#### 步骤 1：MainApplication 暴露存储方法

`plugins/withRongCloudAndroidInit.js` 向 MainApplication 注入：

```kotlin
// MainApplication.kt
// RongCloudPush: store push notification tap data (called from MainActivity)
fun storePushClickData(pushData: String) {
  getSharedPreferences("rong_push", android.content.Context.MODE_PRIVATE)
    .edit()
    .putString("pending_push_click", pushData)
    .putBoolean("pending_push_click_pending", true)
    .apply()
}
```

#### 步骤 2：MainActivity 处理 Intent

新建 `plugins/withRongCloudAndroidPushClick.js`，注入到 MainActivity：

```kotlin
// MainActivity.kt — onCreate 内注入（冷启动：App 被杀死 → 点击通知）
override fun onCreate(savedInstanceState: Bundle?) {
  // ...原有代码...
  super.onCreate(null)

  // RongCloudPushActivity: handle cold-start push tap
  handlePushClickIntent(intent)
}

// 新增方法（温启动：App 在后台 → 点击通知）
override fun onNewIntent(intent: android.content.Intent?) {
  super.onNewIntent(intent)
  handlePushClickIntent(intent)
}

private fun handlePushClickIntent(intent: android.content.Intent?) {
  val pushData = intent?.getStringExtra("pushData") ?: return
  (application as? MainApplication)?.storePushClickData(pushData)
}
```

> **注意**：MainActivity 的 `onCreate` 已有实现，插件注入时只能在现有方法体内追加 `handlePushClickIntent(intent)` 调用，不能新增 `override fun onCreate`（Kotlin 不允许重复 override）。

#### 步骤 3：融云推送数据格式

融云厂商推送点击后，Intent extra 中 `pushData` 字段为 JSON：

```json
{
  "conversationType": "private",
  "targetId": "12345",
  "messageType": "RC:TxtMsg",
  "pushType": "RCMessage",
  "extra": ""
}
```

#### 步骤 4：JS 层读取

```typescript
// push-click-handler.ts 内，Android 分支
async function handlePendingPushClickAndroid() {
  const raw = await NativeModules.RongCloudPushModule?.getPendingPushClick?.();
  if (!raw) return;
  await NativeModules.RongCloudPushModule?.clearPendingPushClick?.().catch(() => undefined);
  try {
    const data = JSON.parse(raw) as Partial<PendingPushClick>;
    navigateToPushTarget(data.targetId ?? "", data.conversationType ?? "");
  } catch { /* ignore */ }
}
```

### 9.6 移动端与 PC 端差异对比

| 维度 | PC 端 | 移动端 |
|---|---|---|
| 通知形式 | 应用内 TDesign NotifyPlugin 弹窗 | 系统通知栏推送 |
| 点击事件 | `onClick` 回调（JS 直接处理） | 原生层回调 → UserDefaults/SharedPreferences → JS 启动时读取 |
| 跳转方式 | `useUiStore().openChat()` 打开全局弹窗 | `router.push()` 导航到路由 |
| 业务类型分发 | 订单通知/派单邀请/普通消息 | 按 targetId 分发（系统会话 vs 普通用户） |
| 冷启动处理 | 不涉及（PC 常驻） | iOS：launchOptions 捕获 → UserDefaults；Android：onCreate Intent → SharedPreferences |
| 温启动处理 | 不涉及 | iOS：didReceiveNotificationResponse；Android：onNewIntent |
| 通知中心 | 有（降级被挤掉的通知） | 无（系统通知中心自然管理） |

### 9.7 关键文件改动清单

| 文件 | 改动 | 平台 |
|---|---|---|
| `plugins/withRongCloudIosPush.js` | 追加注入 `didReceiveNotificationResponse` + 冷启动捕获（`super.application()` 之后） | iOS |
| `plugins/withRongCloudAndroidInit.js` | 追加注入 `storePushClickData()` 到 MainApplication | Android |
| `plugins/withRongCloudAndroidPushClick.js` | **新增**：注入 `handlePushClickIntent` 调用到 MainActivity.onCreate + `onNewIntent` 方法 | Android |
| `src/features/message/push-click-handler.ts` | 新增：读取 PendingPushClick + 路由跳转 + `normalizeSystemConversationId` | JS |
| `src/app/_layout.tsx` | 调用 `handlePendingPushClick()` | JS |

### 9.8 注意事项

1. **系统会话 ID 格式**：项目内系统会话统一使用 `rc_p_` 前缀（如 `rc_p_50000002`），跳转前必须调用 `normalizeSystemConversationId` 转换，直接使用原始 ID 会导致会话匹配失败。

2. **iOS 冷启动时序**：冷启动推送数据捕获必须在 `super.application()` 之后执行。`super.application()` 触发 React Native 异步初始化，在此之前写入 UserDefaults 存在 JS 层先读取的竞态。

3. **Android onCreate 唯一性**：MainActivity 的 `onCreate` 已有实现，插件只能向现有方法体内注入调用，不能新增 `override fun onCreate`。这是通过 `withMainActivity` 正则匹配现有 `super.onCreate(null)` 后追加实现的。

4. **数据消费幂等**：JS 层读取到 PendingPushClick 后必须立即调用 `clearPendingPushClick()` 清除，否则下次启动会重复跳转。

5. **原生模块缺失容错**：`NativeModules.RongCloudPushModule?.getPendingPushClick?.()` 使用可选链调用，原生模块未实现时静默跳过，不影响 App 启动。

---

## 10. 实施状态

| 步骤 | 状态 | 说明 |
|---|---|---|
| iOS AppDelegate 推送权限 + deviceToken | ✅ 完成 | `plugins/withRongCloudIosPush.js` |
| iOS `aps-environment` entitlement | ✅ 完成 | 自动注入 development/production |
| iOS `UIBackgroundModes` | ✅ 完成 | `app.json` 已更新 |
| Android 厂商 Push 插件 + 初始化 | ✅ 完成 | `plugins/withRongCloudPush.js` + `withRongCloudAndroidInit.js` |
| Android `POST_NOTIFICATIONS` 权限 | ✅ 完成 | manifest + JS 层运行时请求 |
| JS 层 `pushOptions` 传递 | ✅ 完成 | `rongcloud-im.ts` + `env.ts` |
| **iOS APNs 证书配置** | ⏳ 待管理员 | Apple 开发者账户 → P8/P12 → 融云控制台 |
| **Android 厂商凭证配置** | ⏳ 待管理员 | 各厂商后台 → 融云控制台 |
| **融云控制台开启自定义消息推送** | ⏳ 待管理员 | 影响 ORDER_NOTIFY / dispatchInvite / TEXT_NOTIFY_MSG 是否触发推送 |
| **推送点击跳转（iOS）** | ✅ 完成 | `plugins/withRongCloudIosPush.js` 追加回调 + `push-click-handler.ts` |
| **推送点击跳转（Android）** | ✅ 完成 | `plugins/withRongCloudAndroidInit.js` 追加 Intent 处理 + `push-click-handler.ts` |
| 真机联调 | ⏳ 待凭证配置完成 | 需 release 包验证 |
