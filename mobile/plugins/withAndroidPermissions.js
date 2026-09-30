const { AndroidConfig } = require("@expo/config-plugins");

// React Native incluye SYSTEM_ALERT_WINDOW (draw over apps) incluso en release,
// por un leak del manifest de debug. Play Store lo considera "acceso especial".
// Lo bloqueamos con tools:node="remove" para que no quede en el APK final.
module.exports = function withAndroidPermissions(config) {
  return AndroidConfig.Permissions.withBlockedPermissions(config, [
    "android.permission.SYSTEM_ALERT_WINDOW",
  ]);
};
