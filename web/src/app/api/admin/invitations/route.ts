import { guard, json, err } from "@/lib/admin";

export async function GET() {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { data } = await g.admin
    .from("invitations")
    .select("*, units(display_name, unit_number), residents(display_name)")
    .order("created_at", { ascending: false });
  return json(data ?? []);
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const body = await req.json().catch(() => ({}));
  const token = crypto.randomUUID().slice(0, 8).toUpperCase();
  const { data, error } = await g.admin
    .from("invitations")
    .insert({
      unit_id: body.unit_id,
      resident_id: body.resident_id ?? null,
      token,
      email: body.email ?? null,
      phone: body.phone ?? null,
      status: "PENDING",
    })
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}
