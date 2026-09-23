import { guard, json, err } from "@/lib/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { data, error } = await g.admin
    .from("properties")
    .update({
      name: body.name,
      type: body.type,
      address: body.address,
      timezone: body.timezone,
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
  const { error } = await g.admin.from("properties").update({ active: false }).eq("id", id);
  if (error) return err(error.message, 500);
  return json({ ok: true });
}
