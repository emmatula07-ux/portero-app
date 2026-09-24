# Portero / Timbre Inteligente

Portero digital para edificios y barrios: el visitante escanea un QR, busca al residente y avisa; el propietario recibe una notificación con sonido, acepta y abre el acceso. Incluye control de **deuda de expensas** (`OK / WARNING / BLOCKED`) que puede bloquear la apertura.

**Costo: $0** en el MVP (Supabase free tier + Vercel free + push FCM/APNs gratis).

---

## Qué incluye

- **Web visitante** (`/access/<token>`): escanea QR → busca → avisa → ve el estado. Sin app, sin cuenta.
- **Panel de administración** (`/admin`): unidades, residentes, accesos (QR), permisos, controladores, invitaciones, deuda de expensas, visitas y auditoría.
- **App propietario** (Expo): login por email, push con sonido, aceptar/rechazar, abrir puerta, estado de expensas.
- **Backend** (Supabase): base de datos, autenticación, tiempo real y Edge Functions.
- **Hardware desacoplado**: controlador `MOCK` (simulado) listo; `LOCAL_GATEWAY` (HTTP) para un relay real.

---

## Requisitos

1. **Node.js** (ya instalado, versión 18 o superior).
2. Una cuenta gratuita en **https://supabase.com**.
3. La **Supabase CLI** (ya instalada en este equipo).

> **No hace falta Docker.** La base de datos y las funciones corren en el plan gratis de Supabase (nube). Solo la web y la app móvil corren en tu PC. Si querés TODO 100% local (sin nube), necesitás Docker Desktop — ver la sección "Opción 100% local" al final.

---

## Puesta en marcha (4 pasos)

### Paso 1 — Crear el proyecto en Supabase (una vez, ~5 min)

1. Entrá a **https://supabase.com** → **Start your project** → creá un proyecto (nombre libre, región cercana, plan **gratis**).
2. Esperá a que termine (unos minutos).
3. Andá a **Project Settings → API** y anotá estos 3 valores:
   - **Project URL** (ej. `https://abcd1234.supabase.co`)
   - **anon public key**
   - **service_role key** (secreta)

### Paso 2 — Configurar las claves (1 min)

En PowerShell, en la carpeta del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

El script pide los 3 valores del Paso 1 y una **clave de administrador** (podés dejarla vacía y te genera una — **guardala**, la usás para entrar al panel). Escribe los archivos de configuración automáticamente.

### Paso 3 — Crear la base de datos (2 copiar-pegar)

En **https://supabase.com/dashboard** → tu proyecto → **SQL Editor** → **New query**:

1. Abrí el archivo `supabase/migrations/0001_init.sql`, copiá **todo** y pegalo. Presioná **Run**.
2. Hacé lo mismo con `supabase/migrations/0002_search_privacy.sql` (privacidad de nombres en la búsqueda).
3. Por último `supabase/seed.sql`.

### Paso 4 — Desplegar las funciones y arrancar

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
```

(Se abre el navegador para iniciar sesión en Supabase una sola vez; después despliega las 5 funciones. Te pide el **Project ref**, que está en **Project Settings → General**.)

Luego, para arrancar web + app:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run.ps1
```

Se abren 2 ventanas: la **web** (puerto 3000) y la **app móvil** (Expo).

---

## Probarlo

### Visitante (navegador)
```
http://localhost:3000/access/dev_entrada_principal
```
Buscá `Juan` → seleccioná `Juan Pérez` → poné tu nombre → **Avisar**.

### Panel de administración
```
http://localhost:3000/admin
```
Ingresá la clave de administrador. Ahí podés:
- **Unidades** → cambiar estado de expensas (`OK`/`WARNING`/`BLOCKED`) y monto de deuda.
- **Accesos** → ver el QR de cada entrada y rotarlo.
- **Invitaciones** → generar un código para que un propietario asocie su teléfono.
- **Visitas / Auditoría** → ver todo lo registrado.

