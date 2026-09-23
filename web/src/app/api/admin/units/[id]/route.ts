import { guard, json, err } from "@/lib/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { data, error } = await g.admin
    .from("units")
    .update({
      tower: body.tower,
      building: body.building,
      floor: body.floor,
      unit_number: body.unit_number,
      display_name: body.display_name,
      billing_status: body.billing_status,
      debt_amount: body.debt_amount,
      billing_notes: body.billing_notes,
      active: body.active,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { id } = await params;
  const { error } = await g.admin.from("units").update({ active: false }).eq("id", id);
  if (error) return err(error.message, 500);
  return json({ ok: true });
}
