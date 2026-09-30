// Abstracción de controladores de acceso.
// Permite sumar fabricantes sin tocar la lógica de negocio.

export type OpenOutcome =
  | { ok: true; status: "EXECUTED" }
  | { ok: false; reason: string };

export interface OpenContext {
  accessPointId: string;
  config: unknown;
}

export interface AccessController {
  type: string;
  open(ctx: OpenContext): Promise<OpenOutcome>;
}

class MockController implements AccessController {
  type = "MOCK";
  async open(): Promise<OpenOutcome> {
    return { ok: true, status: "EXECUTED" };
  }
}

class HttpGatewayController implements AccessController {
  type = "LOCAL_GATEWAY";
  async open(ctx: OpenContext): Promise<OpenOutcome> {
    const cfg = (ctx.config ?? {}) as { url?: string; secret?: string };
    if (!cfg.url) return { ok: false, reason: "gateway_not_configured" };
    try {
      const res = await fetch(cfg.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cfg.secret ? { Authorization: `Bearer ${cfg.secret}` } : {}),
        },
        body: JSON.stringify({
          action: "OPEN",
          accessPointId: ctx.accessPointId,
          ts: Date.now(),
        }),
      });
      if (!res.ok) return { ok: false, reason: `gateway_http_${res.status}` };
      const data = await res.json().catch(() => ({}));
      if (data?.result !== "OPENED") return { ok: false, reason: "gateway_no_confirm" };
      return { ok: true, status: "EXECUTED" };
    } catch {
      return { ok: false, reason: "gateway_unreachable" };
    }
  }
}

// Shelly (Gen2/Gen3/Gen4) — relé de contacto seco vía API RPC local.
// config: { url: "http://<ip>", pulseMs: 1000, secret?: "..." }
class ShellyController implements AccessController {
  type = "SHELLY";
  async open(ctx: OpenContext): Promise<OpenOutcome> {
    const cfg = (ctx.config ?? {}) as { url?: string; pulseMs?: number; secret?: string };
    const base = (cfg.url ?? "").trim().replace(/\/+$/, "");
    if (!base) return { ok: false, reason: "shelly_not_configured" };

    const auth = cfg.secret ? `&auth=${encodeURIComponent(cfg.secret)}` : "";
    const pulseMs = Math.max(Number(cfg.pulseMs) || 1000, 300);

    try {
      const onUrl = `${base}/rpc/Switch.Set?id=0&on=true${auth}`;
      const onRes = await fetch(onUrl, { method: "GET" });
      if (!onRes.ok) return { ok: false, reason: `shelly_http_${onRes.status}` };

      // Pulso de "abra": mantener cerrado unos ms y luego abrir.
      await new Promise((r) => setTimeout(r, pulseMs));
      const offUrl = `${base}/rpc/Switch.Set?id=0&on=false${auth}`;
      await fetch(offUrl, { method: "GET" }).catch(() => undefined);

      return { ok: true, status: "EXECUTED" };
    } catch {
      return { ok: false, reason: "shelly_unreachable" };
    }
  }
}

export function getController(type: string | null | undefined): AccessController {
  switch (type) {
    case "SHELLY":
      return new ShellyController();
    case "HTTP":
    case "LOCAL_GATEWAY":
      return new HttpGatewayController();
    case "MQTT":
    case "VENDOR":
    case "MOCK":
    default:
      return new MockController();
  }
}
