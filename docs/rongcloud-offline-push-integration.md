# 融云离线推送集成方案

> 状态：待实施
> 范围：Android（小米/华为/OPPO/vivo/荣耀/魅族）+ iOS（APNs）
> SDK 基线：`@rongcloud/react-native-im-wrapper@5.34.0`（Android IMLib 5.34.2 / iOS IMLib 5.34.0）

---

## 1. 现状结论

离线推送**未对接**。App 当前仅有前台应用内横幅提醒（`src/features/message/notification-hub.ts`），无系统级推送通道。

| 检查项 | 结果 |
|---|---|
| RN 引擎创建传 `pushOptions` | ❌ 未配置 |
| Android 厂商 Push 插件依赖 | ❌ 未集成 |
| iOS `setDeviceToken` 调用 | ❌ 未调用 |
| `POST_NOTIFICATIONS` 权限（Android 13+） | ❌ 未声明 |
| iOS `UIBackgroundModes` 含 `remote-notification` | ❌ 仅有 `audio` |
| 融云控制台推送通道配置 | ❌ 未配置 |

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

### 4.2 iOS 集成

#### 步骤 1：`AppDelegate` 请求推送权限并上报 deviceToken

在 `ios/app/AppDelegate.mm`（或对应 Swift 文件）中：

```objc
#import <RongIMWrapper/RongIMWrapper.h>

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // ...原有 Expo 初始化代码

  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  center.delegate = self;
  [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionBadge | UNAuthorizationOptionSound)
                        completionHandler:^(BOOL granted, NSError * _Nullable error) {
    if (granted) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [application registerForRemoteNotifications];
      });
    }
  }];

  return YES;
}

// APNs 注册成功回调，将 deviceToken 传给融云
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  [RCIMIWEngine setDeviceToken:deviceToken];
}
```

> ⚠️ `setDeviceToken` **必须在 JS 层调用 `connect()` 之前**完成。由于引擎在 JS 层创建，建议在原生层直接调 `setDeviceToken`，不依赖 JS 层时序。

#### 步骤 2：`app.json` 更新 iOS 配置

```json
"ios": {
  "infoPlist": {
    "UIBackgroundModes": ["audio", "remote-notification"]
  }
}
```

#### 步骤 3：融云控制台配置 APNs

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

## 9. 实施顺序

1. **管理员**：在融云控制台 + 各厂商后台申请推送资质，获取所有凭证
2. **客户端**：实现 `withRongCloudPush.js` config plugin（Android）+ AppDelegate 修改（iOS）
3. **客户端**：改 `rongcloud-im.ts` 传 `pushOptions` + `env.ts` 加密钥
4. **客户端**：加 `POST_NOTIFICATIONS` 运行时权限请求
5. **联调**：各厂商真机验证（需打 release 包，厂商推送不支持 debug 签名）
