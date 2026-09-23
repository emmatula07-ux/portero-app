import { guard, json, err } from "@/lib/admin";

export async function GET(req: Request) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  let query = g.admin
    .from("access_points")
    .select("*")
    .order("name", { ascending: true });
  if (propertyId) query = query.eq("property_id", propertyId);
  const { data } = await query;
  return json(data ?? []);
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const body = await req.json().catch(() => ({}));
  const { data, error } = await g.admin
    .from("access_points")
    .insert({
      property_id: body.property_id,
      access_controller_id: body.access_controller_id ?? null,
      name: body.name,
      type: body.type ?? "MAIN_ENTRANCE",
      qr_token: crypto.randomUUID(),
    })
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}
