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
    if (intent?.action == ACTION_STOP) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        stopForeground(STOP_FOREGROUND_REMOVE)
      } else {
        @Suppress("DEPRECATION")
        stopForeground(true)
      }
      stopSelf()
      return START_NOT_STICKY
    }

    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "语聊房进行中"
    val microphoneEnabled = intent?.getBooleanExtra(EXTRA_MICROPHONE_ENABLED, false) ?: false
    val updateOnly = intent?.getBooleanExtra(EXTRA_UPDATE_ONLY, false) ?: false

    createNotificationChannel()

    if (updateOnly) {
      val manager = getSystemService(NotificationManager::class.java)
      manager.notify(NOTIFICATION_ID, buildNotification(title, microphoneEnabled))
    } else {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        var serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        if (microphoneEnabled) {
          serviceType = serviceType or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        }
        startForeground(NOTIFICATION_ID, buildNotification(title, microphoneEnabled), serviceType)
      } else {
        startForeground(NOTIFICATION_ID, buildNotification(title, microphoneEnabled))
      }
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

  private fun buildNotification(title: String, microphoneEnabled: Boolean): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val contentPendingIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0,
      )
    }

    val stopIntent = Intent(this, VoiceRoomBackgroundService::class.java).apply {
      action = ACTION_STOP
    }
    val stopPendingIntent = PendingIntent.getService(
      this,
      1,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0,
    )

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    builder
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle(if (microphoneEnabled) "$title（说话中）" else title)
      .setContentText("语音连接正在后台保持")
      .setCategory(Notification.CATEGORY_CALL)
      .setOngoing(true)
      .setContentIntent(contentPendingIntent)
      .addAction(
        Notification.Action.Builder(null, "结束语聊", stopPendingIntent).build(),
      )
      .setStyle(Notification.MediaStyle().setShowActionsInCompactView(0))

    return builder.build()
  }

  companion object {
    const val EXTRA_TITLE = "voiceRoomTitle"
    const val EXTRA_MICROPHONE_ENABLED = "microphoneEnabled"
    const val EXTRA_UPDATE_ONLY = "updateOnly"
    const val ACTION_STOP = "expo.modules.voiceroombackground.ACTION_STOP"
    private const val CHANNEL_ID = "voice-room-audio"
    private const val NOTIFICATION_ID = 5701
  }
}
