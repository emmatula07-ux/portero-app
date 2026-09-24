import { guard, json, err } from "@/lib/admin";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(_req);
  if (g.unauthorized) return err("No autorizado", 401);
  if (g.actor.role !== "DEVELOPER") return err("Solo el desarrollador", 403);

  const { id } = await params;
  const { error } = await g.admin.from("property_admins").delete().eq("id", id);
  if (error) return err(error.message, 500);
  return json({ ok: true });
}
