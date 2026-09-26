import ExpoModulesCore

public class PzOneClickModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PzOneClick")

    Events("onChange")

    AsyncFunction("setValueAsync") { (value: String) in
      self.sendEvent("onChange", [
        "value": value
      ])
    }
  }
}
