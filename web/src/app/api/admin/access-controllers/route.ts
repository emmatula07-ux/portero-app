import { guard, json, err } from "@/lib/admin";

export async function GET(req: Request) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  let query = g.admin.from("access_controllers").select("*").order("name", { ascending: true });
  if (propertyId) query = query.eq("property_id", propertyId);
  const { data } = await query;
  return json(data ?? []);
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const body = await req.json().catch(() => ({}));
  const { data, error } = await g.admin
    .from("access_controllers")
    .insert({
      property_id: body.property_id,
      name: body.name,
      type: body.type ?? "MOCK",
      config: body.config ?? null,
      status: "UNKNOWN",
    })
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}
