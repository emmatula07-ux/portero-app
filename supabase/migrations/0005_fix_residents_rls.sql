-- =============================================================
-- 0005 — Fix recursión infinita en la policy RLS de residents
-- =============================================================

-- La policy original de `residents` se referenciaba a sí misma
-- (`unit_id in (select unit_id from residents ...)`), lo que provoca
-- "infinite recursion detected in policy for relation residents".
-- Solución: mover la búsqueda de "mis unidades" a una función
-- SECURITY DEFINER (corre como dueño y saltea RLS), evitando la recursión.

create or replace function public.get_my_unit_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select unit_id
  from public.residents
  where profile_id = auth.uid() and active
$$;

drop policy if exists residents_select_unit on public.residents;

create policy residents_select_unit on public.residents
  for select to authenticated
  using (
    profile_id = auth.uid()
    or unit_id in (select get_my_unit_ids())
  );
