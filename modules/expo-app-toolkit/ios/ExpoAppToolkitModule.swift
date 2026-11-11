import ExpoModulesCore
import UIKit
import UserNotifications

public class ExpoAppToolkitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoAppToolkit")

    // 与 Android 保持桥接契约一致，避免隐私同意后调用缺失方法中断启动流程
    Function("markPrivacyConsentAccepted") {
      UserDefaults.standard.set(true, forKey: "privacyConsentAccepted")
    }

    // 读取 AppDelegate 在推送点击/冷启动时暂存的融云推送数据（plugins/withRongCloudIosPush.js 写入）
    AsyncFunction("getPendingPushClick") { () -> [String: String]? in
      UserDefaults.standard.dictionary(forKey: "rongPushPendingClick") as? [String: String]
    }

    AsyncFunction("clearPendingPushClick") {
      UserDefaults.standard.removeObject(forKey: "rongPushPendingClick")
    }

    Function("clearAppIconBadge") {
      DispatchQueue.main.async {
        if #available(iOS 16.0, *) {
          UNUserNotificationCenter.current().setBadgeCount(0)
        } else {
          UIApplication.shared.applicationIconBadgeNumber = 0
        }
      }
    }
  }
}
