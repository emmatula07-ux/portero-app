import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface DeviceTarget {
  id: string;
  push_token: string;
}

export async function getUnitDevices(
  admin: SupabaseClient,
  unitId: string,
): Promise<DeviceTarget[]> {
  const { data: residents } = await admin
    .from("residents")
    .select("id, profile_id")
    .eq("unit_id", unitId)
    .eq("active", true);

  const residentIds = (residents ?? []).map((r) => r.id);
  const profileIds = (residents ?? [])
    .map((r) => r.profile_id)
    .filter((p): p is string => Boolean(p));

  let query = admin
    .from("resident_devices")
    .select("id, push_token")
    .eq("active", true);

  if (profileIds.length) query = query.in("profile_id", profileIds);
  else if (residentIds.length) query = query.in("resident_id", residentIds);

  const { data } = await query;

  const seen = new Set<string>();
  return (data ?? []).filter((d) => {
    if (!d.push_token || seen.has(d.push_token)) return false;
    seen.add(d.push_token);
    return true;
  });
}
