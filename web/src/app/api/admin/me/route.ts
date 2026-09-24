import { guard, json, err } from "@/lib/admin";

export async function GET(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const { admin, actor } = g;

  let query = admin.from("properties").select("id, name").order("name");
  if (actor.role === "ADMIN") {
    if (actor.propertyIds.length === 0) query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
    else query = query.in("id", actor.propertyIds);
  }
  const { data: properties } = await query;

  return json({
    role: actor.role,
    propertyIds: actor.propertyIds,
    properties: properties ?? [],
  });
}
