import { adminClient, userClient } from "../_shared/clients.ts";
import { json, error, readJson } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return error("No autenticado", 401);

    const client = userClient(authHeader);
    const { data: authData } = await client.auth.getUser();
    const user = authData.user;
    if (!user) return error("No autenticado", 401);

    const body = await readJson(req);
    const pushToken = String(body.push_token ?? "").trim();
    if (!pushToken) return error("Token requerido", 400);

    const admin = adminClient();

    await admin
      .from("resident_devices")
      .update({ active: false, revoked_at: new Date().toISOString() })
      .eq("push_token", pushToken)
      .eq("profile_id", user.id);

    return json({ ok: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Error interno", 500);
  }
});
