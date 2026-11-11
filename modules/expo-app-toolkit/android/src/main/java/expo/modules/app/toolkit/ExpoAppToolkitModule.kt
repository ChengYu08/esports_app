package expo.modules.app.toolkit

import android.net.Uri
import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ExpoAppToolkitModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoAppToolkit")

    Function("canRequestPackageInstalls") {
      canRequestPackageInstalls()
    }

    AsyncFunction("md5File") Coroutine { uri: String ->
      withContext(Dispatchers.IO) { md5File(uri) }
    }

    Function("markPrivacyConsentAccepted") {
      val context = appContext?.reactContext
        ?: throw CodedException("ERR_MISSING_CONTEXT", "React context is not available", null)
      PrivacyConsentState.markAccepted(context)
      RongPushHook.tryInit()
    }

    AsyncFunction("getPendingPushClick") {
      val context = appContext?.reactContext
        ?: throw CodedException("ERR_MISSING_CONTEXT", "React context is not available", null)
      val prefs = context.getSharedPreferences(PUSH_CLICK_PREFS, android.content.Context.MODE_PRIVATE)
      if (!prefs.getBoolean("pending_push_click_pending", false)) {
        return@AsyncFunction null
      }
      return@AsyncFunction prefs.getString("pending_push_click", null)
    }

    AsyncFunction("clearPendingPushClick") {
      val context = appContext?.reactContext
      if (context != null) {
        context.getSharedPreferences(PUSH_CLICK_PREFS, android.content.Context.MODE_PRIVATE)
          .edit()
          .clear()
          .apply()
      }
    }

    Function("clearAppIconBadge") {
      val context = appContext?.reactContext
      if (context != null) {
        clearRongPushNotifications(context)
      }
    }
  }

  private companion object {
    /** 与 MainApplication.storePushClickData（plugins/withRongCloudAndroidInit.js 注入）共用 */
    const val PUSH_CLICK_PREFS = "rong_push"
  }

  /**
   * Android 8+ 判断"安装未知应用"授权状态的官方 API；
   * 低版本系统没有该开关，声明即可装，视为已授权。
   * 前提：APK manifest 必须声明 REQUEST_INSTALL_PACKAGES，否则恒为 false。
   */
  private fun canRequestPackageInstalls(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true
    val context = appContext?.reactContext
      ?: throw CodedException("ERR_MISSING_CONTEXT", "React context is not available", null)
    return context.packageManager.canRequestPackageInstalls()
  }

  /**
   * 只清理融云展示的离线消息与后台广播推送，避免误删语音房前台服务通知。
   * 使用反射隔离可选的融云 Push 依赖，未配置 Push 的构建也能正常加载本模块。
   */
  private fun clearRongPushNotifications(context: android.content.Context) {
    runCatching {
      val client = Class.forName("io.rong.push.RongPushClient")
      val contextType = android.content.Context::class.java
      client.getMethod("clearAllPushNotifications", contextType).invoke(null, context)
      client.getMethod("clearAllPushServiceNotifications", contextType).invoke(null, context)
    }
  }

  /** 流式计算文件 MD5（64KB 缓冲），返回小写 32 位 hex；downloadAsync 返回的 uri 含百分号编码，须经 Uri 解码为真实路径 */
  private fun md5File(uri: String): String {
    val path = Uri.parse(uri).path ?: uri
    val file = File(path)
    if (!file.exists()) {
      throw CodedException("ERR_FILE_NOT_FOUND", "文件不存在: $path", null)
    }
    val digest = MessageDigest.getInstance("MD5")
    FileInputStream(file).use { input ->
      val buffer = ByteArray(64 * 1024)
      while (true) {
        val read = input.read(buffer)
        if (read == -1) break
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }
}
