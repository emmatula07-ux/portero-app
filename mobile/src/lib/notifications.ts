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

export async function registerPushToken(userId: string) {
  try {
    if (!Device.isDevice) return false;

    const perms = await Notifications.getPermissionsAsync();
    let granted = perms.granted;
    if (!granted) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return false;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

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
    return true;
  } catch (e) {
    console.warn("No se pudo registrar el token de push:", e);
    return false;
  }
}
