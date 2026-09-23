import { guard, json, err } from "@/lib/admin";

export async function GET() {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const admin = g.admin;

  const count = async (table: string) => {
    const { count: c } = await admin.from(table).select("id", { count: "exact", head: true });
    return c ?? 0;
  };

  const [properties, units, residents, accessPoints, visits, pendingVisits] = await Promise.all([
    count("properties"),
    count("units"),
    count("residents"),
    count("access_points"),
    count("visit_requests"),
    admin
      .from("visit_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
  ]);

  const { data: recentVisits } = await admin
    .from("visit_requests")
    .select("id, status, visitor_name, visitor_type, created_at, units(display_name, unit_number)")
    .order("created_at", { ascending: false })
    .limit(8);

  const { data: recentAudit } = await admin
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(8);

  return json({
    properties,
    units,
    residents,
    accessPoints,
    visits,
    pendingVisits: pendingVisits?.count ?? 0,
    recentVisits: recentVisits ?? [],
    recentAudit: recentAudit ?? [],
  });
}
