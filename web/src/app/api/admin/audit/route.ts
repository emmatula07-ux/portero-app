import { guard, json, err } from "@/lib/admin";

export async function GET(req: Request) {
  const g = await guard();
  if (g.unauthorized) return err("No autorizado", 401);
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);
  const { data } = await g.admin
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return json(data ?? []);
}
