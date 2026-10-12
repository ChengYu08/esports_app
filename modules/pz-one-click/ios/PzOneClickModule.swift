import ExpoModulesCore

public class PzOneClickModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PzOneClick")

    Events("onStateChange")

    AsyncFunction("checkLoginAvailableAsync") { (_: [String: String]) -> Bool in
      NSLog("[DEBUG-QUICK-LOGIN] availability check is a stub; carrier SDK is not integrated")
      self.sendEvent("onStateChange", ["state": "unavailable"])
      return false
    }

    AsyncFunction("authorizeAsync") { (_: [String: String]) throws -> [String: String] in
      NSLog("[DEBUG-QUICK-LOGIN] authorization requested before carrier SDK integration")
      throw NSError(domain: "PzOneClick", code: 1001, userInfo: [NSLocalizedDescriptionKey: "请先集成阿里云号码认证 iOS SDK"])
    }

    AsyncFunction("cancelAsync") {
      self.sendEvent("onStateChange", ["state": "cancelled"])
    }
  }
}
