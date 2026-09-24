import { guard, json, err, canAccessUnit, canAccessProperty, scopedUnitIds } from "@/lib/admin";

const NONE = "00000000-0000-0000-0000-000000000000";

export async function GET(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const unitIds = await scopedUnitIds(g.admin, g.actor);
  let q = g.admin
    .from("access_permissions")
    .select("*, units(display_name, unit_number), access_points(name)")
    .order("created_at", { ascending: false });
  if (g.actor.role === "ADMIN") {
    q = unitIds && unitIds.length ? q.in("unit_id", unitIds) : q.in("id", [NONE]);
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
  if (body.access_point_id) {
    const { data: ap } = await g.admin
      .from("access_points")
      .select("property_id")
      .eq("id", body.access_point_id)
      .maybeSingle();
    if (!ap || !canAccessProperty(g.actor, ap.property_id)) {
      return err("No autorizado sobre este acceso", 403);
    }
  }

  const { data, error } = await g.admin
    .from("access_permissions")
    .upsert(
      {
        unit_id: body.unit_id,
        access_point_id: body.access_point_id,
        granted: body.granted ?? true,
        expires_at: body.expires_at ?? null,
      },
      { onConflict: "unit_id,access_point_id" },
    )
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}
