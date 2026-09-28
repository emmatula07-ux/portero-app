-- =============================================================
-- 0007 — Config por edificio: control de puerta (apertura remota)
-- =============================================================

-- Si door_control_enabled = false, el edificio NO tiene mecanismos
-- de apertura remota: la app solo muestra "Aceptar" y al visitante
-- se le indica que lo van a atender en persona.
alter table public.properties
  add column door_control_enabled boolean not null default true;
