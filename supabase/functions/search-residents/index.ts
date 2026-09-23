import { adminClient } from "../_shared/clients.ts";
import { json, error, readJson, clientIp } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});

  try {
    const body = await readJson(req);
    const token = String(body.token ?? "");
    const query = String(body.query ?? "").trim();

    if (!token) return error("Token de acceso requerido", 400);
    if (query.length < 2) return error("Ingresá al menos 2 caracteres", 400);

    const admin = adminClient();

    const { data: accessPoint } = await admin
      .from("access_points")
      .select("id, property_id")
      .eq("qr_token", token)
      .eq("active", true)
      .maybeSingle();

    if (!accessPoint) return error("Este acceso no está disponible.", 404, "ACCESS_NOT_FOUND");

    const ip = clientIp(req);
    const { data: allowed } = await admin.rpc("take_rate_limit", {
      p_key: `search:${token}:${ip}`,
      p_limit: 30,
      p_window_seconds: 60,
    });
    if (!allowed) return error("Demasiadas consultas. Intentá de nuevo en un momento.", 429);

    const { data: results } = await admin.rpc("search_residents_by_access", {
      p_token: token,
      p_query: query,
    });

    return json({ results: results ?? [] });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Error interno", 500);
  }
});
