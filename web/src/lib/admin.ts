import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

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

export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const store = await cookies();
  return store.get("portero_admin")?.value === secret;
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function err(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export type Guard = { unauthorized: true } | { unauthorized: false; admin: SupabaseClient };

export async function guard(): Promise<Guard> {
  if (!(await isAdmin())) return { unauthorized: true };
  return { unauthorized: false, admin: adminClient() };
}
