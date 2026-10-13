package expo.modules.pz.oneclick

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.Log
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
private const val USER_AGREEMENT_URL = "https://www.luanfengxuan.cn/vpi/pages/pzdj_user"
private const val PRIVACY_POLICY_URL = "https://www.luanfengxuan.cn/vpi/pages/pzdj_privacy"

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
        override fun onTokenSuccess(result: String) {
          val code = resultCode(result)
          val available = code == ResultCode.CODE_SUCCESS
          Log.i(TAG, "[DEBUG-QUICK-LOGIN] environment check completed: code=$code, available=$available")
          sendEvent("onStateChange", mapOf("state" to if (available) "available" else "unavailable"))
          promise.resolve(available)
        }

        override fun onTokenFailed(result: String) {
          val code = resultCode(result)
          val message = resultMessage(result)
          Log.w(TAG, "[DEBUG-QUICK-LOGIN] environment check failed: code=$code, message=$message")
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
        override fun onTokenSuccess(result: String) {
          val tokenRet = parseResult(result)
          val code = tokenRet?.code ?: "unknown"
          if (code == ResultCode.CODE_START_AUTHPAGE_SUCCESS) {
            Log.i(TAG, "[DEBUG-QUICK-LOGIN] authorization page presented")
            return
          }
          if (code == ResultCode.CODE_SUCCESS && !tokenRet?.token.isNullOrBlank()) {
            val spToken = tokenRet?.token.orEmpty()
            Log.i(TAG, "[DEBUG-QUICK-LOGIN] carrier authorization succeeded")
            authHelper?.setAuthListener(null)
            authHelper?.quitLoginPage()
            promise.resolve(mapOf("spToken" to spToken))
            return
          }
          Log.w(TAG, "[DEBUG-QUICK-LOGIN] unexpected authorization response: code=$code")
          authHelper?.setAuthListener(null)
          promise.reject("AUTHORIZATION_FAILED", "一键登录没有返回有效授权结果", null)
        }

        override fun onTokenFailed(result: String) {
          val code = resultCode(result)
          val cancelled = code == ResultCode.CODE_ERROR_USER_CANCEL || code == ResultCode.CODE_ERROR_USER_SWITCH
          Log.i(TAG, "[DEBUG-QUICK-LOGIN] authorization ended: code=$code, cancelled=$cancelled")
          authHelper?.setAuthListener(null)
          sendEvent("onStateChange", mapOf("state" to if (cancelled) "cancelled" else "unavailable"))
          promise.reject(if (cancelled) "USER_CANCELLED" else "AUTHORIZATION_FAILED", "一键登录失败，请使用其他登录方式", null)
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
    val loginButton = GradientDrawable().apply {
      setColor(Color.rgb(224, 27, 40))
      cornerRadius = 8f * density
    }
    return com.mobile.auth.gatewayauth.AuthUIConfig.Builder()
    .setNavHidden(false)
    .setLightColor(true)
    .setNavColor(Color.rgb(255, 229, 231))
    .setStatusBarColor(Color.rgb(255, 229, 231))
    .setLogoHidden(true)
    .setLogBtnText("一键登录")
    .setLogBtnTextSizeDp(14)
    .setLogBtnHeight(42)
    .setLogBtnBackgroundDrawable(loginButton)
    .setNumberColor(Color.rgb(26, 26, 26))
    .setPrivacyBefore("已阅读并同意")
    .setAppPrivacyOne("《用户协议》", USER_AGREEMENT_URL)
    .setAppPrivacyTwo("《隐私政策》", PRIVACY_POLICY_URL)
    .setAppPrivacyColor(Color.rgb(128, 128, 128), Color.rgb(27, 106, 224))
    .create()
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
