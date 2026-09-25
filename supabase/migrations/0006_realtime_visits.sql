-- =============================================================
-- 0006 — Realtime para visit_requests (auto-refresh de la app)
-- =============================================================

-- Permite que la app reciba eventos postgres_changes de visit_requests
-- (nueva visita / aceptada / rechazada) sin tener que refrescar a mano.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'visit_requests'
  ) then
    alter publication supabase_realtime add table public.visit_requests;
  end if;
end $$;

-- Necesario para recibir los UPDATE (aceptar/rechazar) y DELETE por realtime.
alter table public.visit_requests replica identity full;
