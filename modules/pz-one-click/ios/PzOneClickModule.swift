import ATAuthSDK
import ExpoModulesCore
import UIKit

private let quickLoginTag = "[DEBUG-QUICK-LOGIN]"
#if DEBUG
private let protocolBaseURL = "https://djpc.yingbowl.com"
#else
private let protocolBaseURL = "https://dj.panzhi.com"
#endif
private let userAgreementURL = "\(protocolBaseURL)/public/protocols?code=user_server"
private let privacyPolicyURL = "\(protocolBaseURL)/public/protocols?code=user_privacy"

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

        self.authHandler.checkEnvAvailable(with: .loginToken, complete: { result in
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
        var didFinish = false
        // 只有明确的终止码才结束流程：成功、用户取消，或已知失败码段。
        // 其余回调（含未来 SDK 新增的中间码）只记日志，绝不提前关页/reject。
        // 取消路径分两类，JS 侧要据此决定露出什么：
        // 700001 点「验证码或密码登录」→ 关掉授权页，露出下面的密码/验证码表单；
        // 700010/700011/700020 点返回按钮/返回键 → 退出登录页回首页。
        let switchedCodes: Set<String> = ["700001"]
        let exitedCodes: Set<String> = ["700000", "700010", "700011", "700020"]
        self.authHandler.getLoginToken(withTimeout: 8, controller: controller, model: model) { result in
          guard !didFinish else { return }
          let code = self.resultCode(result)
          if code == "600001" {
            NSLog("\(quickLoginTag) iOS authorization page presented")
            return
          }
          if code == "600000", let spToken = result["token"] as? String, !spToken.isEmpty {
            didFinish = true
            NSLog("\(quickLoginTag) iOS carrier authorization succeeded")
            self.authHandler.cancelLoginVC(animated: true, complete: nil)
            promise.resolve(["spToken": spToken])
            return
          }
          if switchedCodes.contains(code) || exitedCodes.contains(code) {
            didFinish = true
            let switched = switchedCodes.contains(code)
            NSLog("\(quickLoginTag) iOS authorization cancelled by user: code=\(code)")
            self.sendEvent("onStateChange", ["state": "cancelled"])
            self.authHandler.cancelLoginVC(animated: true, complete: nil)
            promise.reject(switched ? "USER_SWITCHED" : "USER_EXITED", "一键登录失败，请使用其他登录方式")
            return
          }
          // 明确的失败码段（6xxxxx 非 600000/600001，7xxxxx 非取消/交互码）才终止；
          // 其余中间事件码忽略，等待最终回调。
          let uiInteractionCodes: Set<String> = ["700002", "700003", "700004", "700005", "700006", "700007", "700008", "700009"]
          let isFailure =
            (code.hasPrefix("6") && code != "600000" && code != "600001")
            || (code.hasPrefix("7") && !uiInteractionCodes.contains(code))
          guard isFailure else {
            NSLog("\(quickLoginTag) iOS intermediate callback ignored: code=\(code)")
            return
          }

          didFinish = true
          NSLog("\(quickLoginTag) iOS authorization failed: code=\(code)")
          self.sendEvent("onStateChange", ["state": "unavailable"])
          self.authHandler.cancelLoginVC(animated: true, complete: nil)
          promise.reject("AUTHORIZATION_FAILED", "一键登录失败，请使用其他登录方式")
        }
      }
    }.runOnQueue(DispatchQueue.main)

    AsyncFunction("cancelAsync") { (promise: Promise) in
      self.authHandler.cancelLoginVC(animated: true, complete: {
        self.sendEvent("onStateChange", ["state": "cancelled"])
      })
      promise.resolve(nil)
    }.runOnQueue(DispatchQueue.main)
  }

  private func resultCode(_ result: [AnyHashable: Any]?) -> String {
    return result?["resultCode"] as? String ?? "unknown"
  }

  private func makeAuthPageModel() -> TXCustomModel {
    // Figma 设计稿颜色常量
    let brandPrimary = UIColor(red: 254.0 / 255, green: 31.0 / 255, blue: 76.0 / 255, alpha: 1) // #FE1F4C
    let gray1 = UIColor(red: 26.0 / 255, green: 26.0 / 255, blue: 26.0 / 255, alpha: 1)         // #1A1A1A
    let gray3 = UIColor(red: 153.0 / 255, green: 153.0 / 255, blue: 153.0 / 255, alpha: 1)      // #999999
    let gray9 = UIColor(red: 128.0 / 255, green: 128.0 / 255, blue: 128.0 / 255, alpha: 1)      // #808080
    let linkBlue = UIColor(red: 27.0 / 255, green: 106.0 / 255, blue: 224.0 / 255, alpha: 1)    // #1B6AE0

    let model = TXCustomModel()
    // 授权页进出不做动画：退出时 RN 侧会立即盖一层全屏加载遮罩，
    // SDK 默认的 present/dismiss 动画会和遮罩淡入打架，看起来像闪回登录页。
    model.animationDuration = 0
    model.navIsHidden = false
    model.prefersStatusBarHidden = false
    // 与二级页面 AppBar 一致：白底 + 深色返回箭头 + 黑色标题「一键登录」
    model.navColor = .white
    model.navBackImage = Self.makeBackArrowImage(color: gray1)
    model.navTitle = NSAttributedString(
      string: "一键登录",
      attributes: [
        .foregroundColor: gray1,
        .font: UIFont.systemFont(ofSize: 18, weight: .semibold),
      ]
    )
    model.backgroundColor = .white
    model.logoIsHidden = true
    model.numberColor = gray1
    model.numberFont = .systemFont(ofSize: 32, weight: .semibold)
    // slogan 不自定义文案，让 SDK 按当前 SIM 卡显示「中国xx提供认证服务」
    model.loginBtnText = NSAttributedString(
      string: "一键登录",
      attributes: [
        .foregroundColor: UIColor.white,
        .font: UIFont.systemFont(ofSize: 14, weight: .semibold),
      ]
    )
    // Figma 按钮：高 42、圆角 8、红 #FE1F4C
    let buttonImage = UIGraphicsImageRenderer(size: CGSize(width: 16, height: 42)).image { context in
      let path = UIBezierPath(roundedRect: CGRect(x: 0, y: 0, width: 16, height: 42), cornerRadius: 8)
      brandPrimary.setFill()
      path.fill()
      _ = context
    }.resizableImage(withCapInsets: UIEdgeInsets(top: 0, left: 8, bottom: 0, right: 8), resizingMode: .stretch)
    model.loginBtnBgImgs = [buttonImage, buttonImage, buttonImage]
    model.privacyPreText = "已阅读并同意"
    // 运营商协议走 SDK 内置占位符（点击跳到对应运营商官方页面），
    // 不要占用 privacyOne/Two/Three —— 那些槽位塞运营商协议会被 SDK 用自家 URL 覆盖，导致点击不生效
    model.privacyOperatorPreText = "《运营商协议》"
    model.privacyOperatorSufText = ""
    model.privacyOperatorColor = linkBlue
    // 我们自己的协议
    model.privacyOne = ["《用户协议》", userAgreementURL]
    model.privacyTwo = ["《隐私政策》", privacyPolicyURL]
    model.privacyColors = [gray9, linkBlue]
    // 原生授权页保留协议勾选 checkbox：默认未勾选（合规要求用户主动同意），
    // 未勾选时点击「一键登录」按钮，SDK 会弹内置 privacyAlert 弹窗提示。
    model.checkBoxIsChecked = false
    model.checkBoxIsHidden = false
    // 启用 SDK 内置弹窗：点击「同意协议并登录」后自动勾选并继续登录
    model.privacyAlertIsNeedShow = true
    model.privacyAlertIsNeedAutoLogin = true
    model.privacyAlertTitleContent = "阅读并同意以下协议"
    model.privacyAlertTitleFont = .systemFont(ofSize: 18, weight: .semibold)
    model.privacyAlertTitleColor = gray1
    model.privacyAlertContentFont = .systemFont(ofSize: 14)
    // contentColors: [正文基础色, 运营商协议, 协议1, 协议2]（与 privacyOperator + privacyOne + privacyTwo 顺序对应）
    model.privacyAlertContentColors = [gray9, linkBlue, linkBlue, linkBlue]
    model.privacyAlertPreText = "已阅读并同意"
    model.privacyAlertSufText = "，未注册用户在登录成功后自动创建账号"
    model.privacyAlertBtnContent = "同意协议并登录"
    model.privacyAlertButtonFont = .systemFont(ofSize: 14, weight: .semibold)
    // buttonTextColors 需要 [normal, highlighted]，单个会被 SDK 越界读取
    model.privacyAlertButtonTextColors = [UIColor.white, UIColor.white]
    model.privacyAlertBtnBackgroundImages = [buttonImage, buttonImage, buttonImage]
    model.privacyAlertBtnCornerRadius = 8
    // 弹窗四角圆角 [左上, 右上, 左下, 右下]
    model.privacyAlertCornerRadiusArray = [NSNumber(value: 16), NSNumber(value: 16), NSNumber(value: 16), NSNumber(value: 16)]
    model.tapPrivacyAlertMaskCloseAlert = true
    model.privacyAlertMaskAlpha = 0.5
    // SDK 内置 privacyAlert 在 frame block 自定义下会拉伸到全屏（已验证），
    // 默认窄卡片又会被标题文字撑爆。先保持默认，长期方案是关掉这个弹窗走 RN 自定义。
    // 协议 WebView 的安全区：白底 + 深色返回箭头 + 黑色标题，与一键登录页保持一致
    model.privacyNavColor = .white
    model.privacyNavTitleColor = gray1
    model.privacyNavTitleFont = .systemFont(ofSize: 18, weight: .semibold)
    model.privacyNavBackImage = Self.makeBackArrowImage(color: gray1)
    // 「验证码或密码登录」样式：12pt #999999
    model.swithText = NSAttributedString(
      string: "验证码或密码登录",
      attributes: [
        .foregroundColor: gray3,
        .font: UIFont.systemFont(ofSize: 12),
      ]
    )
    // SDK 仅一个切换入口，已用于「暂不登录」，隐藏的 changeBtn 不再重复暴露
    model.changeBtnIsHidden = true
    return model
  }

  /// 24×24 左箭头（ChevronLeft），与二级页面 `@fluentui/react-native-icons` 的 ChevronLeft24Regular 视觉一致。
  private static func makeBackArrowImage(color: UIColor) -> UIImage {
    let size = CGSize(width: 24, height: 24)
    let renderer = UIGraphicsImageRenderer(size: size)
    return renderer.image { _ in
      let path = UIBezierPath()
      // 中心在 (12, 12)，箭头朝左：M15.5 4.5 L8 12 L15.5 19.5
      path.move(to: CGPoint(x: 15.5, y: 4.5))
      path.addLine(to: CGPoint(x: 8, y: 12))
      path.addLine(to: CGPoint(x: 15.5, y: 19.5))
      path.lineWidth = 1.75
      path.lineCapStyle = .round
      path.lineJoinStyle = .round
      color.setStroke()
      path.stroke()
    }
  }
}
