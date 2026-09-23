import { guard, json, err } from "@/lib/admin";

export async function GET() {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { data } = await g.admin
    .from("properties")
    .select("*")
    .order("created_at", { ascending: true });
  return json(data ?? []);
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const body = await req.json().catch(() => ({}));
  const { data, error } = await g.admin
    .from("properties")
    .insert({
      name: body.name,
      type: body.type ?? "BUILDING",
      address: body.address ?? null,
      timezone: body.timezone ?? "America/Argentina/Buenos_Aires",
    })
    .select()
    .single();
  if (error) return err(error.message, 500);
  return json(data, 201);
}
