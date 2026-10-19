package expo.modules.voiceroombackground

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

class VoiceRoomBackgroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "语聊房进行中"
    val microphoneEnabled = intent?.getBooleanExtra(EXTRA_MICROPHONE_ENABLED, false) ?: false
    createNotificationChannel()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      var serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      if (microphoneEnabled) serviceType = serviceType or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
      startForeground(NOTIFICATION_ID, buildNotification(title), serviceType)
    } else {
      startForeground(NOTIFICATION_ID, buildNotification(title))
    }
    return START_STICKY
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "语聊房", NotificationManager.IMPORTANCE_LOW).apply {
        description = "语聊房通话进行时显示"
      },
    )
  }

  private fun buildNotification(title: String): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0,
      )
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    builder
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle(title)
      .setContentText("语音连接正在后台保持")
      .setCategory(Notification.CATEGORY_CALL)
      .setOngoing(true)
      .setContentIntent(pendingIntent)
    return builder.build()
  }

  companion object {
    const val EXTRA_TITLE = "voiceRoomTitle"
    const val EXTRA_MICROPHONE_ENABLED = "microphoneEnabled"
    private const val CHANNEL_ID = "voice-room-audio"
    private const val NOTIFICATION_ID = 5701
  }
}
