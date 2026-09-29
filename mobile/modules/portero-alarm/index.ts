import { requireNativeModule } from "expo-modules-core";

export type PorteroAlarmNativeModule = {
  startAlarm(title: string, body: string): void;
  stopAlarm(): void;
};

const nativeModule = requireNativeModule<PorteroAlarmNativeModule>("PorteroAlarm");

export function startAlarm(title: string, body: string): void {
  nativeModule.startAlarm(title, body);
}

export function stopAlarm(): void {
  nativeModule.stopAlarm();
}
