import AVFoundation
import ExpoModulesCore
import MediaPlayer
import UIKit

public class VoiceRoomBackgroundModule: Module {
  private var isSessionActive = false

  public func definition() -> ModuleDefinition {
    Name("VoiceRoomBackground")

    AsyncFunction("start") { (title: String, microphoneEnabled: Bool, promise: Promise) in
      do {
        try self.activateAudioSession()
        self.updateNowPlaying(title: title, isPlaying: true, micEnabled: microphoneEnabled)
        self.registerRemoteCommands()
        promise.resolve(nil)
      } catch {
        promise.reject("AUDIO_SESSION_FAILED", "无法激活后台音频会话: \(error.localizedDescription)")
      }
    }.runOnQueue(DispatchQueue.main)

    AsyncFunction("stop") { (promise: Promise) in
      self.clearNowPlaying()
      do {
        try self.deactivateAudioSession()
        promise.resolve(nil)
      } catch {
        promise.reject("AUDIO_SESSION_FAILED", "无法结束后台音频会话: \(error.localizedDescription)")
      }
    }.runOnQueue(DispatchQueue.main)

    AsyncFunction("updateMicrophone") { (enabled: Bool, promise: Promise) in
      var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
      let baseTitle = (info[MPMediaItemPropertyTitle] as? String)?
        .replacingOccurrences(of: "（说话中）", with: "")
        .replacingOccurrences(of: "（听筒中）", with: "") ?? "语聊房进行中"
      info[MPMediaItemPropertyTitle] = enabled ? "\(baseTitle)（说话中）" : "\(baseTitle)（听筒中）"
      MPNowPlayingInfoCenter.default().nowPlayingInfo = info
      promise.resolve(nil)
    }.runOnQueue(DispatchQueue.main)
  }

  private func activateAudioSession() throws {
    guard !isSessionActive else { return }
    let session = AVAudioSession.sharedInstance()
    // 用 .default 而非 .voiceChat：voiceChat 模式在本地未采集时会把输出压到听筒，
    // 导致"必须先开麦才能听到声音"；回声消除由 Agora SDK 内部的软件 AEC 负责
    try session.setCategory(
      .playAndRecord,
      mode: .default,
      options: [.defaultToSpeaker, .allowBluetooth]
    )
    try session.setActive(true, options: [])
    try forceSpeakerOutput()
    isSessionActive = true
    logCurrentRoute(tag: "activate")
    observeRouteChanges()
  }

  // 本地未采集时 iOS 会把 playAndRecord 的输出压到听筒，必须显式 override 到扬声器
  private func forceSpeakerOutput() throws {
    let session = AVAudioSession.sharedInstance()
    if session.currentRoute.outputs.contains(where: { $0.portType == .builtInSpeaker }) { return }
    try session.overrideOutputAudioPort(.speaker)
  }

  private func observeRouteChanges() {
    NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: nil,
      queue: .main
    ) { note in
      let reason = (note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt)
        .flatMap(AVAudioSession.RouteChangeReason.init(rawValue:))
      self.logCurrentRoute(tag: "routeChange reason=\(reason.map { String(describing: $0) } ?? "unknown")")
      // 路由被系统或 SDK 切走后（典型：本地未采集时被压回听筒），立即切回扬声器
      try? self.forceSpeakerOutput()
    }
  }

  private func logCurrentRoute(tag: String) {
    let session = AVAudioSession.sharedInstance()
    let outputs = session.currentRoute.outputs
      .map { "\($0.portType.rawValue):\($0.portName)" }
      .joined(separator: ", ")
    NSLog(
      "[VoiceRoom][audio] %@ | category=%@ mode=%@ options=%u active=%@ | outputs=[%@]",
      tag,
      session.category.rawValue,
      session.mode.rawValue,
      session.categoryOptions.rawValue,
      session.secondaryAudioShouldBeSilencedHint ? "muted-by-other" : "ok",
      outputs
    )
  }

  private func deactivateAudioSession() throws {
    guard isSessionActive else { return }
    let session = AVAudioSession.sharedInstance()
    NotificationCenter.default.removeObserver(self, name: AVAudioSession.routeChangeNotification, object: nil)
    try session.setActive(false, options: [.notifyOthersOnDeactivation])
    isSessionActive = false
  }

  private func updateNowPlaying(title: String, isPlaying: Bool, micEnabled: Bool) {
    var info: [String: Any] = [
      MPMediaItemPropertyTitle: micEnabled ? "\(title)（说话中）" : title,
      MPMediaItemPropertyArtist: "盼之电竞 · 语聊房",
      MPMediaItemPropertyAlbumTitle: "实时语音通话",
      MPNowPlayingInfoPropertyIsLiveStream: true,
      MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
      MPMediaItemPropertyPlaybackDuration: 0,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: 0,
    ]
    if let image = appIconImage() {
      let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
      info[MPMediaItemPropertyArtwork] = artwork
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    MPNowPlayingInfoCenter.default().playbackState = isPlaying ? .playing : .paused
  }

  private func clearNowPlaying() {
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    MPNowPlayingInfoCenter.default().playbackState = .stopped
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.removeTarget(nil)
    center.pauseCommand.removeTarget(nil)
    center.togglePlayPauseCommand.removeTarget(nil)
  }

  private func registerRemoteCommands() {
    let center = MPRemoteCommandCenter.shared()
    center.togglePlayPauseCommand.isEnabled = true
    center.togglePlayPauseCommand.addTarget { _ in .success }
    center.playCommand.isEnabled = false
    center.pauseCommand.isEnabled = false
    center.previousTrackCommand.isEnabled = false
    center.nextTrackCommand.isEnabled = false
    center.changePlaybackPositionCommand.isEnabled = false
    center.skipForwardCommand.isEnabled = false
    center.skipBackwardCommand.isEnabled = false
  }

  private func appIconImage() -> UIImage? {
    if let icons = Bundle.main.infoDictionary?["CFBundleIcons"] as? [String: Any],
       let primary = icons["CFBundlePrimaryIcon"] as? [String: Any],
       let files = primary["CFBundleIconFiles"] as? [String],
       let name = files.last {
      return UIImage(named: name)
    }
    return nil
  }
}
