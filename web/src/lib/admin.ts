import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function adminClient(): SupabaseClient {
  if (!URL || !SERVICE_KEY) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Role = "DEVELOPER" | "ADMIN" | "RESIDENT";

export interface Actor {
  userId: string;
  role: Role;
  propertyIds: string[];
}

export async function getActor(req: Request): Promise<Actor | null> {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const admin = adminClient();
  const { data } = await admin.auth.getUser(token);
  const user = data.user;
  if (!user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role ?? "RESIDENT") as Role;
  let propertyIds: string[] = [];
  if (role === "ADMIN") {
    const { data: pa } = await admin
      .from("property_admins")
      .select("property_id")
      .eq("profile_id", user.id);
    propertyIds = (pa ?? []).map((r) => r.property_id);
  }
  return { userId: user.id, role, propertyIds };
}

export function canAccessProperty(actor: Actor, propertyId: string): boolean {
  if (actor.role === "DEVELOPER") return true;
  return actor.propertyIds.includes(propertyId);
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function err(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export type Guard =
  | { unauthorized: true }
  | { unauthorized: false; admin: SupabaseClient; actor: Actor };

export async function guard(req: Request): Promise<Guard> {
  const actor = await getActor(req);
  if (!actor || (actor.role !== "DEVELOPER" && actor.role !== "ADMIN")) {
    return { unauthorized: true };
  }
  return { unauthorized: false, admin: adminClient(), actor };
}

// Ids de unidades que el actor puede ver. `null` = sin límite (DEVELOPER).
export async function scopedUnitIds(
  admin: SupabaseClient,
  actor: Actor,
): Promise<string[] | null> {
  if (actor.role === "DEVELOPER") return null;
  if (actor.propertyIds.length === 0) return [];
  const { data } = await admin
    .from("units")
    .select("id")
    .in("property_id", actor.propertyIds);
  return (data ?? []).map((u) => u.id);
}

// ¿El actor puede ver la unidad? (DEVELOPER sí; ADMIN si pertenece a un edificio asignado)
export async function canAccessUnit(
  admin: SupabaseClient,
  actor: Actor,
  unitId: string,
): Promise<boolean> {
  if (actor.role === "DEVELOPER") return true;
  const { data } = await admin
    .from("units")
    .select("property_id")
    .eq("id", unitId)
    .maybeSingle();
  return data ? actor.propertyIds.includes(data.property_id) : false;
}
