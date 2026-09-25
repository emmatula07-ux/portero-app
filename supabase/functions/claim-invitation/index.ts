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
    const token = String(body.token ?? "").trim();
    if (!token) return error("Código de invitación requerido", 400);

    const admin = adminClient();

    const { data: invitation } = await admin
      .from("invitations")
      .select("id, unit_id, resident_id, status, expires_at, email")
      .eq("token", token)
      .maybeSingle();

    if (!invitation) return error("Invitación inválida.", 404, "INVITATION_NOT_FOUND");
    if (invitation.status !== "PENDING") return error("Invitación ya utilizada.", 409, "INVITATION_USED");
    if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
      return error("Invitación expirada.", 410, "INVITATION_EXPIRED");
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const userEmail = (profile?.email ?? user.email ?? "").trim().toLowerCase();
    const inviteEmail = (invitation.email ?? "").trim().toLowerCase();
    if (inviteEmail && userEmail !== inviteEmail) {
      return error("Esta invitación está destinada a otro correo.", 403, "INVITATION_EMAIL_MISMATCH");
    }

    const fullName = (profile?.full_name ?? "").trim();
    const emailLocal = (profile?.email ?? user.email ?? "").split("@")[0].trim();
    const fallback = fullName || emailLocal || "Residente";
    const parts = fallback.split(" ").filter(Boolean);
    const firstName = parts[0] || "Residente";
    const lastName = parts.slice(1).join(" ") || null;

    let residentId = invitation.resident_id;

    if (residentId) {
      await admin.from("residents").update({ profile_id: user.id }).eq("id", residentId);
    } else {
      const { data: created } = await admin
        .from("residents")
        .insert({
          unit_id: invitation.unit_id,
          profile_id: user.id,
          first_name: firstName,
          last_name: lastName,
          display_name: fullName || fallback,
          role: "TENANT",
          active: true,
        })
        .select("*")
        .single();
      residentId = created?.id;
    }

    await admin.from("invitations").update({
      status: "CLAIMED",
      claimed_by_profile_id: user.id,
      claimed_at: new Date().toISOString(),
    }).eq("id", invitation.id);

    await admin.from("audit_logs").insert({
      actor_type: "user",
      actor_id: user.id,
      action: "INVITATION_CLAIMED",
      entity_type: "invitation",
      entity_id: invitation.id,
      metadata: { unit_id: invitation.unit_id, resident_id: residentId },
    });

    return json({ unitId: invitation.unit_id, residentId });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Error interno", 500);
  }
});
