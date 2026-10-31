package expo.modules.pz.oneclick

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.GradientDrawable
import android.util.Log
import android.view.View
import org.json.JSONObject
import com.mobile.auth.gatewayauth.PhoneNumberAuthHelper
import com.mobile.auth.gatewayauth.ResultCode
import com.mobile.auth.gatewayauth.TokenResultListener
import com.mobile.auth.gatewayauth.model.TokenRet
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val TAG = "PzOneClick"
private val PROTOCOL_BASE_URL =
  if (BuildConfig.DEBUG) "https://djpc.yingbowl.com" else "https://dj.panzhi.com"
private val USER_AGREEMENT_URL = "$PROTOCOL_BASE_URL/public/protocols?code=user_server"
private val PRIVACY_POLICY_URL = "$PROTOCOL_BASE_URL/public/protocols?code=user_privacy"

class PzOneClickModule : Module() {
  private var authHelper: PhoneNumberAuthHelper? = null

  override fun definition() = ModuleDefinition {
    Name("PzOneClick")
    Events("onStateChange")

    AsyncFunction("checkLoginAvailableAsync") { _: Map<String, String>, authSDKKey: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "一键登录需要在前台页面中调用", null)
        return@AsyncFunction
      }
      if (authSDKKey.isBlank()) {
        Log.w(TAG, "[DEBUG-QUICK-LOGIN] SDK key is not configured")
        sendEvent("onStateChange", mapOf("state" to "unavailable"))
        promise.resolve(false)
        return@AsyncFunction
      }

