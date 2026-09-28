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
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    sound: "alarm.wav",
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync("billing", {
    name: "Expensas",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  });
}

export function onVisitNotification(callback: () => void) {
  const sub = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data as { type?: string } | undefined;
    if (data?.type === "visit_request") callback();
  });
  return sub;
}

let alarmNotificationId: string | null = null;

export async function startVisitAlarm(title: string, body: string) {
  if (alarmNotificationId) return;
  try {
    alarmNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "alarm.wav",
        data: { type: "visit_alarm" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 8,
        repeats: true,
      },
    });
  } catch (e) {
    console.warn("No se pudo iniciar la alarma de visita:", e);
  }
}

export async function stopVisitAlarm() {
  if (!alarmNotificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(alarmNotificationId);
  } catch (e) {
    console.warn("No se pudo cancelar la alarma de visita:", e);
  }
  alarmNotificationId = null;
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
