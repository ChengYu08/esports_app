import ATAuthSDK
import ExpoModulesCore
import UIKit

private let quickLoginTag = "[DEBUG-QUICK-LOGIN]"
private let userAgreementURL = "https://djpc.jlgkj.top/user.html"
private let privacyPolicyURL = "https://djpc.jlgkj.top/privacy.html"

public class PzOneClickModule: Module {
  private let authHandler = TXCommonHandler.sharedInstance()

  public func definition() -> ModuleDefinition {
    Name("PzOneClick")
    Events("onStateChange")

    AsyncFunction("checkLoginAvailableAsync") { (_: [String: String], authSDKKey: String, promise: Promise) in
      guard !authSDKKey.isEmpty else {
        NSLog("\(quickLoginTag) iOS SDK key is not configured")
        self.sendEvent("onStateChange", ["state": "unavailable"])
        promise.resolve(false)
        return
      }

      self.sendEvent("onStateChange", ["state": "checking"])
      self.authHandler.setAuthSDKInfo(authSDKKey) { initResult in
        let initCode = self.resultCode(initResult)
        guard initCode == "600000" else {
          NSLog("\(quickLoginTag) iOS SDK initialization failed: code=\(initCode)")
          self.sendEvent("onStateChange", ["state": "unavailable"])
          promise.resolve(false)
          return
        }

        self.authHandler.checkEnvAvailable(withAuthType: .loginToken, complete: { result in
          let code = self.resultCode(result)
          let available = code == "600000"
          NSLog("\(quickLoginTag) iOS environment check completed: code=\(code), available=\(available)")
          self.sendEvent("onStateChange", ["state": available ? "available" : "unavailable"])
          promise.resolve(available)
        })
      }
    }.runOnQueue(DispatchQueue.main)

    AsyncFunction("authorizeAsync") { (_: [String: String], authSDKKey: String, promise: Promise) in
      guard !authSDKKey.isEmpty else {
        promise.reject("MISSING_AUTH_KEY", "未配置阿里云号码认证 iOS key")
        return
      }
      guard let controller = self.appContext?.utilities?.currentViewController() else {
        promise.reject("NO_VIEW_CONTROLLER", "一键登录需要在前台页面中调用")
        return
      }

      self.sendEvent("onStateChange", ["state": "authorizing"])
      self.authHandler.setAuthSDKInfo(authSDKKey) { initResult in
        let initCode = self.resultCode(initResult)
        guard initCode == "600000" else {
          NSLog("\(quickLoginTag) iOS SDK initialization failed before authorization: code=\(initCode)")
          self.sendEvent("onStateChange", ["state": "unavailable"])
          promise.reject("SDK_INIT_FAILED", "阿里云号码认证 SDK 初始化失败")
          return
        }

        let model = self.makeAuthPageModel()
        self.authHandler.getLoginToken(withTimeout: 8, controller: controller, model: model) { result in
          let code = self.resultCode(result)
          if code == "600001" {
            NSLog("\(quickLoginTag) iOS authorization page presented")
            return
          }
          if code == "600000", let spToken = result["token"] as? String, !spToken.isEmpty {
            NSLog("\(quickLoginTag) iOS carrier authorization succeeded")
            self.authHandler.cancelLoginVCAnimated(true, complete: nil)
            promise.resolve(["spToken": spToken])
            return
          }

          let cancelled = code == "700000" || code == "700001" || code == "700020"
          NSLog("\(quickLoginTag) iOS authorization ended: code=\(code), cancelled=\(cancelled)")
          self.sendEvent("onStateChange", ["state": cancelled ? "cancelled" : "unavailable"])
          self.authHandler.cancelLoginVCAnimated(true, complete: nil)
          promise.reject(cancelled ? "USER_CANCELLED" : "AUTHORIZATION_FAILED", "一键登录失败，请使用其他登录方式")
        }
      }
    }.runOnQueue(DispatchQueue.main)

    AsyncFunction("cancelAsync") { (promise: Promise) in
      self.authHandler.cancelLoginVCAnimated(true) {
        self.sendEvent("onStateChange", ["state": "cancelled"])
      }
      promise.resolve(nil)
    }.runOnQueue(DispatchQueue.main)
  }

  private func resultCode(_ result: [AnyHashable: Any]?) -> String {
    return result?["resultCode"] as? String ?? "unknown"
  }

  private func makeAuthPageModel() -> TXCustomModel {
    let model = TXCustomModel()
    model.navIsHidden = false
    model.prefersStatusBarHidden = false
    model.backgroundColor = .white
    model.logoIsHidden = true
    model.numberColor = UIColor(red: 26.0 / 255, green: 26.0 / 255, blue: 26.0 / 255, alpha: 1)
    model.numberFont = .systemFont(ofSize: 32, weight: .semibold)
    model.sloganText = NSAttributedString(
      string: "中国电信提供认证服务",
      attributes: [.foregroundColor: UIColor(red: 128.0 / 255, green: 128.0 / 255, blue: 128.0 / 255, alpha: 1), .font: UIFont.systemFont(ofSize: 14)]
    )
    model.loginBtnText = NSAttributedString(
      string: "一键登录",
      attributes: [.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 14, weight: .semibold)]
    )
    let buttonImage = UIGraphicsImageRenderer(size: CGSize(width: 1, height: 1)).image { context in
      UIColor(red: 224.0 / 255, green: 27.0 / 255, blue: 40.0 / 255, alpha: 1).setFill()
      context.fill(CGRect(x: 0, y: 0, width: 1, height: 1))
    }
    model.loginBtnBgImgs = [buttonImage, buttonImage, buttonImage]
    model.privacyPreText = "已阅读并同意"
    model.privacyOne = ["《用户协议》", userAgreementURL]
    model.privacyTwo = ["《隐私政策》", privacyPolicyURL]
    model.privacyColors = [
      UIColor(red: 153.0 / 255, green: 153.0 / 255, blue: 153.0 / 255, alpha: 1),
      UIColor(red: 27.0 / 255, green: 106.0 / 255, blue: 224.0 / 255, alpha: 1),
    ]
    model.checkBoxIsChecked = false
    return model
  }
}