      sendEvent("onStateChange", mapOf("state" to "checking"))
      val helper = createHelper(activity.applicationContext, object : TokenResultListener {
        private var finished = false

        override fun onTokenSuccess(result: String) {
          if (finished) return
          finished = true
          val code = resultCode(result)
          // SDK 文档规定 checkEnvAvailable 成功回调的是 600024 (CODE_ERROR_ENV_CHECK_SUCCESS)，
          // 但部分版本会回 600000。两个都视为可用。
          val available = code == ResultCode.CODE_SUCCESS || code == ResultCode.CODE_ERROR_ENV_CHECK_SUCCESS
          Log.i(TAG, "[DEBUG-QUICK-LOGIN] environment check completed: code=$code, available=$available")
          authHelper?.setAuthListener(null)
          sendEvent("onStateChange", mapOf("state" to if (available) "available" else "unavailable"))
          promise.resolve(available)
        }

        override fun onTokenFailed(result: String) {
          if (finished) return
          finished = true
          val code = resultCode(result)
          val message = resultMessage(result)
          Log.w(TAG, "[DEBUG-QUICK-LOGIN] environment check failed: code=$code, message=$message")
          authHelper?.setAuthListener(null)
          sendEvent("onStateChange", mapOf("state" to "unavailable"))
          promise.resolve(false)
        }
      })
      helper.setAuthSDKInfo(authSDKKey)
      helper.checkEnvAvailable(PhoneNumberAuthHelper.SERVICE_TYPE_LOGIN)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("authorizeAsync") { _: Map<String, String>, authSDKKey: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "一键登录需要在前台页面中调用", null)
        return@AsyncFunction
      }
      if (authSDKKey.isBlank()) {
        promise.reject("MISSING_AUTH_KEY", "未配置阿里云号码认证 Android key", null)
        return@AsyncFunction
      }

      sendEvent("onStateChange", mapOf("state" to "authorizing"))
      val helper = createHelper(activity.applicationContext, object : TokenResultListener {
        private var finished = false

        override fun onTokenSuccess(result: String) {
          if (finished) return
          val tokenRet = parseResult(result)
          val code = tokenRet?.code ?: "unknown"
          if (code == ResultCode.CODE_START_AUTHPAGE_SUCCESS) {
            Log.i(TAG, "[DEBUG-QUICK-LOGIN] authorization page presented")
            return
          }
          if (code == ResultCode.CODE_SUCCESS && !tokenRet?.token.isNullOrBlank()) {
            finished = true
            val spToken = tokenRet?.token.orEmpty()
            Log.i(TAG, "[DEBUG-QUICK-LOGIN] carrier authorization succeeded")
            authHelper?.setAuthListener(null)
            authHelper?.quitLoginPage()
            promise.resolve(mapOf("spToken" to spToken))
            return
          }
          Log.w(TAG, "[DEBUG-QUICK-LOGIN] unexpected authorization response: code=$code")
          finished = true
          authHelper?.setAuthListener(null)
          authHelper?.quitLoginPage()
          promise.reject("AUTHORIZATION_FAILED", "一键登录没有返回有效授权结果", null)
        }

        override fun onTokenFailed(result: String) {
          val code = resultCode(result)
          val message = resultMessage(result)
          Log.i(TAG, "[DEBUG-QUICK-LOGIN] onTokenFailed: code=$code, message=$message, finished=$finished")
          if (finished) return
          finished = true
          // 取消路径分两类，JS 侧要据此决定露出什么：
          // 700001 点「验证码或密码登录」→ 关掉授权页，露出下面的密码/验证码表单；
          // 700010/700011 点返回按钮/返回键 → 退出登录页回首页。
          val cancelledBySwitch = code == ResultCode.CODE_ERROR_USER_SWITCH
          val cancelledByBack =
            code == ResultCode.CODE_ERROR_USER_CANCEL ||           // 700000
            code == ResultCode.CODE_ERROR_USER_CONTROL_CANCEL_BYBTN || // 700010
            code == ResultCode.CODE_ERROR_USER_CONTROL_CANCEL_BYKEY    // 700011 返回键
          val cancelled = cancelledBySwitch || cancelledByBack
          Log.i(TAG, "[DEBUG-QUICK-LOGIN] authorization ended: code=$code, cancelled=$cancelled")
          authHelper?.setAuthListener(null)
          // 失败/取消时都要关掉授权页，避免残留在 Activity 栈里。
          authHelper?.quitLoginPage()
          sendEvent("onStateChange", mapOf("state" to if (cancelled) "cancelled" else "unavailable"))
          promise.reject(
            when {
              cancelledBySwitch -> "USER_SWITCHED"
              cancelledByBack -> "USER_EXITED"
              else -> "AUTHORIZATION_FAILED"
            },
            "一键登录失败，请使用其他登录方式",
            null,
          )
        }
      })
      helper.setAuthSDKInfo(authSDKKey)
      helper.setAuthUIConfig(authUIConfig())
      helper.getLoginToken(activity, 8000)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("cancelAsync") { promise: Promise ->
      authHelper?.apply {
        quitLoginPage()
        setAuthListener(null)
      }
      sendEvent("onStateChange", mapOf("state" to "cancelled"))
      promise.resolve(null)
    }.runOnQueue(Queues.MAIN)
  }

  private fun createHelper(context: android.content.Context, listener: TokenResultListener): PhoneNumberAuthHelper {
    return PhoneNumberAuthHelper.getInstance(context, listener).also {
      authHelper = it
      it.reporter.setLoggerEnable(false)
    }
  }

  private fun authUIConfig(): com.mobile.auth.gatewayauth.AuthUIConfig {
    val density = appContext.reactContext?.resources?.displayMetrics?.density ?: 1f
    // Figma 设计稿色板
    val brandPrimary = Color.rgb(254, 31, 76)        // #FE1F4C
    val gray1 = Color.rgb(26, 26, 26)                // #1A1A1A
    val gray3 = Color.rgb(153, 153, 153)             // #999999
    val gray9 = Color.rgb(128, 128, 128)             // #808080
    val linkBlue = Color.rgb(27, 106, 224)           // #1B6AE0

    // Figma 按钮：高 42、圆角 8、红 #FE1F4C，左右边距 15dp
    val loginButton = GradientDrawable().apply {
      setColor(brandPrimary)
      cornerRadius = 8f * density
    }
    val loginButtonMargin = (15f * density).toInt()
    return com.mobile.auth.gatewayauth.AuthUIConfig.Builder()
    // 授权页进出不做动画：退出时 RN 侧会立即盖一层全屏加载遮罩，
    // SDK 默认的 Activity 转场动画会和遮罩淡入打架，看起来像闪回登录页。
    .setAuthPageActIn("android:activity/fade_in", "android:activity/fade_out")
    .setAuthPageActOut("android:activity/fade_in", "android:activity/fade_out")
    .setNavHidden(false)
    // setLightColor(true) 表示「浅色状态栏图标」，配白底会让文字看不见。
    // 改为 setStatusBarUIFlag 强制深色图标（SYSTEM_UI_FLAG_LIGHT_STATUS_BAR），文字才能显示。
    .setLightColor(false)
    .setStatusBarUIFlag(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR)
    .setNavColor(Color.WHITE)
    .setStatusBarColor(Color.WHITE)
    .setNavReturnImgDrawable(makeBackArrowDrawable(gray1))
    .setLogoHidden(true)
    // 掩码手机号 32dp semibold #1A1A1A
    .setNumberColor(gray1)
    .setNumberSizeDp(32)
    // slogan 不自定义文案，让 SDK 按当前 SIM 卡显示「中国xx提供认证服务」
    .setSloganTextColor(gray9)
    .setSloganTextSizeDp(14)
    // 一键登录主按钮
    .setLogBtnText("一键登录")
    .setLogBtnTextSizeDp(14)
    .setLogBtnHeight(42)
    .setLogBtnMarginLeftAndRight(loginButtonMargin)
    .setLogBtnBackgroundDrawable(loginButton)
    // 「验证码或密码登录」：12dp #999999，点击后切到密码/验证码登录界面
    .setSwitchAccHidden(false)
    .setSwitchAccText("验证码或密码登录")
    .setSwitchAccTextColor(gray3)
    .setSwitchAccTextSizeDp(12)
    // 协议：默认勾选 false
    .setPrivacyState(false)
    .setPrivacyBefore("已阅读并同意")
    // 运营商协议是 SDK 内置占位符（点击会跳到对应运营商页面），
    // 通过 vendorPrivacyPrefix/Suffix 控制显示文字
    .setVendorPrivacyPrefix("《运营商协议》")
    .setVendorPrivacySuffix("")
    // 我们自己的协议放 privacyOne/Two
    .setAppPrivacyOne("《用户协议》", USER_AGREEMENT_URL)
    .setAppPrivacyTwo("《隐私政策》", PRIVACY_POLICY_URL)
    .setAppPrivacyColor(gray9, linkBlue)
    // 协议 WebView 的安全区：导航栏 + 状态栏都用白色，避免顶部被状态栏遮挡
    .setWebViewStatusBarColor(Color.WHITE)
    .setWebNavColor(Color.WHITE)
    .setWebNavTextColor(gray1)
    .setWebNavTextSizeDp(18)
    // 原生授权页保留协议勾选 checkbox：默认未勾选（合规要求用户主动同意）。
    // SDK 内置 privacyAlert 弹窗布局不可靠（自定义尺寸会拉伸到全屏，默认又太窄），
    // 这里关闭它，未勾选时让 SDK 走失败回调，原生模块再弹自己的 AlertDialog。
    .setPrivacyState(false)
    .setCheckboxHidden(false)
    .setPrivacyAlertIsNeedShow(false)
    .setPrivacyAlertIsNeedAutoLogin(false)
    .create()
  }

  /// 24×24 黑色左箭头 Drawable，与二级页面 ChevronLeft24Regular 视觉一致。
  private fun makeBackArrowDrawable(color: Int): BitmapDrawable {
    val density = appContext.reactContext?.resources?.displayMetrics?.density ?: 1f
    val size = (24f * density).toInt().coerceAtLeast(24)
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val stroke = 1.75f * density
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      this.color = color
      style = Paint.Style.STROKE
      strokeWidth = stroke
      strokeCap = Paint.Cap.ROUND
      strokeJoin = Paint.Join.ROUND
    }
    // 中心箭头朝左：M15.5 4.5 L8 12 L15.5 19.5（24 视口坐标）
    val scale = size / 24f
    val path = Path().apply {
      moveTo(15.5f * scale, 4.5f * scale)
      lineTo(8f * scale, 12f * scale)
      lineTo(15.5f * scale, 19.5f * scale)
    }
    canvas.drawPath(path, paint)
    val resources = appContext.reactContext?.resources
    return BitmapDrawable(resources, bitmap)
  }

  private fun parseResult(result: String): TokenRet? = try {
    TokenRet.fromJson(result)
  } catch (error: Exception) {
    Log.w(TAG, "[DEBUG-QUICK-LOGIN] SDK returned an unreadable response", error)
    null
  }

  private fun resultCode(result: String): String = parseResult(result)?.code ?: "unknown"

  private fun resultMessage(result: String): String = try {
    JSONObject(result).optString("msg").take(200)
  } catch (_: Exception) {
    ""
  }
}
