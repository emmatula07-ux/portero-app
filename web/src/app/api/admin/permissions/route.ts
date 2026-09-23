import { guard, json, err } from "@/lib/admin";

export async function GET() {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { data } = await g.admin
    .from("access_permissions")
    .select("*, units(display_name, unit_number), access_points(name)")
    .order("created_at", { ascending: false });
  return json(data ?? []);
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const body = await req.json().catch(() => ({}));
  const { data, error } = await g.admin
    .from("access_permissions")
    .upsert(
      {
        unit_id: body.unit_id,
        access_point_id: body.access_point_id,
        granted: body.granted ?? true,
        expires_at: body.expires_at ?? null,
      },
      { onConflict: "unit_id,access_point_id" },
    )
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}
