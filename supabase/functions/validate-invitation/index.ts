import { adminClient } from "../_shared/clients.ts";
import { json, error, readJson } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});

  try {
    const body = await readJson(req);
    const token = String(body.token ?? "").trim();
    if (!token) return error("Código de invitación requerido", 400);

    const admin = adminClient();
    const { data: invitation } = await admin
      .from("invitations")
      .select("id, property_id, unit_id, email, status, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!invitation) return error("Invitación inválida.", 404, "INVITATION_NOT_FOUND");
    if (invitation.status !== "PENDING") return error("Invitación ya utilizada.", 409, "INVITATION_USED");
    if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
      return error("Invitación expirada.", 410, "INVITATION_EXPIRED");
    }

    return json({
      valid: true,
      role: invitation.property_id ? "ADMIN" : "RESIDENT",
      email: invitation.email ?? null,
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Error interno", 500);
  }
});
