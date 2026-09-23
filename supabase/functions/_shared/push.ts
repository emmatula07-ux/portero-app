export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound?: string;
  priority?: "default" | "normal" | "high";
  channelId?: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  ok: boolean;
  delivered: string[];
  failed: string[];
  errors: string[];
}

export async function sendExpoPush(messages: ExpoMessage[]): Promise<PushResult> {
  const result: PushResult = { ok: true, delivered: [], failed: [], errors: [] };
  if (messages.length === 0) return result;

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });

  const payload = await res.json();
  const tickets: Array<{ status?: string; message?: string; details?: unknown }> =
    payload?.data ?? [];

  tickets.forEach((ticket, i) => {
    const token = messages[i]?.to;
    if (ticket?.status === "ok") result.delivered.push(token);
    else {
      result.failed.push(token);
      result.errors.push(ticket?.message ?? "unknown");
    }
  });

  result.ok = result.failed.length === 0;
  return result;
}
