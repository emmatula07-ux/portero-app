-- =============================================================
-- SEED — datos de ejemplo para desarrollo local
-- =============================================================

-- Propiedad
insert into public.properties (id, name, type, address, timezone) values
  ('11111111-1111-4111-8111-111111111111', 'Edificio Ejemplo', 'BUILDING', 'Av. Siempre Viva 742', 'America/Argentina/Buenos_Aires');

-- Unidades (una con deuda WARNING para probar alertas)
insert into public.units (id, property_id, building, floor, unit_number, display_name, billing_status, debt_amount, billing_notes) values
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Torre A', '4', '4B', '4B', 'OK', 0, null),
  ('22222222-2222-4222-8222-222222222223', '11111111-1111-4111-8111-111111111111', 'Torre A', '8', '8A', '8A', 'WARNING', 25000, '2 expensas adeudadas');

-- Residentes (4B: Juan + María; 8A: Pedro)
insert into public.residents (id, unit_id, first_name, last_name, display_name, role) values
  ('55555555-5555-4555-8555-555555555551', '22222222-2222-4222-8222-222222222222', 'Juan', 'Pérez', 'Juan Pérez', 'OWNER'),
  ('55555555-5555-4555-8555-555555555552', '22222222-2222-4222-8222-222222222222', 'María', 'López', 'María López', 'FAMILY'),
  ('55555555-5555-4555-8555-555555555553', '22222222-2222-4222-8222-222222222223', 'Pedro', 'García', 'Pedro García', 'OWNER');

-- Controlador (mock)
insert into public.access_controllers (id, property_id, name, type, status) values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Controlador Mock', 'MOCK', 'ONLINE');

-- Accesos (QR tokens de desarrollo; en producción usar UUID aleatorios)
insert into public.access_points (id, property_id, access_controller_id, name, type, qr_token) values
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Entrada principal', 'MAIN_ENTRANCE', 'dev_entrada_principal'),
  ('44444444-4444-4444-8444-444444444445', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Entrada cochera', 'VEHICLE_GATE', 'dev_entrada_cochera');

-- Permisos de apertura: 4B abre ambos; 8A solo principal
insert into public.access_permissions (unit_id, access_point_id, granted) values
  ('22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', true),
  ('22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444445', true),
  ('22222222-2222-4222-8222-222222222223', '44444444-4444-4444-8444-444444444444', true);

-- Invitación de ejemplo para reclamar la unidad 4B (Juan Pérez)
insert into public.invitations (unit_id, resident_id, token, status) values
  ('22222222-2222-4222-8222-222222222222', '55555555-5555-4555-8555-555555555551', 'DEV_INVITE_4B', 'PENDING');
