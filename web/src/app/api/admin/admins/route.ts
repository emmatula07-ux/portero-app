import { guard, json, err } from "@/lib/admin";

export async function GET(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  if (g.actor.role !== "DEVELOPER") return err("Solo el desarrollador", 403);

  const { data } = await g.admin
    .from("property_admins")
    .select("id, property_id, profile_id, created_at, profiles(email), properties(name)")
    .order("created_at", { ascending: false });
  return json(data ?? []);
}

export async function POST(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  if (g.actor.role !== "DEVELOPER") return err("Solo el desarrollador", 403);

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const propertyId = String(body.propertyId ?? "");
  if (!email || !propertyId) return err("Email y edificio requeridos", 400);

  const admin = g.admin;

  // buscar o crear el usuario por email
  let { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let generatedPassword: string | null = null;

  if (!profile) {
    generatedPassword = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"[b % 54])
      .join("");
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
    });
    if (createErr) return err(createErr.message, 500);
    profile = { id: created.user.id };
  }

  await admin.from("profiles").update({ role: "ADMIN" }).eq("id", profile.id);
  await admin
    .from("property_admins")
    .upsert(
      { property_id: propertyId, profile_id: profile.id },
      { onConflict: "property_id,profile_id" },
    );

  return json({ ok: true, generatedPassword }, 201);
}
