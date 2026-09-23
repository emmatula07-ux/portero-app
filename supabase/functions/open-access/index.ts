import { adminClient, userClient } from "../_shared/clients.ts";
import { json, error, readJson } from "../_shared/http.ts";
import { getController } from "../_shared/controller.ts";

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
    const visitId = body.visitId ? String(body.visitId) : null;
    const accessPointId = body.accessPointId ? String(body.accessPointId) : null;

    if (!visitId && !accessPointId) return error("Falta el acceso o la visita", 400);

    const admin = adminClient();

    const { data: myResidents } = await admin
      .from("residents")
      .select("id, unit_id")
      .eq("profile_id", user.id)
      .eq("active", true);

    if (!myResidents?.length) return error("No tenés una unidad asociada.", 403, "NO_UNIT");

    const myUnitIds = [...new Set(myResidents.map((r) => r.unit_id))];

    let unitId: string | null = null;
    let resolvedAccessPointId: string | null = accessPointId;

    if (visitId) {
      const { data: visit } = await admin
        .from("visit_requests")
        .select("id, unit_id, access_point_id, status, expires_at")
        .eq("id", visitId)
        .maybeSingle();

      if (!visit) return error("Visita no encontrada.", 404);
      if (!myUnitIds.includes(visit.unit_id)) {
        return error("No tenés permiso sobre esta visita.", 403, "NOT_YOUR_VISIT");
      }
      if (visit.status === "REJECTED" || visit.status === "CANCELLED") {
        return error("La visita no está activa.", 403, "VISIT_INACTIVE");
      }
      if (new Date(visit.expires_at).getTime() < Date.now()) {
        return error("La visita expiró.", 403, "VISIT_EXPIRED");
      }
      unitId = visit.unit_id;
      resolvedAccessPointId = visit.access_point_id;
    }

    if (!resolvedAccessPointId) return error("Falta el acceso.", 400);

    const now = Date.now();

    if (!unitId) {
      const { data: perms } = await admin
        .from("access_permissions")
        .select("unit_id, expires_at")
        .eq("access_point_id", resolvedAccessPointId)
        .eq("granted", true)
        .in("unit_id", myUnitIds);

      const valid = (perms ?? []).find(
        (p) => !p.expires_at || new Date(p.expires_at).getTime() > now,
      );
      if (!valid) return error("No tenés permiso para abrir este acceso.", 403, "NO_PERMISSION");
      unitId = valid.unit_id;
    } else {
      const { data: perm } = await admin
        .from("access_permissions")
        .select("id, expires_at")
        .eq("unit_id", unitId)
        .eq("access_point_id", resolvedAccessPointId)
        .eq("granted", true)
        .maybeSingle();

      if (!perm || (perm.expires_at && new Date(perm.expires_at).getTime() <= now)) {
        return error("No tenés permiso para abrir este acceso.", 403, "NO_PERMISSION");
      }
    }

    const { data: unit } = await admin
      .from("units")
      .select("id, billing_status, display_name, unit_number")
      .eq("id", unitId)
      .maybeSingle();

    if (!unit) return error("Unidad no encontrada.", 404);

    if (unit.billing_status === "BLOCKED") {
      await admin.from("audit_logs").insert({
        actor_type: "user",
        actor_id: user.id,
        action: "OPEN_DENIED_BILLING_BLOCKED",
        entity_type: "access_point",
        entity_id: resolvedAccessPointId,
        metadata: { unit_id: unitId },
      });
      return error(
        "Acceso bloqueado por deuda de expensas. Contactá a la administración.",
        403,
        "BILLING_BLOCKED",
      );
    }

    const resident = myResidents.find((r) => r.unit_id === unitId) ?? myResidents[0];
    const nonce = crypto.randomUUID();

    const { data: accessPoint } = await admin
      .from("access_points")
      .select("id, name, access_controllers(type, config)")
      .eq("id", resolvedAccessPointId)
      .maybeSingle();

    const controllerType = accessPoint?.access_controllers?.type ?? null;
    const controllerConfig = accessPoint?.access_controllers?.config ?? null;
    const controller = getController(controllerType);

    const { data: action } = await admin
      .from("access_actions")
      .insert({
        visit_request_id: visitId,
        resident_id: resident.id,
        profile_id: user.id,
        access_point_id: resolvedAccessPointId,
        action: "OPEN",
        status: "REQUESTED",
        nonce,
      })
      .select("*")
      .single();

    await admin
      .from("access_actions")
      .update({ status: "COMMAND_SENT" })
      .eq("id", action.id);

    const outcome = await controller.open({
      accessPointId: resolvedAccessPointId,
      config: controllerConfig,
    });

    if (outcome.ok) {
      await admin
        .from("access_actions")
        .update({ status: "EXECUTED", executed_at: new Date().toISOString() })
        .eq("id", action.id);

      await admin.from("audit_logs").insert({
        actor_type: "user",
        actor_id: user.id,
        action: "OPEN_EXECUTED",
        entity_type: "access_point",
        entity_id: resolvedAccessPointId,
        metadata: {
          unit_id: unitId,
          action_id: action.id,
          nonce,
          billing_status: unit.billing_status,
          controller_type: controllerType,
        },
      });

      return json({
        actionId: action.id,
        status: "EXECUTED",
        accessPointId: resolvedAccessPointId,
        billingStatus: unit.billing_status,
      });
    }

    await admin
      .from("access_actions")
      .update({ status: "FAILED", failure_reason: outcome.reason })
      .eq("id", action.id);

    await admin.from("audit_logs").insert({
      actor_type: "user",
      actor_id: user.id,
      action: "OPEN_FAILED",
      entity_type: "access_point",
      entity_id: resolvedAccessPointId,
      metadata: { unit_id: unitId, action_id: action.id, nonce, failure_reason: outcome.reason },
    });

    return error("No se pudo abrir el acceso. Controlador sin conexión.", 502, "OPEN_FAILED");
  } catch (e) {
    return error(e instanceof Error ? e.message : "Error interno", 500);
  }
});
