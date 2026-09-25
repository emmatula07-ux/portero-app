-- =============================================================
-- 0004 — Registro de quién reclamó cada invitación
-- =============================================================

alter table public.invitations
  add column claimed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column claimed_at timestamptz;

create index idx_invitations_claimed_by on public.invitations(claimed_by_profile_id);
