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
  if (!propertyId) return err("Edificio requerido", 400);

  const token = crypto.randomUUID().slice(0, 8).toUpperCase();
  const { data, error } = await g.admin
    .from("invitations")
    .insert({
      property_id: propertyId,
      token,
      email: email || null,
      status: "PENDING",
    })
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json({ token, invitation: data }, 201);
}
