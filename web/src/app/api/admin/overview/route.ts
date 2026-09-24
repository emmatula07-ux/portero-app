import { guard, json, err } from "@/lib/admin";
import { SupabaseClient } from "@supabase/supabase-js";

async function countRows(
  admin: SupabaseClient,
  table: string,
  opts?: { propertyIds?: string[]; unitIds?: string[]; status?: string },
) {
  let q = admin.from(table).select("id", { count: "exact", head: true });
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.propertyIds) q = q.in("property_id", opts.propertyIds);
  if (opts?.unitIds) q = q.in("unit_id", opts.unitIds);
  const { count } = await q;
  return count ?? 0;
}

export async function GET(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const { admin, actor } = g;
  const isDev = actor.role === "DEVELOPER";

  const unitRows = isDev
    ? null
    : actor.propertyIds.length
    ? (await admin.from("units").select("id").in("property_id", actor.propertyIds)).data ?? []
    : [];
  const unitIds = unitRows ? unitRows.map((u) => u.id) : null;

  let properties = 0, units = 0, residents = 0, accessPoints = 0, visits = 0, pendingVisits = 0;

  if (isDev) {
    properties = await countRows(admin, "properties");
    units = await countRows(admin, "units");
    residents = await countRows(admin, "residents");
    accessPoints = await countRows(admin, "access_points");
    visits = await countRows(admin, "visit_requests");
    pendingVisits = await countRows(admin, "visit_requests", { status: "PENDING" });
  } else {
    properties = actor.propertyIds.length;
    if (actor.propertyIds.length) {
      units = await countRows(admin, "units", { propertyIds: actor.propertyIds });
      accessPoints = await countRows(admin, "access_points", { propertyIds: actor.propertyIds });
      if (unitIds && unitIds.length) {
        residents = await countRows(admin, "residents", { unitIds });
        visits = await countRows(admin, "visit_requests", { unitIds });
        pendingVisits = await countRows(admin, "visit_requests", { unitIds, status: "PENDING" });
      }
    }
  }

  let recentQuery = admin
    .from("visit_requests")
    .select("id, status, visitor_name, visitor_type, created_at, units(display_name, unit_number)")
    .order("created_at", { ascending: false })
    .limit(8);
  if (!isDev) recentQuery = recentQuery.in("unit_id", unitIds && unitIds.length ? unitIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: recentVisits } = await recentQuery;

  let recentAudit: unknown[] = [];
  if (isDev) {
    const { data } = await admin
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8);
    recentAudit = data ?? [];
  }

  return json({
    properties, units, residents, accessPoints, visits, pendingVisits,
    recentVisits: recentVisits ?? [], recentAudit,
  });
}
