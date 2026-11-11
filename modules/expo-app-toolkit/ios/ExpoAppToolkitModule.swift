import ExpoModulesCore

public class ExpoAppToolkitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoAppToolkit")

    // 读取 AppDelegate 在推送点击/冷启动时暂存的融云推送数据（plugins/withRongCloudIosPush.js 写入）
    AsyncFunction("getPendingPushClick") { () -> [String: String]? in
      UserDefaults.standard.dictionary(forKey: "rongPushPendingClick") as? [String: String]
    }

    AsyncFunction("clearPendingPushClick") {
      UserDefaults.standard.removeObject(forKey: "rongPushPendingClick")
    }
  }
}
