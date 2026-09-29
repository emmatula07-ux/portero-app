package com.portero.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder

class AlarmService : Service() {

  companion object {
    private const val CHANNEL_ID = "portero_alarm"
    private const val NOTIFICATION_ID = 991
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_BODY = "body"

    fun start(context: Context, title: String, body: String) {
      val intent = Intent(context, AlarmService::class.java).apply {
        putExtra(EXTRA_TITLE, title)
        putExtra(EXTRA_BODY, body)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, AlarmService::class.java))
    }
  }

  private var player: MediaPlayer? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Visita en curso"
    val body = intent?.getStringExtra(EXTRA_BODY) ?: "Tenés una visita esperando."
    createChannel()
    startForegroundWithNotification(title, body)
    startLoopingSound()
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    stopLoopingSound()
    super.onDestroy()
  }

  private fun startForegroundWithNotification(title: String, body: String) {
    val notification = buildNotification(title, body)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Alarma de visita",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Suena mientras hay una visita en curso"
        enableVibration(true)
      }
      val manager = getSystemService(NotificationManager::class.java)
      manager?.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(title: String, body: String): Notification {
    val fullScreenIntent = PendingIntent.getActivity(
      this,
      0,
      Intent(this, AlarmActivity::class.java).apply {
        putExtra(EXTRA_TITLE, title)
        putExtra(EXTRA_BODY, body)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return builder
      .setContentTitle(title)
      .setContentText(body)
      .setSmallIcon(applicationInfo.icon)
      .setCategory(Notification.CATEGORY_ALARM)
      .setOngoing(true)
      .setFullScreenIntent(fullScreenIntent, true)
      .build()
  }

  private fun startLoopingSound() {
    stopLoopingSound()
    val resId = resources.getIdentifier("alarm", "raw", packageName)
    if (resId == 0) return
    player = MediaPlayer.create(this, resId)?.apply {
      isLooping = true
      start()
    }
  }

  private fun stopLoopingSound() {
    player?.apply {
      try {
        stop()
      } catch (_: Exception) {
      }
      release()
    }
    player = null
  }
}
