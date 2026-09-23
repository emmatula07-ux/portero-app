-- =============================================================
-- PORTERO / TIMBRE INTELIGENTE — Schema inicial
-- Supabase / PostgreSQL
-- =============================================================

-- ---------- ENUMS ----------
create type public.property_type as enum ('BUILDING','CONDOMINIUM','GATED_COMMUNITY','HOUSE','OFFICE','OTHER');
create type public.access_point_type as enum ('PEDESTRIAN_DOOR','VEHICLE_GATE','MAIN_ENTRANCE','ELEVATOR_ACCESS','OTHER');
create type public.access_controller_type as enum ('MOCK','LOCAL_GATEWAY','HTTP','MQTT','VENDOR');
create type public.controller_status as enum ('ONLINE','OFFLINE','UNKNOWN');
create type public.resident_role as enum ('OWNER','TENANT','FAMILY','STAFF');
create type public.device_platform as enum ('ANDROID','IOS','WEB');
create type public.visit_status as enum ('PENDING','ACCEPTED','REJECTED','EXPIRED','CANCELLED');
create type public.visitor_type as enum ('VISITOR','DELIVERY');
create type public.action_type as enum ('OPEN','CLOSE','STATUS');
create type public.action_status as enum ('REQUESTED','COMMAND_SENT','COMMAND_CONFIRMED','EXECUTED','FAILED');
create type public.billing_status as enum ('OK','WARNING','BLOCKED');

-- ---------- HELPERS ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- TABLAS ----------

