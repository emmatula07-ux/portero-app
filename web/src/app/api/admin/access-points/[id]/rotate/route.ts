import { guard, json, err, canAccessProperty } from "@/lib/admin";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const { id } = await params;
  const { data: ap } = await g.admin.from("access_points").select("property_id").eq("id", id).maybeSingle();
  if (!ap || !canAccessProperty(g.actor, ap.property_id)) return err("No autorizado", 403);
  const { data, error } = await g.admin
    .from("access_points")
    .update({ qr_token: crypto.randomUUID() })
    .eq("id", id)
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data);
}
