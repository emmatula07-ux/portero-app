package com.portero.alarm

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class AlarmActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    @Suppress("DEPRECATION")
    window.addFlags(
      WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
    )

    val title = intent.getStringExtra("title") ?: "Visita en curso"
    val body = intent.getStringExtra("body") ?: "Tenés una visita esperando."

    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#0a0a0a"))
      setPadding(64, 96, 64, 64)
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    }

    layout.addView(TextView(this).apply {
      text = "\uD83D\uDD14"
      textSize = 64f
      gravity = Gravity.CENTER
    })

    layout.addView(TextView(this).apply {
      text = title
      textSize = 26f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      setPadding(0, 32, 0, 0)
    })

    layout.addView(TextView(this).apply {
      text = body
      textSize = 18f
      setTextColor(Color.parseColor("#a1a1aa"))
      gravity = Gravity.CENTER
      setPadding(0, 12, 0, 0)
    })

    val btn = Button(this).apply {
      text = "Detener alarma"
      textSize = 16f
      setOnClickListener {
        AlarmService.stop(this@AlarmActivity)
        finish()
      }
      layoutParams = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
      ).apply {
        topMargin = 48
      }
    }
    layout.addView(btn)

    setContentView(layout)
  }
}
