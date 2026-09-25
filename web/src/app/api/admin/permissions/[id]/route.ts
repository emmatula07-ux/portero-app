import { guard, json, err, canAccessUnit } from "@/lib/admin";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(_req);
  if (g.unauthorized) return err("No autorizado", 401);
  const { id } = await params;

  const { data: perm } = await g.admin
    .from("access_permissions")
    .select("unit_id")
    .eq("id", id)
    .maybeSingle();

  if (!perm || !(await canAccessUnit(g.admin, g.actor, perm.unit_id))) {
    return err("No autorizado sobre este permiso", 403);
  }

  const { error } = await g.admin.from("access_permissions").delete().eq("id", id);
  if (error) return err(error.message, 500);
  return json({ ok: true });
}