### Propietario (app móvil)
1. En la ventana de Expo, escaneá el QR con tu teléfono (app **Expo Go**, gratis).
2. Ingresá tu email → te llega un código → ingresalo.
3. Ingresá el **código de invitación** `DEV_INVITE_4B` (viene en el seed).
4. Quedás asociado a la unidad 4B. Enviá una visita desde el navegador y la verás en la app: podés **Aceptar** y **Abrir puerta**.

> **Push en un teléfono real:** en Android funciona dentro de Expo Go. En iOS (y para producción) se necesita un build de desarrollo. Para generar el `projectId` de Expo una sola vez:
> ```powershell
> cd mobile
> npx eas init
> ```

---

## Probar el bloqueo por deuda

1. En `/admin` → **Unidades** → en `4B` presioná **BLOCKED** (poné un monto, ej. `50000`).
2. El propietario de 4B recibe la alerta "Acceso bloqueado por deuda".
3. Si intenta **Abrir puerta**, la app se lo impide (`BILLING_BLOCKED`).

---

## Desplegar a producción (opcional)

- **Web** (visitante + admin): subí la carpeta `web/` a **Vercel** (gratis) conectando este repositorio. En Vercel, configurá las variables de entorno del archivo `web/.env.local.example` (para producción, **quitá** la línea `NEXT_PUBLIC_FUNCTIONS_URL`).
- **App móvil**: `npx eas build` (requiere cuenta Expo) para generar APK/IPA.

---

## Hardware real

El sistema usa una abstracción `AccessController`. Por defecto usa `MOCK` (simula la apertura). Para un relay real:

1. En `/admin` → **Controladores** → agregá uno tipo **Gateway local (HTTP)** con la URL del dispositivo (ESP32/Raspberry Pi) y un secreto.
2. Asigná ese controlador a un **Acceso**.

El backend hará `POST` a la URL del gateway con `{ "action": "OPEN", "accessPointId", "ts" }` y espera `{ "result": "OPENED" }`.

---

## Opción 100% local (opcional, requiere Docker Desktop)

Si querés que **todo** (base de datos, auth y funciones) corra en tu PC sin usar la nube de Supabase:

1. Instalá **Docker Desktop** (https://docs.docker.com/desktop/) y arrancalo.
2. En la carpeta `supabase/`:
   ```powershell
   supabase start          # levanta Postgres + Auth + Realtime en localhost:54321
   supabase db reset       # aplica migraciones + seed
   ```
3. En `web/.env.local` usá:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   SUPABASE_SERVICE_ROLE_KEY=<la que imprime supabase start>
   ADMIN_SECRET=lo-que-quieras
   ```
4. En `mobile/.env` usá las claves locales que imprime `supabase start`.
5. Arrancá web + mobile con `scripts/run.ps1` (en este modo las funciones se corren con `supabase functions serve`).

---

## Estructura

```
supabase/
  migrations/0001_init.sql      # schema + seguridad (RLS)
  migrations/0002_search_privacy.sql  # búsqueda con nombres ofuscados
  seed.sql                      # datos de ejemplo
  functions/                    # Edge Functions (search-residents, create-visit, visit-status, open-access, claim-invitation)
web/                            # web visitante + panel admin (Next.js)
mobile/                         # app propietario (Expo)
scripts/                        # setup.ps1, deploy.ps1, run.ps1
```

## Problemas frecuentes

- **"NEXT_PUBLIC_SUPABASE_URL no está configurado"** → no ejecutaste `setup.ps1`.
- **"Este acceso no está disponible"** → la tabla `access_points` está vacía → corré `seed.sql` otra vez.
- **Error al desplegar funciones** → asegurate de haber hecho `supabase login` y de usar el `Project ref` correcto.
- **El push no llega al teléfono** → ver nota "Push en un teléfono real".
