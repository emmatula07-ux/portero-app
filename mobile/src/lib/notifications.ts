import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("visits", {
    name: "Visitas",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "default",
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync("billing", {
    name: "Expensas",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  });
}

const IS_EXPO_GO = Constants.appOwnership === "expo";

export async function registerPushToken(userId: string) {
  try {
    if (IS_EXPO_GO) {
      console.warn("Push no disponible en Expo Go. Usá un development build (expo run:android / eas build).");
      return false;
    }
    if (!Device.isDevice) {
      console.warn("Push requiere un dispositivo físico (o emulador con Google Play).");
      return false;
    }

    const perms = await Notifications.getPermissionsAsync();
    let granted = perms.granted;
    if (!granted) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) {
      console.warn("Permiso de notificaciones denegado.");
      return false;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    if (!projectId) {
      console.warn("Falta el projectId de EAS para push. Corré `npx eas init` o definilo en app.json (extra.eas.projectId).");
      return false;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });

    const platform = Platform.OS === "ios" ? "IOS" : "ANDROID";
    const deviceName = Device.modelName ?? "Dispositivo";

    const { data: existing } = await supabase
      .from("resident_devices")
      .select("id")
      .eq("push_token", token.data)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("resident_devices")
        .update({ profile_id: userId, active: true, last_seen_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("resident_devices").insert({
        profile_id: userId,
        platform,
        push_token: token.data,
        device_name: deviceName,
        active: true,
        last_seen_at: new Date().toISOString(),
      });
    }
    console.log("Push registrado correctamente.");
    return true;
  } catch (e) {
    console.warn("No se pudo registrar el token de push:", e);
    return false;
  }
}
