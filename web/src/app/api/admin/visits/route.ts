import { guard, json, err, scopedUnitIds } from "@/lib/admin";

const NONE = "00000000-0000-0000-0000-000000000000";

export async function GET(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);
  const unitIds = await scopedUnitIds(g.admin, g.actor);

  let q = g.admin
    .from("visit_requests")
    .select(
      "id, status, visitor_name, visitor_message, visitor_type, created_at, expires_at, access_points(name), residents(display_name), units(display_name, unit_number)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (g.actor.role === "ADMIN") {
    q = unitIds && unitIds.length ? q.in("unit_id", unitIds) : q.in("id", [NONE]);
  }
  const { data } = await q;
  return json(data ?? []);
}
