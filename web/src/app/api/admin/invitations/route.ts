import { guard, json, err, canAccessUnit, scopedUnitIds } from "@/lib/admin";

const NONE = "00000000-0000-0000-0000-000000000000";

export async function GET(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const unitIds = await scopedUnitIds(g.admin, g.actor);
  let q = g.admin
    .from("invitations")
    .select("*, units(display_name, unit_number), residents(display_name)")
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
  const token = crypto.randomUUID().slice(0, 8).toUpperCase();
  const { data, error } = await g.admin
    .from("invitations")
    .insert({
      unit_id: body.unit_id,
      resident_id: body.resident_id ?? null,
      token,
      email: body.email ?? null,
      phone: body.phone ?? null,
      status: "PENDING",
    })
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}
