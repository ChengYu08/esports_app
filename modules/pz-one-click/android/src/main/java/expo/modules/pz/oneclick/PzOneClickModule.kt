package expo.modules.pz.oneclick

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.util.Log

class PzOneClickModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PzOneClick")

    Events("onStateChange")

    AsyncFunction("checkLoginAvailableAsync") { _: Map<String, String> ->
      Log.w("PzOneClick", "[DEBUG-QUICK-LOGIN] availability check is a stub; carrier SDK is not integrated")
      sendEvent("onStateChange", mapOf("state" to "unavailable"))
      false
    }

    AsyncFunction("authorizeAsync") { _: Map<String, String> ->
      Log.e("PzOneClick", "[DEBUG-QUICK-LOGIN] authorization requested before carrier SDK integration")
      throwUnsupportedAuthorization()
    }

    AsyncFunction("cancelAsync") {
      sendEvent("onStateChange", mapOf("state" to "cancelled"))
    }
  }

  private fun throwUnsupportedAuthorization(): Unit {
    throw Exception("请先集成阿里云号码认证 Android SDK")
  }
}
