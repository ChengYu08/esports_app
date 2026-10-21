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
    try session.setCategory(
      .playAndRecord,
      mode: .voiceChat,
      options: [.defaultToSpeaker, .allowBluetooth, .mixWithOthers]
    )
    try session.setActive(true, options: [])
    isSessionActive = true
  }

  private func deactivateAudioSession() throws {
    guard isSessionActive else { return }
    let session = AVAudioSession.sharedInstance()
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
