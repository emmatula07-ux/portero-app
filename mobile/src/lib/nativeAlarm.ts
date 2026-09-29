import { startAlarm as nativeStart, stopAlarm as nativeStop } from "portero-alarm";

export function startAlarm(title: string, body: string) {
  try {
    nativeStart(title, body);
  } catch (e) {
    console.warn("Alarma nativa no disponible:", e);
  }
}

export function stopAlarm() {
  try {
    nativeStop();
  } catch (e) {
    console.warn("Alarma nativa no disponible:", e);
  }
}
