import { guard, json, err, canAccessProperty } from "@/lib/admin";

const NONE = "00000000-0000-0000-0000-000000000000";

export async function GET(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  let q = g.admin
    .from("access_points")
    .select("*, access_controllers(name, type, status)")
    .order("name", { ascending: true });
  if (g.actor.role === "ADMIN") {
    q = g.actor.propertyIds.length ? q.in("property_id", g.actor.propertyIds) : q.in("id", [NONE]);
  }
  if (propertyId) {
    if (!canAccessProperty(g.actor, propertyId)) return err("No autorizado sobre este edificio", 403);
    q = q.eq("property_id", propertyId);
  }
  const { data } = await q;
  return json(data ?? []);
}

export async function POST(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const body = await req.json().catch(() => ({}));
  if (!body.property_id || !canAccessProperty(g.actor, body.property_id)) {
    return err("No autorizado sobre este edificio", 403);
  }
  const { data, error } = await g.admin
    .from("access_points")
    .insert({
      property_id: body.property_id,
      access_controller_id: body.access_controller_id ?? null,
      name: body.name,
      type: body.type ?? "MAIN_ENTRANCE",
      qr_token: crypto.randomUUID(),
    })
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}
