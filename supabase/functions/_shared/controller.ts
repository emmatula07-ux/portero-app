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

export function getController(type: string | null | undefined): AccessController {
  switch (type) {
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
