Pod::Spec.new do |s|
  s.name           = 'PzOneClick'
  s.version        = '1.0.0'
  s.summary        = 'Aliyun one-click phone authentication for Expo'
  s.description    = 'Native iOS bridge for Aliyun phone number authentication.'
  s.author         = '盼之电竞'
  s.homepage       = 'https://www.luanfengxuan.cn'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.vendored_frameworks = [
    'Vendor/ATAuthSDK.xcframework',
    'Vendor/YTXMonitor.xcframework',
    'Vendor/YTXOperators.xcframework',
  ]

  # ATAuthSDK 是静态库，framework 内嵌的 ATAuthSDK.bundle（默认 checkbox、弹窗关闭按钮等 icon）
  # 不会被 CocoaPods 自动拷进 app 包，必须显式声明为资源，否则授权页默认图片不显示
  # Resources/pz_login_top_bg.png 是 Figma 授权页顶部背景装饰图（白底 + 吉祥物角色）
  s.resources = [
    'Vendor/ATAuthSDK.xcframework/ios-arm64/ATAuthSDK.framework/ATAuthSDK.bundle',
    'Resources/*',
  ]
  s.frameworks = 'UIKit', 'Foundation', 'Security', 'SystemConfiguration'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'OTHER_LDFLAGS' => '-ObjC',
  }

  # Keep vendored framework headers out of the pod's source glob. Including
  # Vendor/**/*.h here makes CocoaPods expose the same SDK headers both from
  # the source tree and from the copied XCFrameworks, which causes duplicate
  # Objective-C declarations during Swift Release archives.
  s.source_files = 'PzOneClickModule.swift'
end
