package expo.modules.pz.oneclick

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PzOneClickModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PzOneClick")

    Events("onChange")

    AsyncFunction("setValueAsync") { value: String ->
      sendEvent("onChange", mapOf(
        "value" to value
      ))
    }
  }
}
