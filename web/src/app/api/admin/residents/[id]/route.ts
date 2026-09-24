import { guard, json, err, canAccessUnit } from "@/lib/admin";

async function checkResident(admin: any, actor: any, id: string) {
  const { data } = await admin.from("residents").select("unit_id").eq("id", id).maybeSingle();
  return data ? canAccessUnit(admin, actor, data.unit_id) : false;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const { id } = await params;
  if (!(await checkResident(g.admin, g.actor, id))) return err("No autorizado", 403);
  const body = await req.json().catch(() => ({}));
  const { data, error } = await g.admin
    .from("residents")
    .update({ first_name: body.first_name, last_name: body.last_name, display_name: body.display_name, role: body.role, active: body.active })
    .eq("id", id)
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const { id } = await params;
  if (!(await checkResident(g.admin, g.actor, id))) return err("No autorizado", 403);
  const { error } = await g.admin.from("residents").update({ active: false }).eq("id", id);
  if (error) return err(error.message, 500);
  return json({ ok: true });
}
