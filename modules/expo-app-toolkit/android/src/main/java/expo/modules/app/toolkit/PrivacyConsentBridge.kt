package expo.modules.app.toolkit

import android.content.Context

/** 隐私政策同意状态的原生持久化，供 MainApplication 在 onCreate 时读取 */
object PrivacyConsentState {
  private const val PREFS_NAME = "privacy_consent"
  private const val KEY_ACCEPTED = "accepted"

  fun isAccepted(context: Context): Boolean =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getBoolean(KEY_ACCEPTED, false)

  fun markAccepted(context: Context) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_ACCEPTED, true)
      .apply()
  }
}

/** 融云/厂商推送 SDK 延迟初始化桥：MainApplication 注册初始化动作，用户在同意隐私政策后触发，进程内只执行一次 */
object RongPushHook {
  @Volatile
  var initializer: (() -> Unit)? = null

  @Volatile
  private var initialized = false

  fun tryInit() {
    if (initialized) return
    val init = initializer ?: return
    initialized = true
    init()
  }
}
