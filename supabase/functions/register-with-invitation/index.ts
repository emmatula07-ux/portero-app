import { adminClient } from "../_shared/clients.ts";
import { json, error, readJson } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});

  try {
    const body = await readJson(req);
    const token = String(body.token ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!token) return error("Código de invitación requerido", 400);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Email inválido", 400);
    if (password.length < 6) return error("La contraseña debe tener al menos 6 caracteres", 400);

    const admin = adminClient();

    const { data: invitation } = await admin
      .from("invitations")
      .select("id, unit_id, resident_id, property_id, email, status, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!invitation) return error("Invitación inválida.", 404, "INVITATION_NOT_FOUND");
    if (invitation.status !== "PENDING") return error("Invitación ya utilizada.", 409, "INVITATION_USED");
    if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
      return error("Invitación expirada.", 410, "INVITATION_EXPIRED");
    }

    const inviteEmail = (invitation.email ?? "").trim().toLowerCase();
    if (inviteEmail && inviteEmail !== email) {
      return error("Esta invitación está destinada a otro correo.", 403, "INVITATION_EMAIL_MISMATCH");
    }

    let userId: string;
    try {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr || !created?.user) {
        return error("Ya existe un usuario con ese email.", 409, "EMAIL_TAKEN");
      }
      userId = created.user.id;
    } catch {
      return error("Ya existe un usuario con ese email.", 409, "EMAIL_TAKEN");
    }

    let role = "RESIDENT";
    if (invitation.property_id) {
      role = "ADMIN";
      await admin.from("profiles").update({ role: "ADMIN" }).eq("id", userId);
      await admin
        .from("property_admins")
        .upsert(
          { property_id: invitation.property_id, profile_id: userId },
          { onConflict: "property_id,profile_id" },
        );
    } else if (invitation.unit_id) {
      if (invitation.resident_id) {
        await admin.from("residents").update({ profile_id: userId }).eq("id", invitation.resident_id);
      } else {
        const { data: profile } = await admin
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();
        const fullName = (profile?.full_name ?? "").trim();
        const fallback = fullName || email.split("@")[0] || "Residente";
        const parts = fallback.split(" ").filter(Boolean);
        await admin.from("residents").insert({
          unit_id: invitation.unit_id,
          profile_id: userId,
          first_name: parts[0] || "Residente",
          last_name: parts.slice(1).join(" ") || null,
          display_name: fullName || fallback,
          role: "TENANT",
          active: true,
        });
      }
    }

    await admin.from("invitations").update({
      status: "CLAIMED",
      claimed_by_profile_id: userId,
      claimed_at: new Date().toISOString(),
    }).eq("id", invitation.id);

    await admin.from("audit_logs").insert({
      actor_type: "user",
      actor_id: userId,
      action: "REGISTERED_WITH_INVITATION",
      entity_type: "invitation",
      entity_id: invitation.id,
      metadata: {
        email,
        property_id: invitation.property_id ?? null,
        unit_id: invitation.unit_id ?? null,
        role,
      },
    });

    return json({ ok: true, role });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Error interno", 500);
  }
});
