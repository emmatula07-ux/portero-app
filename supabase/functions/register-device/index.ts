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
    const platform = String(body.platform ?? "ANDROID");
    const deviceName = String(body.device_name ?? "Dispositivo");

    if (!pushToken) return error("Token requerido", 400);

    const admin = adminClient();

    // Reasigna el token a ESTE usuario, sin importar a quién pertenecía antes.
    await admin.from("resident_devices").upsert(
      {
        push_token: pushToken,
        profile_id: user.id,
        resident_id: null,
        platform,
        device_name: deviceName,
        active: true,
        revoked_at: null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "push_token" },
    );

    return json({ ok: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Error interno", 500);
  }
});
