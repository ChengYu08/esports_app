Pod::Spec.new do |s|
  s.name           = 'VoiceRoomBackground'
  s.version        = '1.0.0'
  s.summary        = 'iOS background audio session and Now Playing for voice room'
  s.description    = 'Activates AVAudioSession and publishes MPNowPlayingInfo so the voice room keeps playing in background and shows on the Lock Screen / Control Center.'
  s.author         = '盼之电竞'
  s.homepage       = 'https://www.luanfengxuan.cn'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'MediaPlayer'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = 'VoiceRoomBackgroundModule.swift'
end
