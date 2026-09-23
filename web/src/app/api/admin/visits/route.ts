import { guard, json, err } from "@/lib/admin";

export async function GET(req: Request) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);
  const { data } = await g.admin
    .from("visit_requests")
    .select(
      "id, status, visitor_name, visitor_message, visitor_type, created_at, expires_at, access_points(name), residents(display_name), units(display_name, unit_number)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return json(data ?? []);
}
