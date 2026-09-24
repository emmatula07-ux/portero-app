-- =============================================================
-- 0002 — Privacidad de búsqueda (nombres ofuscados) + matching
-- =============================================================

-- Normaliza texto: minúsculas y sin tildes.
create or replace function public.normalize_name(input text)
returns text language sql immutable as $$
  select lower(
    translate(
      coalesce(input, ''),
      'áéíóúüñÁÉÍÓÚÜÑ',
      'aeiouunaeiouun'
    )
  );
$$;

-- Ofusca un nombre: "Juan Pérez" -> "J*** P****"
create or replace function public.obfuscate_name(input text)
returns text language sql immutable as $$
  select array_to_string(
    array(
      select left(w, 1) || repeat('*', greatest(char_length(w) - 1, 0))
      from unnest(string_to_array(coalesce(input, ''), ' ')) as w
      where w <> ''
    ),
    ' '
  );
$$;

-- Cuenta cuántas palabras DISTINTAS de `q` matchean (por prefijo) palabras de `n`.
create or replace function public.name_match_count(q text, n text)
returns int language sql immutable as $$
  with qw as (
    select distinct w
    from unnest(regexp_split_to_array(
      regexp_replace(public.normalize_name(q), '[^a-z0-9]+', ' ', 'g'), ' '
    )) as w
    where w <> ''
  ), nw as (
    select distinct w
    from unnest(regexp_split_to_array(
      regexp_replace(public.normalize_name(n), '[^a-z0-9]+', ' ', 'g'), ' '
    )) as w
    where w <> ''
  )
  select count(*)::int
  from qw
  where exists (select 1 from nw where nw.w like qw.w || '%');
$$;

-- Reemplaza la búsqueda: nombres ofuscados + matching de >= 2 palabras (o por unidad).
drop function if exists public.search_residents_by_access(text, text);

create function public.search_residents_by_access(p_token text, p_query text)
returns table (
  id uuid,
  display_name text,
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
    public.obfuscate_name(coalesce(r.display_name, r.first_name || ' ' || coalesce(r.last_name, ''))) as display_name,
    u.display_name as unit_display_name,
    u.building,
    u.floor,
    u.unit_number
  from public.residents r
  join public.units u on u.id = r.unit_id and u.active
  where r.active
    and u.property_id = (select property_id from ap)
    and (
      public.name_match_count(p_query, concat_ws(' ', r.first_name, r.last_name, r.display_name)) >= 2
      or public.normalize_name(u.unit_number) = public.normalize_name(p_query)
      or public.normalize_name(u.display_name) = public.normalize_name(p_query)
    )
  order by r.display_name
  limit 8;
$$;
