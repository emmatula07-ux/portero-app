import { guard, json, err, canAccessProperty } from "@/lib/admin";

const NONE = "00000000-0000-0000-0000-000000000000";

export async function GET(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");

  let q = g.admin.from("units").select("*").order("unit_number", { ascending: true });
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
    .from("units")
    .insert({
      property_id: body.property_id,
      tower: body.tower ?? null,
      building: body.building ?? null,
      floor: body.floor ?? null,
      unit_number: body.unit_number,
      display_name: body.display_name ?? body.unit_number,
      billing_status: body.billing_status ?? "OK",
      debt_amount: body.debt_amount ?? 0,
      billing_notes: body.billing_notes ?? null,
    })
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}
