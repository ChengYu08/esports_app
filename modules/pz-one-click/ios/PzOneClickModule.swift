import ATAuthSDK
import CoreText
import ExpoModulesCore
import UIKit

private let quickLoginTag = "[DEBUG-QUICK-LOGIN]"
#if DEBUG
private let protocolBaseURL = "https://djpc.yingbowl.com"
#else
private let protocolBaseURL = "https://djpc.jlgkj.top"
#endif
// 协议编码按平台追加 `_ios` 后缀，与 RN 侧 links.ts 的 protocolCode 规则一致（后台按平台区分协议内容）
private let userAgreementURL = "\(protocolBaseURL)/public/protocols?code=user_server_ios"
private let privacyPolicyURL = "\(protocolBaseURL)/public/protocols?code=user_privacy_ios"

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

        var didFinish = false
        // 返回键、「暂不登录，先去逛逛」是 customViewBlock 自绘控件，不在 SDK 控件体系内，
        // 点击时直接按对应取消语义结束本次授权请求（与 SDK 取消码 700000/700001 的分叉一致）。
        let authPageSize = controller.view.window?.bounds.size ?? controller.view.bounds.size
        let model = self.makeAuthPageModel(
          screenSize: authPageSize,
          onUserExit: {
            guard !didFinish else { return }
            didFinish = true
            NSLog("\(quickLoginTag) iOS authorization cancelled via custom exit entry")
            self.sendEvent("onStateChange", ["state": "cancelled"])
            self.authHandler.cancelLoginVC(animated: true, complete: nil)
            promise.reject("USER_EXITED", "一键登录失败，请使用其他登录方式")
          },
          onUserSwitch: {
            guard !didFinish else { return }
            didFinish = true
            NSLog("\(quickLoginTag) iOS authorization cancelled via verification-code entry")
            self.sendEvent("onStateChange", ["state": "cancelled"])
            self.authHandler.cancelLoginVC(animated: true, complete: nil)
            promise.reject("USER_SWITCHED", "一键登录失败，请使用其他登录方式")
          }
        )
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

  /// Figma 授权页设计稿（375x812 基准）的内容纵坐标，均相对屏幕顶部：
  /// 顶部背景图 208pt 高（卡片上叠 12pt），卡片内 padding-top 64，
  /// slogan → 间距 12 → 号码 → 间距 56 → 登录按钮（高 42）。
  private static let sloganScreenTopY: CGFloat = 260
  private static let numberScreenTopY: CGFloat = 294
  private static let loginScreenTopY: CGFloat = 388
  private static let authNavHeight: CGFloat = 44

  /// 自绘控件的 tag，customViewLayoutBlock 里按 tag 取回设置 frame
  private static let skipBtnTag = 902
  private static let otherWayTag = 903

  /// MiSans Bold（Figma 号码栏字体，Fontmin 子集只含号码所需字符），注册一次进程内复用
  private static let miSansNumberFont: UIFont? = {
    guard let url = Bundle.main.url(forResource: "pz_misans_bold", withExtension: "ttf") else {
      NSLog("\(quickLoginTag) MiSans font resource not found in main bundle")
      return nil
    }
    // process 域重复注册会返回 false，忽略后直接取字体即可
    CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
    return UIFont(name: "MiSans-Bold", size: 32)
  }()

  private func makeAuthPageModel(
    screenSize: CGSize,
    onUserExit: @escaping () -> Void,
    onUserSwitch: @escaping () -> Void
  ) -> TXCustomModel {
    // Figma 设计稿颜色常量
    let brandPrimary = UIColor(red: 254.0 / 255, green: 31.0 / 255, blue: 76.0 / 255, alpha: 1) // #FE1F4C
    let gray1 = UIColor(red: 26.0 / 255, green: 26.0 / 255, blue: 26.0 / 255, alpha: 1)         // #1A1A1A
    let gray3 = UIColor(red: 153.0 / 255, green: 153.0 / 255, blue: 153.0 / 255, alpha: 1)     // #999999
    let gray9 = UIColor(red: 128.0 / 255, green: 128.0 / 255, blue: 128.0 / 255, alpha: 1)     // #808080
    let gray10 = UIColor(red: 102.0 / 255, green: 102.0 / 255, blue: 102.0 / 255, alpha: 1)    // #666666
    let gray11 = UIColor(red: 51.0 / 255, green: 51.0 / 255, blue: 51.0 / 255, alpha: 1)       // #333333
    let grayBorder = UIColor(red: 235.0 / 255, green: 235.0 / 255, blue: 235.0 / 255, alpha: 1) // #EBEBEB
    let linkBlue = UIColor(red: 27.0 / 255, green: 106.0 / 255, blue: 224.0 / 255, alpha: 1)   // #1B6AE0
    let authBodyTop = Self.currentStatusBarHeight() + Self.authNavHeight

    let model = TXCustomModel()
    // 授权页进出不做动画：退出时 RN 侧会立即盖一层全屏加载遮罩，
    // SDK 默认的 present/dismiss 动画会和遮罩淡入打架，看起来像闪回登录页。
    model.animationDuration = 0
    model.navIsHidden = false
    model.prefersStatusBarHidden = false
    // 顶部图作为整页背景绘制，导航栏只承载返回按钮并透明悬浮，不占图片布局高度。
    model.navColor = .clear
    model.navBackImage = Self.makeBackArrowImage(color: gray1)
    // Figma 导航栏无标题（返回箭头 + 空白）
    model.navTitle = NSAttributedString(string: "")
    model.backgroundColor = .white
    if let backgroundImage = Self.makeAuthPageBackground(screenSize: screenSize) {
      model.backgroundImage = backgroundImage
    }
    model.backgroundImageContentMode = .scaleToFill
    model.logoIsHidden = true

    // slogan：「中国xx提供认证服务」，按当前 SIM 运营商生成文案
    let carrier = TXCommonUtils.getCurrentCarrierName() ?? ""
    let centered = NSMutableParagraphStyle()
    centered.alignment = .center
    model.sloganText = NSAttributedString(
      string: carrier.isEmpty ? "运营商提供认证服务" : "\(carrier)提供认证服务",
      attributes: [
        .foregroundColor: gray9,
        .font: UIFont.systemFont(ofSize: 14),
        .paragraphStyle: centered,
      ]
    )
    model.sloganFrameBlock = { _, _, frame in
      CGRect(
        x: frame.minX,
        y: Self.sloganScreenTopY - authBodyTop,
        width: frame.width,
        height: frame.height
      )
    }

    // 号码：MiSans Bold 32pt，加载失败退回系统字体
    model.numberColor = gray1
    model.numberFont = Self.miSansNumberFont ?? .systemFont(ofSize: 32, weight: .semibold)
    model.numberFrameBlock = { _, _, frame in
      CGRect(
        x: frame.minX,
        y: Self.numberScreenTopY - authBodyTop,
        width: frame.width,
        height: frame.height
      )
    }

    // 登录按钮：高 42、圆角 8、左右边距 32
    model.loginBtnText = NSAttributedString(
      string: "一键登录",
      attributes: [
        .foregroundColor: UIColor.white,
        .font: UIFont.systemFont(ofSize: 14, weight: .semibold),
      ]
    )
    let buttonImage = UIGraphicsImageRenderer(size: CGSize(width: 16, height: 42)).image { _ in
      let path = UIBezierPath(roundedRect: CGRect(x: 0, y: 0, width: 16, height: 42), cornerRadius: 8)
      brandPrimary.setFill()
      path.fill()
    }.resizableImage(withCapInsets: UIEdgeInsets(top: 0, left: 8, bottom: 0, right: 8), resizingMode: .stretch)
    model.loginBtnBgImgs = [buttonImage, buttonImage, buttonImage]
    model.loginBtnFrameBlock = { screenSize, _, _ in
      CGRect(
        x: 32,
        y: Self.loginScreenTopY - authBodyTop,
        width: screenSize.width - 64,
        height: 42
      )
    }

    // 自绘控件：「暂不登录，先去逛逛」、底部「验证码」切换入口。
    // frame 在 customViewLayoutBlock 里参照 SDK 给出的 loginFrame/privacyFrame 定位。
    final class CustomViewBox {
      weak var skipBtn: UIControl?
      weak var otherWay: UIControl?
    }
    let box = CustomViewBox()
    model.customViewBlock = { superView in
      let skipBtn = UIButton(type: .system)
      skipBtn.tag = Self.skipBtnTag
      skipBtn.setTitle("暂不登录，先去逛逛", for: .normal)
      skipBtn.setTitleColor(gray3, for: .normal)
      skipBtn.titleLabel?.font = .systemFont(ofSize: 12)
      skipBtn.addAction(UIAction(handler: { _ in onUserExit() }), for: .touchUpInside)
      superView.addSubview(skipBtn)
      box.skipBtn = skipBtn

      var config = UIButton.Configuration.plain()
      config.image = Self.resizeImage(
        UIImage(named: "pz_login_other_way"),
        to: CGSize(width: 40, height: 40)
      )
      config.imagePlacement = .top
      config.imagePadding = 8
      config.baseForegroundColor = gray9
      var title = AttributedString("验证码")
      title.font = .systemFont(ofSize: 12)
      config.attributedTitle = title
      config.contentInsets = .zero
      let otherWay = UIButton(configuration: config)
      otherWay.tag = Self.otherWayTag
      otherWay.addAction(UIAction(handler: { _ in onUserSwitch() }), for: .touchUpInside)
      superView.addSubview(otherWay)
      box.otherWay = otherWay
    }
    model.customViewLayoutBlock = { screenSize, _, _, _, _, _, _, loginFrame, _, privacyFrame in
      box.skipBtn?.frame = CGRect(x: 0, y: loginFrame.maxY + 16, width: screenSize.width, height: 20)
      // 「验证码」入口：图标 40 + 间距 8 + 文字 18，整组在协议区上方 40pt
      let otherWaySize = CGSize(width: 64, height: 66)
      box.otherWay?.frame = CGRect(
        x: (screenSize.width - otherWaySize.width) / 2,
        y: privacyFrame.minY - 40 - otherWaySize.height,
        width: otherWaySize.width,
        height: otherWaySize.height
      )
    }

    // 协议：checkbox 16pt 默认未勾选，文案带「未注册用户在登录成功后自动创建账号」后缀
    model.privacyPreText = "已阅读并同意"
    model.privacySufText = "，未注册用户在登录成功后自动创建账号(未满18周岁用户禁止注册使用)"
    // 运营商协议走 SDK 内置占位符（点击跳到对应运营商官方页面），
    // 不要占用 privacyOne/Two/Three —— 那些槽位塞运营商协议会被 SDK 用自家 URL 覆盖，导致点击不生效
    model.privacyOperatorPreText = "《运营商协议》"
    model.privacyOperatorSufText = ""
    model.privacyOperatorColor = linkBlue
    model.privacyOne = ["《用户协议》", userAgreementURL]
    model.privacyTwo = ["《隐私政策》", privacyPolicyURL]
    model.privacyColors = [gray9, linkBlue]
    model.privacyFont = .systemFont(ofSize: 12)
    model.checkBoxIsChecked = false
    model.checkBoxIsHidden = false
    // checkBoxWH 默认 0，SDK 头文件要求"必须大于0"，不设置会渲染成零尺寸导致勾选框不可见
    model.checkBoxWH = 16
    model.checkBoxImages = [Self.makeCheckboxImage(checked: false), Self.makeCheckboxImage(checked: true)]
    // 新增未成年人提示后协议会多一行，主动预留三行高度，避免 SDK 按旧文案高度贴底后裁掉内容。
    // 协议区距底部增加到 102pt，避免文案贴近底部；左右仍为 32pt。
    model.privacyFrameBlock = { _, superViewSize, _ in
      let privacyHeight: CGFloat = 54
      let privacyBottomSpacing: CGFloat = 102
      return CGRect(
        x: 32,
        y: superViewSize.height - privacyBottomSpacing - privacyHeight,
        width: superViewSize.width - 64,
        height: privacyHeight
      )
    }

    // 二次协议弹窗（Figma：白底 12pt 圆角，标题 16 #333，正文 14 #666，
    // 双按钮「不同意」白描边 /「同意协议并继续」红底，高 36 圆角 8，蒙层 60%）
    model.privacyAlertIsNeedShow = true
    model.privacyAlertIsNeedAutoLogin = true
    model.privacyAlertTitleContent = "阅读并同意以下协议"
    model.privacyAlertTitleFont = .systemFont(ofSize: 16, weight: .semibold)
    model.privacyAlertTitleColor = gray11
    model.privacyAlertContentFont = .systemFont(ofSize: 14)
    model.privacyAlertLineSpaceDp = 5
    model.privacyAlertContentColors = [gray10, linkBlue]
    model.privacyAlertOperatorColor = linkBlue
    model.privacyAlertOneColor = linkBlue
    model.privacyAlertTwoColor = linkBlue
    model.privacyAlertContentAlignment = .left
    model.privacyAlertPreText = "已阅读并同意"
    model.privacyAlertSufText = "，未注册用户在登录成功后自动创建账号(未满18周岁用户禁止注册使用)"
    // SDK 自带单个确认按钮，把它定位到右半边充当「同意协议并继续」，
    // 左半边的「不同意」用 customViewBlock 自绘，点击只关弹窗不继续登录
    model.privacyAlertBtnContent = "同意协议并继续"
    model.privacyAlertButtonFont = .systemFont(ofSize: 14, weight: .semibold)
    // buttonTextColors 需要 [normal, highlighted]，单个会被 SDK 越界读取
    model.privacyAlertButtonTextColors = [UIColor.white, UIColor.white]
    let alertBtnImage = UIGraphicsImageRenderer(size: CGSize(width: 16, height: 36)).image { _ in
      let path = UIBezierPath(roundedRect: CGRect(x: 0, y: 0, width: 16, height: 36), cornerRadius: 8)
      brandPrimary.setFill()
      path.fill()
    }.resizableImage(withCapInsets: UIEdgeInsets(top: 8, left: 8, bottom: 8, right: 8), resizingMode: .stretch)
    model.privacyAlertBtnBackgroundImages = [alertBtnImage, alertBtnImage, alertBtnImage]
    model.privacyAlertBtnCornerRadius = 8
    // 新增未成年人提示后正文会多一行，弹窗与正文区同步增高，给按钮保留独立空间。
    model.privacyAlertFrameBlock = { _, superViewSize, _ in
      let width = min(295, superViewSize.width - 32)
      let height: CGFloat = 196
      return CGRect(
        x: (superViewSize.width - width) / 2,
        y: (superViewSize.height - height) / 2,
        width: width,
        height: height
      )
    }
    model.privacyAlertTitleFrameBlock = { _, superViewSize, _ in
      CGRect(x: 16, y: 16, width: superViewSize.width - 32, height: 24)
    }
    model.privacyAlertPrivacyContentFrameBlock = { _, superViewSize, _ in
      CGRect(x: 16, y: 52, width: superViewSize.width - 32, height: 88)
    }
    // 按钮行：左按钮 86、间距 12、右按钮占满剩余宽度，距底部 16。
    model.privacyAlertButtonFrameBlock = { _, superViewSize, _ in
      CGRect(x: 114, y: superViewSize.height - 52, width: superViewSize.width - 130, height: 36)
    }
    // 弹窗四角圆角 [左上, 左下, 右下, 右上]
    model.privacyAlertCornerRadiusArray = [NSNumber(value: 12), NSNumber(value: 12), NSNumber(value: 12), NSNumber(value: 12)]
    model.privacyAlertCloseButtonIsNeedShow = false
    model.tapPrivacyAlertMaskCloseAlert = false
    model.privacyAlertMaskAlpha = 0.6
    final class AlertViewBox {
      weak var disagree: UIControl?
    }
    let alertBox = AlertViewBox()
    model.privacyAlertCustomViewBlock = { superAlertView in
      let disagree = UIButton(type: .system)
      disagree.setTitle("不同意", for: .normal)
      disagree.setTitleColor(gray11, for: .normal)
      disagree.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
      disagree.layer.borderColor = grayBorder.cgColor
      disagree.layer.borderWidth = 1
      disagree.layer.cornerRadius = 8
      disagree.addAction(
        UIAction(handler: { _ in TXCommonHandler.sharedInstance().closePrivactAlertView() }),
        for: .touchUpInside
      )
      superAlertView.addSubview(disagree)
      alertBox.disagree = disagree
    }
    model.privacyAlertCustomViewLayoutBlock = { _, _, _, buttonFrame, _ in
      alertBox.disagree?.frame = CGRect(x: 16, y: buttonFrame.minY, width: 86, height: buttonFrame.height)
    }

    // 协议 WebView 的安全区：白底 + 深色返回箭头 + 黑色标题，与一键登录页保持一致
    model.privacyNavColor = .white
    model.privacyNavTitleColor = gray1
    model.privacyNavTitleFont = .systemFont(ofSize: 18, weight: .semibold)
    model.privacyNavBackImage = Self.makeBackArrowImage(color: gray1)
    // SDK 仅一个切换入口，已改用自绘「验证码」入口，隐藏内置 changeBtn
    model.changeBtnIsHidden = true
    return model
  }

  /// 勾选框图片：16pt 圆形，未勾选灰描边，勾选品牌红底 + 白色对勾（与 Figma Checkbox/Small-16 一致）。
  private static func makeCheckboxImage(checked: Bool) -> UIImage {
    let brandPrimary = UIColor(red: 254.0 / 255, green: 31.0 / 255, blue: 76.0 / 255, alpha: 1)
    let uncheckedBorder = UIColor(red: 204.0 / 255, green: 204.0 / 255, blue: 204.0 / 255, alpha: 1) // #CCCCCC
    let size = CGSize(width: 16, height: 16)
    let renderer = UIGraphicsImageRenderer(size: size)
    return renderer.image { _ in
      let rect = CGRect(x: 1, y: 1, width: 14, height: 14)
      let circle = UIBezierPath(ovalIn: rect)
      if checked {
        brandPrimary.setFill()
        circle.fill()
        let check = UIBezierPath()
        // 对勾（16 视口坐标）
        check.move(to: CGPoint(x: 4.5, y: 8.5))
        check.addLine(to: CGPoint(x: 7, y: 11))
        check.addLine(to: CGPoint(x: 11.8, y: 5.2))
        check.lineWidth = 1.6
        check.lineCapStyle = .round
        check.lineJoinStyle = .round
        UIColor.white.setStroke()
        check.stroke()
      } else {
        circle.lineWidth = 1
        uncheckedBorder.setStroke()
        circle.stroke()
      }
    }
  }

  /// 将无 @3x 后缀的位图按设计稿 pt 尺寸重绘，避免 UIKit 把 120px 当成 120pt。
  private static func resizeImage(_ image: UIImage?, to size: CGSize) -> UIImage? {
    guard let image else {
      return nil
    }
    let renderer = UIGraphicsImageRenderer(size: size)
    return renderer.image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
  }

  /// 将顶部装饰图和白色圆角内容区合成整页背景，避免 SDK 导航栏下方的自绘容器裁剪图片。
  private static func makeAuthPageBackground(screenSize: CGSize) -> UIImage? {
    guard screenSize.width > 0,
          screenSize.height > 0,
          let topImage = UIImage(named: "pz_login_top_bg") else {
      return nil
    }

    let topHeight = screenSize.width * 208.0 / 375.0
    let cardTop = screenSize.width * 196.0 / 375.0
    let renderer = UIGraphicsImageRenderer(size: screenSize)
    return renderer.image { _ in
      UIColor.white.setFill()
      UIRectFill(CGRect(origin: .zero, size: screenSize))
      topImage.draw(in: CGRect(x: 0, y: 0, width: screenSize.width, height: topHeight))

      let cardRect = CGRect(
        x: 0,
        y: cardTop,
        width: screenSize.width,
        height: screenSize.height - cardTop
      )
      let cardPath = UIBezierPath(
        roundedRect: cardRect,
        byRoundingCorners: [.topLeft, .topRight],
        cornerRadii: CGSize(width: 12, height: 12)
      )
      UIColor.white.setFill()
      cardPath.fill()
    }
  }

  /// SDK 的主体坐标从导航栏底部开始，设计稿坐标从屏幕顶部开始。
  private static func currentStatusBarHeight() -> CGFloat {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    for scene in scenes where scene.activationState == .foregroundActive {
      if let height = scene.statusBarManager?.statusBarFrame.height, height > 0 {
        return height
      }
    }
    return 44
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