-- Identidad del usuario (1:1 con auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.property_type not null default 'BUILDING',
  address text,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  tower text,
  building text,
  floor text,
  unit_number text not null,
  display_name text,
  active boolean not null default true,
  billing_status public.billing_status not null default 'OK',
  debt_amount numeric(12,2) not null default 0,
  billing_notes text,
  billing_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.residents (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text,
  display_name text,
  role public.resident_role not null default 'OWNER',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.access_controllers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  type public.access_controller_type not null default 'MOCK',
  config jsonb,
  status public.controller_status not null default 'UNKNOWN',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.access_points (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  access_controller_id uuid references public.access_controllers(id) on delete set null,
  name text not null,
  type public.access_point_type not null default 'MAIN_ENTRANCE',
  qr_token text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Permiso: qué unidad puede abrir qué acceso
create table public.access_permissions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  access_point_id uuid not null references public.access_points(id) on delete cascade,
  granted boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, access_point_id)
);

create table public.resident_devices (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid references public.residents(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  platform public.device_platform not null,
  push_token text not null,
  device_name text,
  active boolean not null default true,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.visit_requests (
  id uuid primary key default gen_random_uuid(),
  access_point_id uuid not null references public.access_points(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete set null,
  visitor_name text,
  visitor_message text,
  visitor_type public.visitor_type not null default 'VISITOR',
  status public.visit_status not null default 'PENDING',
  tracking_token text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  responded_at timestamptz,
  responded_by_device_id uuid,
  updated_at timestamptz not null default now()
);

create table public.visit_notifications (
  id uuid primary key default gen_random_uuid(),
  visit_request_id uuid not null references public.visit_requests(id) on delete cascade,
  device_id uuid not null references public.resident_devices(id) on delete cascade,
  status text not null default 'SENT',
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table public.access_actions (
  id uuid primary key default gen_random_uuid(),
  visit_request_id uuid references public.visit_requests(id) on delete set null,
  resident_id uuid references public.residents(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  access_point_id uuid not null references public.access_points(id) on delete cascade,
  action public.action_type not null default 'OPEN',
  status public.action_status not null default 'REQUESTED',
  requested_at timestamptz not null default now(),
  executed_at timestamptz,
  failure_reason text,
  device_id uuid,
  nonce uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text,
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  ip text,
  user_agent text,
  device_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete set null,
  token text unique not null,
  email text,
  phone text,
  status text not null default 'PENDING',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text primary key,
  count int not null default 0,
  reset_at timestamptz not null
);

-- ---------- TRIGGERS updated_at ----------
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_properties_updated before update on public.properties for each row execute function public.set_updated_at();
create trigger trg_units_updated before update on public.units for each row execute function public.set_updated_at();
create trigger trg_residents_updated before update on public.residents for each row execute function public.set_updated_at();
create trigger trg_access_controllers_updated before update on public.access_controllers for each row execute function public.set_updated_at();
create trigger trg_access_points_updated before update on public.access_points for each row execute function public.set_updated_at();
create trigger trg_access_permissions_updated before update on public.access_permissions for each row execute function public.set_updated_at();
create trigger trg_resident_devices_updated before update on public.resident_devices for each row execute function public.set_updated_at();
create trigger trg_visit_requests_updated before update on public.visit_requests for each row execute function public.set_updated_at();
create trigger trg_access_actions_updated before update on public.access_actions for each row execute function public.set_updated_at();

-- ---------- AUTO PROFILE ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- ÍNDICES ----------
create index idx_units_property on public.units(property_id);
create index idx_residents_unit on public.residents(unit_id);
create index idx_residents_profile on public.residents(profile_id);
create index idx_access_points_property on public.access_points(property_id);
create index idx_access_permissions_unit on public.access_permissions(unit_id);
create index idx_resident_devices_profile on public.resident_devices(profile_id);
create index idx_resident_devices_resident on public.resident_devices(resident_id);
create index idx_visit_requests_unit on public.visit_requests(unit_id);
create index idx_visit_requests_status on public.visit_requests(status);
create index idx_visit_requests_expires on public.visit_requests(expires_at);
create index idx_access_actions_profile on public.access_actions(profile_id);
create unique index idx_resident_devices_token on public.resident_devices(push_token);

-- ---------- FUNCIONES DE NEGOCIO (usadas por Edge Functions con service_role) ----------

-- Búsqueda acotada de residentes para un acceso (anti-directorio)
create or replace function public.search_residents_by_access(p_token text, p_query text)
returns table (
  id uuid,
  display_name text,
  first_name text,
  unit_display_name text,
  building text,
  floor text,
  unit_number text
)
language sql stable security definer set search_path = public as $$
  with ap as (
    select property_id from public.access_points
    where qr_token = p_token and active
    limit 1
  )
  select
    r.id,
    r.display_name,
    r.first_name,
    u.display_name,
    u.building,
    u.floor,
    u.unit_number
  from public.residents r
  join public.units u on u.id = r.unit_id and u.active
  where r.active
    and u.property_id = (select property_id from ap)
    and (
      r.first_name ilike '%' || p_query || '%'
      or r.last_name ilike '%' || p_query || '%'
      or r.display_name ilike '%' || p_query || '%'
      or u.unit_number ilike '%' || p_query || '%'
      or u.display_name ilike '%' || p_query || '%'
    )
  order by r.display_name
  limit 8;
$$;

-- Lazy-expiry de una visita (sin cron en free tier)
create or replace function public.effective_visit_status(v public.visit_requests)
returns public.visit_status language sql stable as $$
  select case
    when v.status = 'PENDING' and v.expires_at < now() then 'EXPIRED'::public.visit_status
    else v.status
  end $$;

-- Rate limiting simple basado en tabla (sin Redis)
create or replace function public.take_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    insert into public.rate_limits (key, count, reset_at)
    values (p_key, 1, now() + make_interval(secs => p_window_seconds))
    on conflict (key) do update
      set count = case
            when public.rate_limits.reset_at < now() then 1
            else public.rate_limits.count + 1
          end,
          reset_at = case
            when public.rate_limits.reset_at < now() then now() + make_interval(secs => p_window_seconds)
            else public.rate_limits.reset_at
          end
    returning count, reset_at
  )
  select (count <= p_limit) from updated;
$$;

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.residents enable row level security;
alter table public.access_controllers enable row level security;
alter table public.access_points enable row level security;
alter table public.access_permissions enable row level security;
alter table public.resident_devices enable row level security;
alter table public.visit_requests enable row level security;
alter table public.visit_notifications enable row level security;
alter table public.access_actions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.invitations enable row level security;
alter table public.rate_limits enable row level security;

-- profiles: cada usuario ve y edita su propio perfil
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- properties: visibles para residentes de esa propiedad
create policy properties_select_member on public.properties for select to authenticated using (
  exists (
    select 1 from public.units u
    join public.residents r on r.unit_id = u.id
    where r.profile_id = auth.uid() and r.active and u.property_id = properties.id
  )
);

-- units: visibles para sus residentes
create policy units_select_member on public.units for select to authenticated using (
  exists (
    select 1 from public.residents r
    where r.profile_id = auth.uid() and r.active and r.unit_id = units.id
  )
);

-- residents: el propio + compañeros de su unidad
create policy residents_select_unit on public.residents for select to authenticated using (
  profile_id = auth.uid()
  or unit_id in (select r2.unit_id from public.residents r2 where r2.profile_id = auth.uid() and r2.active)
);

-- access_points: visibles para residentes de la propiedad
create policy access_points_select_member on public.access_points for select to authenticated using (
  exists (
    select 1 from public.units u
    join public.residents r on r.unit_id = u.id
    where r.profile_id = auth.uid() and r.active and u.property_id = access_points.property_id
  )
);

-- access_permissions: visibles para su unidad
create policy access_permissions_select_member on public.access_permissions for select to authenticated using (
  unit_id in (select r.unit_id from public.residents r where r.profile_id = auth.uid() and r.active)
);

-- resident_devices: gestionables por su propietario
create policy devices_select_own on public.resident_devices for select to authenticated using (profile_id = auth.uid());
create policy devices_insert_own on public.resident_devices for insert to authenticated with check (profile_id = auth.uid());
create policy devices_update_own on public.resident_devices for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy devices_delete_own on public.resident_devices for delete to authenticated using (profile_id = auth.uid());

-- visit_requests: visibles para residentes de la unidad; pueden responder
create policy visits_select_member on public.visit_requests for select to authenticated using (
  unit_id in (select r.unit_id from public.residents r where r.profile_id = auth.uid() and r.active)
);
create policy visits_update_member on public.visit_requests for update to authenticated
  using (unit_id in (select r.unit_id from public.residents r where r.profile_id = auth.uid() and r.active))
  with check (unit_id in (select r.unit_id from public.residents r where r.profile_id = auth.uid() and r.active));

-- access_actions: visibles y creadas por su actor
create policy actions_select_own on public.access_actions for select to authenticated using (profile_id = auth.uid());
create policy actions_insert_own on public.access_actions for insert to authenticated with check (profile_id = auth.uid());
