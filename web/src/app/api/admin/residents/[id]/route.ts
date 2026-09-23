import { guard, json, err } from "@/lib/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { data, error } = await g.admin
    .from("residents")
    .update({
      first_name: body.first_name,
      last_name: body.last_name,
      display_name: body.display_name,
      role: body.role,
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
  const { error } = await g.admin.from("residents").update({ active: false }).eq("id", id);
  if (error) return err(error.message, 500);
  return json({ ok: true });
}
