import { guard, json, err, canAccessUnit, scopedUnitIds } from "@/lib/admin";

const NONE = "00000000-0000-0000-0000-000000000000";

export async function GET(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");

  const unitIds = await scopedUnitIds(g.admin, g.actor);
  let q = g.admin
    .from("residents")
    .select("*, units(display_name, unit_number)")
    .order("display_name", { ascending: true });

  if (g.actor.role === "ADMIN") {
    q = unitIds && unitIds.length ? q.in("unit_id", unitIds) : q.in("id", [NONE]);
  }
  if (propertyId) {
    const { data: units } = await g.admin.from("units").select("id").eq("property_id", propertyId);
    const ids = (units ?? []).map((u) => u.id);
    q = ids.length ? q.in("unit_id", ids) : q.in("id", [NONE]);
  }
  const { data } = await q;
  return json(data ?? []);
}

export async function POST(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const body = await req.json().catch(() => ({}));
  if (!body.unit_id || !(await canAccessUnit(g.admin, g.actor, body.unit_id))) {
    return err("No autorizado sobre esta unidad", 403);
  }
  const displayName = body.display_name || `${body.first_name ?? ""} ${body.last_name ?? ""}`.trim();
  const { data, error } = await g.admin
    .from("residents")
    .insert({
      unit_id: body.unit_id,
      first_name: body.first_name,
      last_name: body.last_name ?? null,
      display_name: displayName || null,
      role: body.role ?? "OWNER",
    })
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}
