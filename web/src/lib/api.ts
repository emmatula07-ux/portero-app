export interface ResidentResult {
  id: string;
  display_name: string;
  unit_display_name: string | null;
  building: string | null;
  floor: string | null;
  unit_number: string | null;
}

export type VisitStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";

const BASE =
  process.env.NEXT_PUBLIC_FUNCTIONS_URL ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
    : undefined);

function fn(name: string): string {
  if (!BASE) throw new Error("NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_FUNCTIONS_URL no está configurado.");
  return `${BASE}/${name}`;
}

async function post(name: string, body: unknown): Promise<unknown> {
  const res = await fetch(fn(name), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { error?: string }).error ?? "Ocurrió un error. Intentá de nuevo.";
    throw new Error(message);
  }
  return data;
}

export async function searchResidents(token: string, query: string): Promise<ResidentResult[]> {
  const data = (await post("search-residents", { token, query })) as {
    results?: ResidentResult[];
  };
  return data.results ?? [];
}

export async function createVisit(input: {
  token: string;
  residentId: string;
  visitorName?: string;
  visitorMessage?: string;
  visitorType?: "VISITOR" | "DELIVERY";
}): Promise<{ visitId: string; trackingToken: string; status: VisitStatus; expiresAt: string }> {
  return (await post("create-visit", input)) as {
    visitId: string;
    trackingToken: string;
    status: VisitStatus;
    expiresAt: string;
  };
}

export async function getVisitStatus(
  trackingToken: string,
): Promise<{ visitId: string; status: VisitStatus; expiresAt: string }> {
  return (await post("visit-status", { trackingToken })) as {
    visitId: string;
    status: VisitStatus;
    expiresAt: string;
  };
}
