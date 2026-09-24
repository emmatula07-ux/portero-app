import { guard, json, err, canAccessProperty } from "@/lib/admin";

const NONE = "00000000-0000-0000-0000-000000000000";

export async function GET(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  let q = g.admin.from("properties").select("*").order("name", { ascending: true });
  if (g.actor.role === "ADMIN") {
    q = g.actor.propertyIds.length ? q.in("id", g.actor.propertyIds) : q.in("id", [NONE]);
  }
  const { data } = await q;
  return json(data ?? []);
}

export async function POST(req: Request) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  if (g.actor.role !== "DEVELOPER") return err("Solo el desarrollador puede crear edificios", 403);
  const body = await req.json().catch(() => ({}));
  const { data, error } = await g.admin
    .from("properties")
    .insert({
      name: body.name,
      type: body.type ?? "BUILDING",
      address: body.address ?? null,
      timezone: body.timezone ?? "America/Argentina/Buenos_Aires",
    })
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}
