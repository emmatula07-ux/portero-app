-- =============================================================
-- 0003 — Control de roles (RBAC)
--   DEVELOPER  -> dueño de la plataforma, acceso total
--   ADMIN      -> administra 1 o más edificios asignados
--   RESIDENT   -> propietario/inquilino (por defecto)
-- =============================================================

create type public.user_role as enum ('DEVELOPER', 'ADMIN', 'RESIDENT');

alter table public.profiles
  add column role public.user_role not null default 'RESIDENT';

create table public.property_admins (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (property_id, profile_id)
);

create index idx_property_admins_profile on public.property_admins(profile_id);
create index idx_property_admins_property on public.property_admins(property_id);

alter table public.property_admins enable row level security;

-- Cada usuario ve solo sus propias asignaciones (el panel usa service role y bypassa RLS)
create policy property_admins_select_self on public.property_admins
  for select to authenticated using (profile_id = auth.uid());
