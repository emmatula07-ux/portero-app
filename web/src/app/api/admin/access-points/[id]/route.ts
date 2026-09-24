import { guard, json, err, canAccessProperty } from "@/lib/admin";

async function checkAp(admin: any, actor: any, id: string) {
  const { data } = await admin.from("access_points").select("property_id").eq("id", id).maybeSingle();
  return data ? canAccessProperty(actor, data.property_id) : false;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const { id } = await params;
  if (!(await checkAp(g.admin, g.actor, id))) return err("No autorizado", 403);
  const body = await req.json().catch(() => ({}));
  const { data, error } = await g.admin
    .from("access_points")
    .update({ name: body.name, type: body.type, active: body.active, access_controller_id: body.access_controller_id })
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
  if (!(await checkAp(g.admin, g.actor, id))) return err("No autorizado", 403);
  const { error } = await g.admin.from("access_points").update({ active: false }).eq("id", id);
  if (error) return err(error.message, 500);
  return json({ ok: true });
}
