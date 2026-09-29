-- =============================================================
-- 0008 — Invitaciones para administradores (por edificio)
-- =============================================================

-- Las invitaciones de residentes apuntan a una unidad; las de
-- administradores apuntan a un edificio. Por eso unit_id pasa a
-- ser opcional y se agrega property_id.
alter table public.invitations alter column unit_id drop not null;

alter table public.invitations
  add column property_id uuid references public.properties(id) on delete cascade;

create index idx_invitations_property on public.invitations(property_id);
