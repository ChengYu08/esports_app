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

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
