import { adminClient } from "../_shared/clients.ts";
import { json, error, readJson, clientIp } from "../_shared/http.ts";
import { sendExpoPush, ExpoMessage } from "../_shared/push.ts";
import { getUnitDevices } from "../_shared/devices.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});

  try {
    const body = await readJson(req);
    const token = String(body.token ?? "");
    const residentId = String(body.residentId ?? "");
    const visitorName = String(body.visitorName ?? "").trim();
    const visitorMessage = String(body.visitorMessage ?? "").trim();
    const visitorType = String(body.visitorType ?? "VISITOR").toUpperCase() === "DELIVERY"
      ? "DELIVERY"
      : "VISITOR";

    if (!token) return error("Token de acceso requerido", 400);
    if (!residentId) return error("Seleccioná a quién venís a visitar", 400);

    const admin = adminClient();

    const { data: accessPoint } = await admin
      .from("access_points")
      .select("id, property_id, name")
      .eq("qr_token", token)
      .eq("active", true)
      .maybeSingle();

    if (!accessPoint) return error("Este acceso no está disponible.", 404, "ACCESS_NOT_FOUND");

    const ip = clientIp(req);
    const { data: allowed } = await admin.rpc("take_rate_limit", {
      p_key: `visit:${token}:${ip}`,
      p_limit: 8,
      p_window_seconds: 60,
    });
    if (!allowed) return error("Demasiadas solicitudes. Intentá de nuevo en un momento.", 429);

    const { data: resident } = await admin
      .from("residents")
      .select("id, unit_id, first_name, last_name, display_name")
      .eq("id", residentId)
      .eq("active", true)
      .maybeSingle();

    if (!resident) return error("Residente no encontrado.", 404, "RESIDENT_NOT_FOUND");

    const { data: unit } = await admin
      .from("units")
      .select("id, property_id")
      .eq("id", resident.unit_id)
      .eq("active", true)
      .maybeSingle();

    if (!unit || unit.property_id !== accessPoint.property_id) {
      return error("Residente no pertenece a este acceso.", 403, "RESIDENT_NOT_IN_PROPERTY");
    }

    const trackingToken = crypto.randomUUID();
    const { data: visit, error: visitError } = await admin
      .from("visit_requests")
      .insert({
        access_point_id: accessPoint.id,
        unit_id: unit.id,
        resident_id: resident.id,
        visitor_name: visitorName || null,
        visitor_message: visitorMessage || null,
        visitor_type: visitorType,
        status: "PENDING",
        tracking_token: trackingToken,
      })
      .select("*")
      .single();

    if (visitError) return error("No se pudo crear la solicitud.", 500);

    const targets = await getUnitDevices(admin, unit.id);

    const display = resident.display_name || `${resident.first_name} ${resident.last_name ?? ""}`.trim();
    const messages: ExpoMessage[] = targets.map((d) => ({
      to: d.push_token,
      title: "🔔 Visita entrante",
      body: visitorName
        ? `${visitorName} está en ${accessPoint.name}. Viene a visitar a ${display}.`
        : `Alguien está en ${accessPoint.name}. Viene a visitar a ${display}.`,
      sound: "default",
      priority: "high",
      channelId: "visits",
      data: { type: "visit_request", visitId: visit.id, unitId: unit.id },
    }));

    const pushResult = await sendExpoPush(messages);

    await admin.from("visit_notifications").insert(
      targets.map((d) => ({
        visit_request_id: visit.id,
        device_id: d.id,
        status: pushResult.delivered.includes(d.push_token) ? "SENT" : "FAILED",
        error: pushResult.delivered.includes(d.push_token) ? null : "push_rejected",
      })),
    );

    await admin.from("audit_logs").insert({
      actor_type: "visitor",
      action: "VISIT_CREATED",
      entity_type: "visit_request",
      entity_id: visit.id,
      ip,
      metadata: { access_point_id: accessPoint.id, unit_id: unit.id, resident_id: resident.id },
    });

    return json({
      visitId: visit.id,
      trackingToken,
      status: "PENDING",
      expiresAt: visit.expires_at,
      notifiedDevices: targets.length,
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Error interno", 500);
  }
});
