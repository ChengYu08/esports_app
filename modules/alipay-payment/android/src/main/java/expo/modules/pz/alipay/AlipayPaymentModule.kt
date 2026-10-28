package expo.modules.pz.alipay

import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import com.alipay.sdk.app.AlipayApi
import com.alipay.sdk.app.EnvUtils
import com.alipay.sdk.app.PayTask
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors

private const val RESULT_STATUS_SUCCESS = "9000"
private const val RESULT_STATUS_DEALING = "8000"
private const val RESULT_STATUS_CANCELLED = "6001"
private const val RESULT_STATUS_NETWORK = "6002"

class AlipayPaymentModule : Module() {
  private val payExecutor = Executors.newSingleThreadExecutor()
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("AlipayPayment")

    AsyncFunction("payAsync") { orderStr: String, sandbox: Boolean, promise: Promise ->
      if (orderStr.isBlank()) {
        promise.resolve(failure("INVALID_PARAM", "支付参数缺失，请重试"))
        return@AsyncFunction
      }
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(failure("NO_ACTIVITY", "支付需要在前台页面中调用"))
        return@AsyncFunction
      }
      EnvUtils.setEnv(if (sandbox) EnvUtils.EnvEnum.SANDBOX else EnvUtils.EnvEnum.ONLINE)
      // payV2 must run off the UI thread per the official integration guide.
      payExecutor.execute {
        val result = try {
          PayTask(activity).payV2(orderStr, true)
        } catch (error: Exception) {
          null
        }
        mainHandler.post {
          val status = result?.get("resultStatus")
          promise.resolve(when {
            result == null -> failure("ERROR", "支付失败:支付结果解析错误")
            TextUtils.equals(status, RESULT_STATUS_SUCCESS) ->
              mapOf("success" to true, "code" to "SUCCESS", "message" to "支付成功")
            TextUtils.equals(status, RESULT_STATUS_DEALING) ->
              failure("DEALING", "支付处理中,请稍后再订单中查看结果!")
            TextUtils.equals(status, RESULT_STATUS_CANCELLED) ->
              failure("CANCELLED", "支付取消")
            TextUtils.equals(status, RESULT_STATUS_NETWORK) ->
              failure("ERROR", "支付失败:网络连接错误")
            else -> failure("ERROR", "支付失败:支付码支付失败")
          })
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("registerAppAsync") { appId: String, promise: Promise ->
      try {
        if (appId.isNotBlank()) {
          AlipayApi.registerApp(appContext.reactContext?.applicationContext, appId)
        }
      } catch (error: Exception) {
        // registerApp is optional per the official docs; failures must not block payment.
      }
      promise.resolve(null)
    }.runOnQueue(Queues.MAIN)
  }

  private fun failure(code: String, message: String): Map<String, Any> =
    mapOf("success" to false, "code" to code, "message" to message)
}
