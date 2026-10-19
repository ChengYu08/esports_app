package expo.modules.voiceroombackground

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class VoiceRoomBackgroundModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VoiceRoomBackground")

    AsyncFunction("start") { title: String, microphoneEnabled: Boolean ->
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("语聊房后台服务不可用")
      val intent = Intent(context, VoiceRoomBackgroundService::class.java)
        .putExtra(VoiceRoomBackgroundService.EXTRA_TITLE, title)
        .putExtra(VoiceRoomBackgroundService.EXTRA_MICROPHONE_ENABLED, microphoneEnabled)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
      else context.startService(intent)
      null
    }.runOnQueue(expo.modules.kotlin.functions.Queues.MAIN)

    AsyncFunction("stop") {
      val context = appContext.reactContext?.applicationContext
      if (context != null) {
        context.stopService(Intent(context, VoiceRoomBackgroundService::class.java))
      }
      null
    }.runOnQueue(expo.modules.kotlin.functions.Queues.MAIN)
  }
}
