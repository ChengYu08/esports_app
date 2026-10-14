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
