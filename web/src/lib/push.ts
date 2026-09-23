import { SupabaseClient } from "@supabase/supabase-js";

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound?: string;
  priority?: "default" | "normal" | "high";
  channelId?: string;
  data?: Record<string, unknown>;
}

export async function sendExpoPush(messages: ExpoMessage[]): Promise<void> {
  if (messages.length === 0) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
}

interface DeviceTarget {
  id: string;
  push_token: string;
}

export async function getUnitDevices(
  admin: SupabaseClient,
  unitId: string,
): Promise<DeviceTarget[]> {
  const { data } = await admin
    .from("residents")
    .select("id, profile_id")
    .eq("unit_id", unitId)
    .eq("active", true);

  const residents = (data ?? []) as Array<{ id: string; profile_id: string | null }>;
  const profileIds = residents
    .map((r) => r.profile_id)
    .filter((p): p is string => p !== null);
  const residentIds = residents.map((r) => r.id);

  let query = admin.from("resident_devices").select("id, push_token").eq("active", true);
  if (profileIds.length) query = query.in("profile_id", profileIds);
  else if (residentIds.length) query = query.in("resident_id", residentIds);

  const { data: devices } = await query;
  const seen = new Set<string>();
  return ((devices ?? []) as DeviceTarget[]).filter((d) => {
    if (!d.push_token || seen.has(d.push_token)) return false;
    seen.add(d.push_token);
    return true;
  });
}
