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

async function callFnPublic<T>(
  name: string,
  body: unknown,
): Promise<{ data?: T; error?: string }> {
  if (!FUNCTIONS_URL) return { error: "Falta EXPO_PUBLIC_SUPABASE_URL" };
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (data as { error?: string })?.error ?? "Error" };
  return { data: data as T };
}

export interface ValidateInvitationResult {
  valid: boolean;
  role: string;
  email: string | null;
}

export function validateInvitation(token: string) {
  return callFnPublic<ValidateInvitationResult>("validate-invitation", { token });
}

export interface RegisterResult {
  ok: boolean;
  role: string;
}

export function registerWithInvitation(input: { token: string; email: string; password: string }) {
  return callFnPublic<RegisterResult>("register-with-invitation", input);
}

export function registerDevice(input: { push_token: string; platform: string; device_name: string }) {
  return callFn<{ ok: boolean }>("register-device", input);
}

export function revokeDevice(push_token: string) {
  return callFn<{ ok: boolean }>("revoke-device", { push_token });
}
