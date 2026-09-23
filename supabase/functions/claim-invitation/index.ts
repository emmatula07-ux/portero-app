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
      .select("id, unit_id, resident_id, status, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!invitation) return error("Invitación inválida.", 404, "INVITATION_NOT_FOUND");
    if (invitation.status !== "PENDING") return error("Invitación ya utilizada.", 409, "INVITATION_USED");
    if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
      return error("Invitación expirada.", 410, "INVITATION_EXPIRED");
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    let residentId = invitation.resident_id;

    if (residentId) {
      await admin.from("residents").update({ profile_id: user.id }).eq("id", residentId);
    } else {
      const { data: created } = await admin
        .from("residents")
        .insert({
          unit_id: invitation.unit_id,
          profile_id: user.id,
          first_name: profile?.full_name?.split(" ")[0] ?? "Residente",
          last_name: profile?.full_name?.split(" ").slice(1).join(" ") ?? null,
          display_name: profile?.full_name ?? "Residente",
          role: "TENANT",
          active: true,
        })
        .select("*")
        .single();
      residentId = created?.id;
    }

    await admin.from("invitations").update({ status: "CLAIMED" }).eq("id", invitation.id);

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
