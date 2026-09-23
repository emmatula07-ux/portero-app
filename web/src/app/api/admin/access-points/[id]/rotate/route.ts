import { guard, json, err } from "@/lib/admin";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { id } = await params;
  const { data, error } = await g.admin
    .from("access_points")
    .update({ qr_token: crypto.randomUUID() })
    .eq("id", id)
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data);
}
