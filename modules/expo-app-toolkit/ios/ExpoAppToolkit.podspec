Pod::Spec.new do |s|
  s.name           = 'ExpoAppToolkit'
  s.version        = '1.0.0'
  s.summary        = 'App toolkit for esports app (push click handoff, misc helpers)'
  s.description    = 'Exposes pending RongCloud push tap data stored in UserDefaults by AppDelegate so JS can navigate to the tapped conversation.'
  s.author         = '盼之电竞'
  s.homepage        = 'https://www.luanfengxuan.cn'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = 'ExpoAppToolkitModule.swift'
end
