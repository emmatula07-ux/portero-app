import { guard, json, err } from "@/lib/admin";

export async function GET(req: Request) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  let query = g.admin
    .from("residents")
    .select("*, units(display_name, unit_number)")
    .order("display_name", { ascending: true });
  if (propertyId) {
    query = query.in(
      "unit_id",
      (await g.admin.from("units").select("id").eq("property_id", propertyId)).data?.map(
        (u: { id: string }) => u.id,
      ) ?? [],
    );
  }
  const { data } = await query;
  return json(data ?? []);
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const body = await req.json().catch(() => ({}));
  const displayName =
    body.display_name || `${body.first_name ?? ""} ${body.last_name ?? ""}`.trim();
  const { data, error } = await g.admin
    .from("residents")
    .insert({
      unit_id: body.unit_id,
      first_name: body.first_name,
      last_name: body.last_name ?? null,
      display_name: displayName || null,
      role: body.role ?? "OWNER",
    })
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}
