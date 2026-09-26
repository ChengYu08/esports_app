package expo.modules.pz.oneclick

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PzOneClickModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PzOneClick")

    Events("onStateChange")

    AsyncFunction("checkLoginAvailableAsync") { _: Map<String, String> ->
      sendEvent("onStateChange", mapOf("state" to "unavailable"))
      false
    }

    AsyncFunction("authorizeAsync") { _: Map<String, String> ->
      throw Exception("请先集成阿里云号码认证 Android SDK")
    }

    AsyncFunction("cancelAsync") {
      sendEvent("onStateChange", mapOf("state" to "cancelled"))
    }
  }
}
