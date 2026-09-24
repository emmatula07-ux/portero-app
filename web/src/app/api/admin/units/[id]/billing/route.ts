import { guard, json, err, canAccessUnit } from "@/lib/admin";
import { sendExpoPush, getUnitDevices } from "@/lib/push";

const VALID = ["OK", "WARNING", "BLOCKED"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (g.unauthorized) return err("No autorizado", 401);
  const admin = g.admin;
  const { id } = await params;
  if (!(await canAccessUnit(admin, g.actor, id))) return err("No autorizado sobre esta unidad", 403);

  const body = await req.json().catch(() => ({}));
  const billingStatus = String(body.billingStatus ?? "").toUpperCase();
  const debtAmount = body.debtAmount != null ? Number(body.debtAmount) : 0;
  const notes = body.notes ?? null;

  if (!VALID.includes(billingStatus)) return err("Estado inválido (OK | WARNING | BLOCKED)", 400);

  const { data: unit } = await admin
    .from("units")
    .select("id, display_name, unit_number, billing_status")
    .eq("id", id)
    .maybeSingle();
  if (!unit) return err("Unidad no encontrada", 404);

  const { data: updated, error } = await admin
    .from("units")
    .update({
      billing_status: billingStatus,
      debt_amount: debtAmount,
      billing_notes: notes,
      billing_updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return err(error.message, 500);

  const devices = await getUnitDevices(admin, id);

  const title =
    billingStatus === "BLOCKED"
      ? "🚫 Acceso bloqueado por deuda"
      : billingStatus === "WARNING"
      ? "⚠️ Aviso de expensas"
      : "✅ Expensas al día";

  const bodyText =
    billingStatus === "BLOCKED"
      ? "Tu apertura de acceso está bloqueada por deuda de expensas. Contactá a la administración."
      : billingStatus === "WARNING"
      ? "Tenés expensas pendientes. Regularizá para evitar el bloqueo de acceso."
      : "Tu situación de expensas está regularizada.";

  await sendExpoPush(
    devices.map((d) => ({
      to: d.push_token,
      title,
      body: bodyText,
      sound: "default",
      priority: "high",
      channelId: "billing",
      data: { type: "billing_update", unitId: id, billingStatus },
    })),
  );

  await admin.from("audit_logs").insert({
    actor_type: "user",
    actor_id: g.actor.userId,
    action: "BILLING_STATUS_UPDATED",
    entity_type: "unit",
    entity_id: id,
    metadata: { from: unit.billing_status, to: billingStatus, debt_amount: debtAmount, notified_devices: devices.length },
  });

  return json({ unit: updated, notifiedDevices: devices.length });
}
