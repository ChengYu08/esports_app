# RongCloud's native library resolves Java classes and members by name in JNI.
# Without these SDK keep rules, R8 removes NativeObject$QuotingMessageInfo and
# JNI_OnLoad aborts the process when IM initializes after login.
# https://docs.rongcloud.cn/android-imlib/proguard
-keepattributes Exceptions,InnerClasses,EnclosingMethod,Signature
-keep class io.rong.** { *; }
-keep class cn.rongcloud.** { *; }
-keep class * extends io.rong.imlib.model.MessageContent { *; }

# Message registration also reads MessageTag at runtime. Preserve annotations
# and annotated custom messages, including classes outside the SDK packages.
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
-keep @interface io.rong.imlib.MessageTag { *; }
-keep @io.rong.imlib.MessageTag class * { *; }

# RongCloud references these optional push provider SDKs, which are not installed.
# Only suppress the exact absent types reported by R8; do not ignore all warnings.
# Add the actual provider SDK/configuration before enabling vendor offline push.
-dontwarn com.google.android.gms.common.GoogleApiAvailability
-dontwarn com.google.android.gms.gcm.GcmListenerService
-dontwarn com.google.android.gms.iid.InstanceID
-dontwarn com.google.android.gms.iid.InstanceIDListenerService
-dontwarn com.google.android.gms.tasks.OnCompleteListener
-dontwarn com.google.android.gms.tasks.Task
-dontwarn com.google.firebase.FirebaseApp
-dontwarn com.google.firebase.FirebaseOptions
-dontwarn com.google.firebase.messaging.FirebaseMessaging
-dontwarn com.google.firebase.messaging.FirebaseMessagingService
-dontwarn com.google.firebase.messaging.RemoteMessage
-dontwarn com.heytap.msp.push.HeytapPushManager
-dontwarn com.heytap.msp.push.callback.ICallBackResultService
-dontwarn com.hihonor.push.sdk.HonorPushCallback
-dontwarn com.hihonor.push.sdk.HonorPushClient
-dontwarn com.hihonor.push.sdk.HonorMessageService
-dontwarn com.hihonor.push.sdk.HonorPushDataMsg
-dontwarn com.huawei.agconnect.config.AGConnectServicesConfig
-dontwarn com.huawei.hms.aaid.HmsInstanceId
-dontwarn com.huawei.hms.common.ApiException
-dontwarn com.huawei.hms.push.HmsMessageService
-dontwarn com.huawei.hms.push.RemoteMessage
# Huawei HMS 依赖的厂商/分析可选类，本机无对应 SDK，R8 需忽略
-dontwarn android.telephony.HwTelephonyManager
-dontwarn com.huawei.android.os.BuildEx$VERSION
-dontwarn com.huawei.hianalytics.process.HiAnalyticsConfig$Builder
-dontwarn com.huawei.hianalytics.process.HiAnalyticsConfig
-dontwarn com.huawei.hianalytics.process.HiAnalyticsInstance$Builder
-dontwarn com.huawei.hianalytics.process.HiAnalyticsInstance
-dontwarn com.huawei.hianalytics.process.HiAnalyticsManager
-dontwarn com.huawei.hianalytics.util.HiAnalyticTools
-dontwarn com.huawei.hms.availableupdate.UpdateAdapterMgr
-dontwarn com.huawei.libcore.io.ExternalStorageFile
-dontwarn com.huawei.libcore.io.ExternalStorageFileInputStream
-dontwarn com.huawei.libcore.io.ExternalStorageFileOutputStream
-dontwarn com.huawei.libcore.io.ExternalStorageRandomAccessFile
-dontwarn com.meizu.cloud.pushsdk.PushManager
-dontwarn com.meizu.cloud.pushsdk.MzPushMessageReceiver
-dontwarn com.meizu.cloud.pushsdk.handler.MzPushMessage
-dontwarn com.meizu.cloud.pushsdk.platform.message.PushSwitchStatus
-dontwarn com.meizu.cloud.pushsdk.platform.message.RegisterStatus
-dontwarn com.meizu.cloud.pushsdk.platform.message.SubAliasStatus
-dontwarn com.meizu.cloud.pushsdk.platform.message.SubTagsStatus
-dontwarn com.meizu.cloud.pushsdk.platform.message.UnRegisterStatus
-dontwarn com.vivo.push.IPushActionListener
-dontwarn com.vivo.push.PushClient
-dontwarn com.vivo.push.PushConfig$Builder
-dontwarn com.vivo.push.PushConfig
-dontwarn com.vivo.push.listener.IPushQueryActionListener
-dontwarn com.vivo.push.model.UPSNotificationMessage
-dontwarn com.vivo.push.sdk.OpenClientPushMessageReceiver
-dontwarn com.vivo.push.util.VivoPushException
-dontwarn com.xiaomi.mipush.sdk.MiPushClient
-dontwarn com.xiaomi.mipush.sdk.MiPushMessage
-dontwarn com.xiaomi.mipush.sdk.MiPushCommandMessage
-dontwarn com.xiaomi.mipush.sdk.PushMessageReceiver
