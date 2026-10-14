# RongCloud references these optional push provider SDKs, which are not installed.
# Only suppress the exact absent types reported by R8; do not ignore all warnings.
# Add the actual provider SDK/configuration before enabling vendor offline push.

# RongCloud 5.34 discovers built-in and custom message classes through the
# runtime-retained MessageTag annotation. The SDK does not ship consumer rules
# for this annotation, so R8 can remove the annotation from a kept message
# class. RongCoreClientImpl then receives null from getAnnotation() and crashes
# while calling MessageTag.value() in minified builds.
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
-keep @interface io.rong.imlib.MessageTag { *; }
-keep @io.rong.imlib.MessageTag class * { *; }

-dontwarn com.google.android.gms.common.GoogleApiAvailability
-dontwarn com.google.android.gms.iid.InstanceID
-dontwarn com.google.android.gms.tasks.OnCompleteListener
-dontwarn com.google.android.gms.tasks.Task
-dontwarn com.google.firebase.FirebaseApp
-dontwarn com.google.firebase.FirebaseOptions
-dontwarn com.google.firebase.messaging.FirebaseMessaging
-dontwarn com.heytap.msp.push.HeytapPushManager
-dontwarn com.heytap.msp.push.callback.ICallBackResultService
-dontwarn com.hihonor.push.sdk.HonorPushCallback
-dontwarn com.hihonor.push.sdk.HonorPushClient
-dontwarn com.huawei.agconnect.config.AGConnectServicesConfig
-dontwarn com.huawei.hms.aaid.HmsInstanceId
-dontwarn com.huawei.hms.common.ApiException
-dontwarn com.meizu.cloud.pushsdk.PushManager
-dontwarn com.vivo.push.IPushActionListener
-dontwarn com.vivo.push.PushClient
-dontwarn com.vivo.push.PushConfig$Builder
-dontwarn com.vivo.push.PushConfig
-dontwarn com.vivo.push.util.VivoPushException
-dontwarn com.xiaomi.mipush.sdk.MiPushClient
-dontwarn com.xiaomi.mipush.sdk.MiPushMessage
