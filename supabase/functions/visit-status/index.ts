import { adminClient } from "../_shared/clients.ts";
import { json, error, readJson } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});

  try {
    const body = await readJson(req);
    const trackingToken = String(body.trackingToken ?? "");

    if (!trackingToken) return error("Token de seguimiento requerido", 400);

    const admin = adminClient();

    const { data: visit } = await admin
      .from("visit_requests")
      .select("id, status, expires_at")
      .eq("tracking_token", trackingToken)
      .maybeSingle();

    if (!visit) return error("Solicitud no encontrada.", 404);

    let status = visit.status;
    if (status === "PENDING" && new Date(visit.expires_at).getTime() < Date.now()) {
      await admin.from("visit_requests").update({ status: "EXPIRED" }).eq("id", visit.id);
      status = "EXPIRED";
    }

    return json({ visitId: visit.id, status, expiresAt: visit.expires_at });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Error interno", 500);
  }
});
