import { supabase, FUNCTIONS_URL } from "./supabase";

async function callFn<T>(
  name: string,
  body: unknown,
): Promise<{ data?: T; error?: string }> {
  if (!FUNCTIONS_URL) return { error: "Falta EXPO_PUBLIC_SUPABASE_URL" };
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { error: "No autenticado" };

  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (data as { error?: string })?.error ?? "Error" };
  return { data: data as T };
}

export interface OpenResult {
  actionId: string;
  status: string;
  accessPointId: string;
  billingStatus: string;
}

export function openAccess(input: { visitId?: string; accessPointId?: string }) {
  return callFn<OpenResult>("open-access", input);
}

export interface ClaimResult {
  unitId: string;
  residentId: string;
}

export function claimInvitation(token: string) {
  return callFn<ClaimResult>("claim-invitation", { token });
}
