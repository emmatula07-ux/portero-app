package com.portero.alarm

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PorteroAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PorteroAlarm")

    Function("startAlarm") { title: String, body: String ->
      val context = appContext.reactContext ?: return@Function false
      AlarmService.start(context, title, body)
      true
    }

    Function("stopAlarm") {
      val context = appContext.reactContext ?: return@Function false
      AlarmService.stop(context)
      true
    }
  }
}
