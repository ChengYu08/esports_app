package expo.modules.app.permission

import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoAppPermissionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoAppPermission")

    Function("canRequestPackageInstalls") {
      canRequestPackageInstalls()
    }
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
}
