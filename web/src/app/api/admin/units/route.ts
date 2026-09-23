import { guard, json, err } from "@/lib/admin";

export async function GET(req: Request) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  let query = g.admin
    .from("units")
    .select("*")
    .order("unit_number", { ascending: true });
  if (propertyId) query = query.eq("property_id", propertyId);
  const { data } = await query;
  return json(data ?? []);
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const body = await req.json().catch(() => ({}));
  const { data, error } = await g.admin
    .from("units")
    .insert({
      property_id: body.property_id,
      tower: body.tower ?? null,
      building: body.building ?? null,
      floor: body.floor ?? null,
      unit_number: body.unit_number,
      display_name: body.display_name ?? body.unit_number,
      billing_status: body.billing_status ?? "OK",
      debt_amount: body.debt_amount ?? 0,
      billing_notes: body.billing_notes ?? null,
    })
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}
