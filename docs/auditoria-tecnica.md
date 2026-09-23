# PORTERO / TIMBRE INTELIGENTE — Auditoría Técnica y de Producto

> Estado: **FASE 0 — Investigación tecnológica (pre-implementación)**
> Objetivo: definir la arquitectura antes de escribir código.
> Regla: ninguna capacidad se declara "implementada" por tener solo una pantalla o una interfaz.

---

## 0. Resumen ejecutivo

La solución separa **tres actores** con necesidades técnicas distintas, que NO deben resolverse con la misma tecnología:

| Actor | Canal | Tecnología recomendada | Razón |
|-------|-------|------------------------|-------|
| **Visitante** | Escanea QR → navegador | **Web responsive (sin app)** | Cero fricción, sin instalación, sin cuenta |
| **Propietario/residente** | Teléfono | **App nativa/cross-platform** (React Native + Expo) | Push confiable + sonido + background + pantalla bloqueada + apertura |
| **Administrador** | Navegador | **Web (panel SPA)** | Gestión multi-tenant |

La experiencia "tipo llamada" se consigue con **push de alta prioridad + sonido** como base, y **full-screen intent (Android)** / **CallKit (iOS)** como mejora opcional, no como requisito del MVP.

La apertura física **nunca** va directa del teléfono al relay. Siempre: `App → Backend (autoriza) → AccessController (abstracción) → Relay → Puerta`.

---

## 1. Requisitos funcionales

### 1.1 Visitante (sin cuenta, sin app)
- RF-V1: Escanear QR colocado en el acceso con la cámara nativa del teléfono.
- RF-V2: El QR abre una URL HTTPS pública (`https://dominio/access/<token>`).
- RF-V3: Buscar residente por nombre / apellido / departamento / unidad / alias.
- RF-V4: Ver resultados acotados (no directorio completo).
- RF-V5: Seleccionar el residente/unidad correcto.
- RF-V6: Ingresar opcionalmente nombre del visitante y mensaje (mín. 0 campos obligatorios extra).
- RF-V7: Enviar la solicitud de visita.
- RF-V8: Ver estado de la solicitud (enviada / aceptada / rechazada / expirada) en pantalla.
- RF-V9: Distinguir caso "repartidor / delivery".

### 1.2 Propietario / residente
- RF-P1: Registrarse / aceptar invitación a una unidad (onboarding sin fricción).
- RF-P2: Asociar uno o más dispositivos a su identidad.
- RF-P3: Recibir notificación push con sonido/vibración.
- RF-P4: Ver alerta visible tipo llamada (quién, desde dónde, mensaje).
- RF-P5: Aceptar / rechazar la visita.
- RF-P6: Pulsar "Abrir acceso" (acción separada y autorizada).
- RF-P7: Recibir feedback real del resultado de apertura (no asumir éxito al enviar).
- RF-P8: Consultar historial de visitas y aperturas.
- RF-P9: Configurar notificaciones, sonido, dispositivos.
- RF-P10: Revocar dispositivos / cerrar sesión.

### 1.3 Administrador
- RF-A1: Gestionar propiedades/edificios (multi-tenant).
- RF-A2: Gestionar unidades (crear, editar, importar, asignar residentes).
- RF-A3: Gestionar residentes (crear, invitar, desactivar, transferir unidad).
- RF-A4: Gestionar accesos (crear, QR, activar/desactivar).
- RF-A5: Gestionar controladores de acceso y su estado.
- RF-A6: Consultar auditoría (visitas, aperturas, errores, dispositivos).

### 1.4 Sistema
- RF-S1: Generar QR único y revocable por acceso.
- RF-S2: Registrar toda operación para auditoría.
- RF-S3: Expirar solicitudes de visita (ventana configurable).
- RF-S4: Aplicar permisos por acceso (no todos pueden abrir todo).
- RF-S5: Protección contra abuso (rate limiting, anti-scraping, anti-flooding).

---

## 2. Requisitos no funcionales

| Código | Requisito | Métrica objetivo |
|--------|-----------|------------------|
| RNF-1 | Latencia push (envío→llegada) | < 3 s en condiciones normales |
| RNF-2 | Latencia orden de apertura (backend→controlador) | < 1 s (LAN) / < 2 s (WAN) |
| RNF-3 | Disponibilidad backend | 99.5% MVP |
| RNF-4 | Seguridad apertura | Authn + authz + anti-replay + audit |
| RNF-5 | Aislamiento multi-tenant | Imposibilidad de leer datos de otro edificio |
| RNF-6 | Usabilidad visitante | ≤ 4 pasos hasta enviar solicitud |
| RNF-7 | Escalabilidad | 1 → 100 → 1.000 edificios sin re-arquitectura |
| RNF-8 | Privacidad | Mínima información expuesta al visitante |
| RNF-9 | Observabilidad | Métricas de visitas/push/aperturas/errores |
| RNF-10 | Costo MVP | Priorizar open source / free tier donde no afecte requisitos |

---

## 3. Arquitectura propuesta

```
                        ┌─────────────────────────────────────────────┐
                        │              SECURE BACKEND (NestJS)         │
                        │                                              │
                        │  API REST (visitante/admin/app)              │
                        │  WebSocket Gateway (tiempo real)             │
                        │  Auth (magic-link/OTP/passkey)               │
                        │  Servicio de Push (FCM + APNs)               │
                        │  Servicio de Visitas (estado, expiración)    │
                        │  Servicio de Apertura (autorización)         │
                        │  AccessControllerRegistry (abstracción)      │
                        │  Auditoría + Métricas                        │
                        └───────┬──────────────┬───────────────┬───────┘
                                │              │               │
          ┌─────────────────────┘              │               └─────────────────────┐
          ▼                                    ▼                                     ▼
  ┌──────────────┐                    ┌──────────────────┐                ┌──────────────────────┐
  │ PostgreSQL   │                    │ Redis (rate limit │                │ FCM (Android)        │
  │ (datos)      │                    │  colas, tokens)   │                │ APNs (iOS)           │
  └──────────────┘                    └──────────────────┘                └──────────┬───────────┘
                                                                                     │ push
                                                                                     ▼
  ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
  │  CLIENTES                                                                                     │
  │  • Visitante: navegador web (React) — QR → solicitud — estado por WebSocket                   │
  │  • Propietario: App React Native (Expo) — push + sonido + aceptar/rechazar + abrir           │
  │  • Administrador: Web SPA (React)                                                             │
  └──────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                     ▲
  ┌─────────────────────────────────────────────────────────────────────────────────┘
  │  HARDWARE (desacoplado mediante interfaz AccessController)
  │  • MockAccessController (MVP/dev)
  │  • LocalGatewayController (ESP32 / Raspberry Pi / Mini PC) — MQTT o HTTPS
  │  • HTTPController / MQTTController / VendorController (integración con equipos existentes)
  │      └─ Relay ─ Puerta / Barrera / Portón
```

**Principios:**
1. **Backend como único punto de autorización** — el teléfono jamás habla directo con la cerradura.
2. **Hardware desacoplado** detrás de `AccessController` (interfaz) → se puede cambiar de fabricante sin tocar lógica de negocio.
3. **Push como canal de "despertar"** y **WebSocket como canal de estado en vivo** (complementarios, no excluyentes).
4. **Multi-tenant por diseño**: `propertyId` en toda entidad + aislamiento a nivel aplicación (y RLS como refuerzo).

---

## 4. Comparación Web / PWA / App

### 4.1 Matriz de capacidades (evidencia técnica)

| Función | Web | PWA (instalada) | Android App | iOS App |
|---------|-----|-----------------|-------------|---------|
| Escanear QR | ✔ (input camera / cámara nativa abre URL) | ✔ | ✔ | ✔ |
| Buscar residente | ✔ | ✔ | ✔ | ✔ |
| Push notification | ✖/△ (solo con permiso, Chrome/Android; iOS solo PWA instalada 16.4+) | △ (Android ✔, iOS solo instalada) | ✔ (FCM) | ✔ (APNs) |
| Sonido fiable | ✖ | △ | ✔ | ✔ |
| Pantalla bloqueada (fondo) | ✖ | △ (limitado) | ✔ | ✔ |
| Alerta tipo llamada | ✖ | ✖ | ✔ (full-screen intent) | ✔ (CallKit) |
| Background / app cerrada | ✖ | ✖ | ✔ | ✔ (limitado) |
| Abrir puerta (autorizada) | △ (con login web) | △ | ✔ | ✔ |

### 4.2 Conclusión por actor

- **Visitante → Web (sin PWA).** Un QR que abre una URL en el navegador es la menor fricción posible. No se necesita PWA porque el visitante no requiere push ni background. *(Una PWA-lite con service worker puede mejorar caché/reintentos, pero es opcional.)*
- **Propietario → App nativa.** Las capacidades críticas (push fiable, sonido, pantalla bloqueada, alerta tipo llamada, apertura segura con sesión persistente) **no se cumplen de forma fiable en Web/PWA**, especialmente en iOS.
- **Administrador → Web SPA.** No necesita push ni background.

---

## 5. Comparación Android / iOS

### 5.1 Push

| Aspecto | Android (FCM) | iOS (APNs) |
|---------|---------------|------------|
| Entrega | FCM (Google) | APNs (Apple) |
| Costo | Gratis | Gratis |
| Sonido | ✔ (canal de notificación, custom sound) | ✔ (sonido del bundle de la app) |
| Prioridad alta | ✔ `priority: high` (despierta Doze) | `apns-priority: 10` |
| Full-screen en bloqueo | ✔ full-screen intent (restringido a apps de llamada/alarma desde Android 14) | ✖ (CallKit como única vía "llamada") |
| Background | ✔ (FCM despierta el proceso) | ✔ (solo entrega; ejecución limitada) |
| Restricciones OEM | ⚠ Xiaomi/Huawei/Samsung agresivos (batería) | ⚠ usuario puede silenciar; Do Not Disturb |

### 5.2 Alerta "tipo llamada"

| Mecanismo | Android | iOS | Notas |
|-----------|---------|-----|-------|
| Push alta prioridad + sonido | ✔ heads-up | ✔ banner + sonido | Base del MVP, fiable |
| Full-screen intent | ✔ (categoría `CATEGORY_CALL`/`CATEGORY_ALARM`) | ✖ no existe | Android 14+: requiere `USE_FULL_SCREEN_INTENT`, auto-otorgado solo a apps de llamada/alarma |
| CallKit | ✖ (no hay equivalente idéntico) | ✔ pantalla nativa de llamada | Requiere PushKit (VoIP) + revisión de Apple |
| LiveCommunicationKit (iOS 17.4+) | — | ✔ (nueva API para apps de comunicación) | Alternativa moderna a CallKit |
| ConnectionService (Telecom) | ✔ llamada VoIP real | — | Más complejo, para VoIP real |

### 5.3 Conclusión
- El **MVP usa push de alta prioridad + sonido + vibración** en ambas plataformas. Es suficiente y confiable.
- La experiencia "llamada entrante" (full-screen en Android, CallKit/LiveCommunicationKit en iOS) es una **mejora de fase posterior**, porque conlleva permisos/entitlements y revisión de tiendas, y no debe bloquear el MVP.

---

## 6. Estrategia de Push

### 6.1 Elección de proveedor

| Criterio | FCM + APNs (directo) | OneSignal | Expo Notifications | Firebase full |
|----------|----------------------|-----------|--------------------|---------------|
| Confiabilidad | ✔ | ✔ | ✔ (envuelve FCM/APNs) | ✔ |
| Costo | Gratis | Free tier / pago por volumen | Gratis | Gratis |
| Sonido/background | ✔ | ✔ | ✔ | ✔ |
| Control total | ✔ | △ | △ | △ |
| Dependencia de tercero | Solo OS (obligatorio) | Vendor lock-in | Depende de Expo | Vendor lock-in (parcial) |
| Token management | Manual | Automático | Automático | Automático |
| Facilidad | Media | Alta | Alta | Alta |

**Recomendación:** **FCM + APNs directamente desde el backend** (librerías `firebase-admin` y `node-apn`), con un pequeño **módulo `PushService`** que abstrae ambos. El cliente genera el token con **Expo Notifications** (si se usa Expo) o el SDK nativo. Esto evita un intermediario de pago y no sacrifica ninguna capacidad crítica. OneSignal solo se justificaría si se quisiera delegar token management en producción a escala.

### 6.2 Flujo de token
1. App solicita permiso de notificación (Android: canal; iOS: prompt).
2. Obtiene push token.
3. Registra token en backend (`ResidentDevice`) con plataforma y nombre.
4. Backend envía push dirigido por dispositivo/residente/unidad.

### 6.3 Observabilidad de entrega
- FCM y APNs devuelven estado de envío (aceptado/rechazado). Entrega al dispositivo se puede confirmar con **FCM delivery receipt** (Android) y `apns-id`/`date` (iOS); registrar lo disponible en `VisitNotification`.

---

## 7. Estrategia de llamadas / alertas

### 7.1 Alternativas comparadas

| Opción | Visibilidad | Complejidad | Costo | Fiable en bloqueo | Recomendación |
|--------|-------------|-------------|-------|-------------------|---------------|
| A. Push normal | Baja | Baja | $0 | △ | No suficiente |
| B. Push alta prioridad + sonido | Media-alta | Baja | $0 | ✔ | **MVP** |
| C. Full-screen intent (Android) | Alta | Media | $0 | ✔ | Fase 2 (Android) |
| D. CallKit / LiveCommunicationKit (iOS) | Alta | Media-alta | $0 (pero revisión Apple) | ✔ | Fase 2 (iOS) |
| E. Llamada telefónica/VoIP real | Muy alta | Alta | $$ (Twilio/VoIP) | ✔ | No justificada para MVP |

### 7.2 Decisión
1. **Fase 1 (MVP):** Opción B. Push de alta prioridad con sonido personalizado, vibración y **acciones inline** (ACEPTAR / RECHAZAR). En Android se usa un canal de importancia `HIGH`; en iOS `apns-priority: 10`.
2. **Fase 2 (mejora):** Android full-screen intent con tono de llamada; iOS CallKit/LiveCommunicationKit.
3. **No** usar llamadas telefónicas tradicionales ni infraestructura VoIP paga salvo justificación comercial explícita.

---

## 8. Estrategia de apertura física

### 8.1 Arquitectura (NUNCA directa)

```
App ──(HTTPS, JWT)──▶ Backend ──(autoriza)──▶ AccessController ──▶ Relay ──▶ Puerta
```

### 8.2 Casos de hardware

| Caso | Ejemplo | Integración |
|------|---------|-------------|
| A. Portero eléctrico | cerradura eléctrica / abrepuertas | Relay (vía gateway local) |
| B. Barrera vehicular | portón / motor | Relay o API IP del controlador |
| C. Controlador IP | HTTP API / MQTT / WebSocket | `HTTPController` / `MQTTController` |
| D. Hardware local | gateway (ESP32/RPi) + relay | `LocalGatewayController` |

### 8.3 Estados de una orden (anti-confusión)

```
REQUESTED → COMMAND_SENT → COMMAND_CONFIRMED → EXECUTED
                └─ (falla) ─▶ FAILED (failureReason)
```

**Regla:** la UI **nunca** muestra "abierto" solo porque se envió el comando. Debe reflejar `COMMAND_SENT` ("abriendo…") y luego `COMMAND_CONFIRMED` ("puerta abierta") si el hardware lo confirma; en caso contrario, error explícito.

### 8.4 Ventana de apertura
- "Aceptar" y "Abrir" son **acciones distintas**. La aceptación habilita una **ventana de apertura** (ej. 60 s configurable) o un botón "Abrir" explícito.
- Una visita `EXPIRED` no permite abrir.

---

## 9. Estrategia de hardware

### 9.1 Interfaz de abstracción

```ts
interface AccessController {
  open(accessId: string, context: OpenContext): Promise<AccessResult>;
  getStatus(accessId: string): Promise<AccessStatus>;
  healthCheck(): Promise<HealthStatus>;
}
```

Implementaciones (registrables sin tocar negocio):
- `MockAccessController` (dev/MVP)
- `LocalGatewayController` (ESP32/RPi — MQTT o HTTPS con autenticación)
- `HTTPController` (equipos con API HTTP)
- `MQTTController` (broker MQTT)
- `VendorController` (API propietaria)

### 9.2 Dispositivo local (evaluación, no decisión automática)

| Opción | Costo | Estabilidad | Seguridad | Fácil instalación | OTA | Uso |
|--------|-------|-------------|-----------|-------------------|-----|-----|
| ESP32 | ~$5–15 | Buena | Media (necesita TLS/firmware firmado) | Media (flasheo) | ✔ | MVP piloto |
| Raspberry Pi | ~$35–60 | Alta | Alta (Linux, puede harden) | Alta | ✔ | Gateway robusto |
| Mini PC | ~$150+ | Muy alta | Alta | Alta | ✔ | Escala/industrial |
| Gateway industrial | ~$100–400 | Muy alta | Alta (certificaciones) | Media | ✔ | Comercial |

**Recomendación:** arrancar con **MockAccessController** (sin hardware físico). Para el piloto, un **ESP32 o Raspberry Pi** como gateway local que escucha una orden autenticada por MQTT o HTTPS y activa un relay.

### 9.3 Fail-safe vs Fail-secure (documentar, no decidir)

| Política | Comportamiento ante falla | Apto para |
|----------|---------------------------|-----------|
| Fail-safe (falla abierta) | Puerta se desbloquea al perder energía/red | Salidas de emergencia, normativa de evacuación |
| Fail-secure (falla cerrada) | Puerta permanece bloqueada | Accesos de seguridad, perímetros |

**No se elige automáticamente.** Cada instalación lo define según normativa local y requisitos de seguridad.

---

## 10. Modelo de datos

*(Notación: `*` = obligatorio, UUIDs como PK, timestamps de auditoría en todas las tablas.)*

### 10.1 Entidades de tenant

```
Property (Community)
  id*, name*, type* (BUILDING|CONDOMINIUM|GATED_COMMUNITY|HOUSE|OFFICE|OTHER),
  address, timezone, active, createdAt, updatedAt

Unit
  id*, propertyId* → Property, tower, building, floor, unitNumber*,
  displayName, active

Resident
  id*, unitId* → Unit, userId? → User (identidad de login, nullable hasta reclamar),
  firstName*, lastName*, displayName, role (OWNER|TENANT|FAMILY|STAFF), active

AccessPoint
  id*, propertyId* → Property, name*, type* (PEDESTRIAN_DOOR|VEHICLE_GATE|
  MAIN_ENTRANCE|ELEVATOR_ACCESS|OTHER), qrToken* (único, aleatorio, revocable),
  accessControllerId? → AccessController, active

AccessController
  id*, propertyId*, name, type (MOCK|LOCAL_GATEWAY|HTTP|MQTT|VENDOR),
  config (JSON cifrado), status (ONLINE|OFFLINE|UNKNOWN), lastSeenAt
```

### 10.2 Entidades de identidad y permisos

```
User (cuenta)
  id*, email?/phone?*, name, authMethod (MAGIC_LINK|OTP|PASSKEY), createdAt

ResidentDevice
  id*, residentId?* → Resident, userId? → User, platform (ANDROID|IOS|WEB),
  pushToken*, deviceName, active, lastSeenAt, revokedAt

AccessPermission  (permiso por acceso)
  id*, unitId → Unit (o residentId → Resident), accessPointId* → AccessPoint,
  granted, expiresAt?
```

### 10.3 Entidades de operación

```
Invitation
  id*, unitId* → Unit, token* (único, expira), email?/phone?, status, expiresAt

VisitRequest
  id*, accessPointId* → AccessPoint, residentId? → Resident, unitId → Unit,
  visitorName?, visitorMessage?, visitorType (VISITOR|DELIVERY),
  status (PENDING|ACCEPTED|REJECTED|EXPIRED|CANCELLED),
  createdAt, expiresAt, respondedAt, respondedByDeviceId?

VisitNotification (observabilidad)
  id*, visitRequestId* → VisitRequest, deviceId* → ResidentDevice,
  status (SENT|DELIVERED|FAILED), sentAt, deliveredAt?, error?

AccessAction
  id*, visitRequestId? → VisitRequest, residentId* → Resident, userId* → User,
  accessPointId* → AccessPoint, action (OPEN|CLOSE|STATUS),
  status (REQUESTED|COMMAND_SENT|COMMAND_CONFIRMED|EXECUTED|FAILED),
  requestedAt, executedAt, failureReason, deviceId, nonce* (anti-replay)

AuditLog
  id*, actorType, actorId, action, entityType, entityId, ip, userAgent,
  deviceId, metadata JSON, createdAt
```

### 10.4 Decisiones de diseño
- **`Resident` ≠ `User`**: un `User` (cuenta) puede ser `Resident` en varias unidades. Permite que una persona esté en casa y oficina.
- **Múltiples residentes por unidad**: una visita a `unitId` notifica a todos los `ResidentDevice` activos de esa unidad (configurable: todos / principal / primero que responde).
- **`qrToken` revocable y no contiene datos sensibles** — solo referencia opaca al acceso.
- **`nonce` en `AccessAction`** para protección anti-replay.

---

## 11. Modelo de seguridad

### 11.1 Autenticación de propietarios
- **MVP:** magic link por email (passwordless) — bajo fricción, sin contraseñas que recordar.
- **Alternativa/mejora:** OTP por teléfono, y **passkeys** (WebAuthn) como opción a futuro.
- No usar contraseña tradicional como vía primaria.

### 11.2 Autorización de apertura (cadena completa)

```
Usuario (autenticado, JWT corto)
  → pertenece a Resident de una Unit
  → Unit tiene AccessPermission sobre AccessPoint
  → AccessPoint activo y controlador online
  → VisitRequest (si aplica) no expirada
```

Nunca aceptar `accessId=123` como autorización. La apertura exige JWT válido + verificación de pertenencia + permiso + anti-replay + rate limit.

### 11.3 Protecciones
| Mecanismo | Detalle |
|-----------|---------|
| Autenticación | JWT de corta vida + refresh token rotativo |
| Autorización | Chequeo de permiso por acceso en cada orden |
| Anti-replay | `nonce` único + expiración en la orden |
| Rate limiting | Redis, por IP/dispositivo/acceso |
| Auditoría | `AuditLog` + `AccessAction` inmutables |
| Identificación | userId + deviceId + IP + timestamp en cada acción |
| Cifrado | TLS en tránsito; `config` de controladores cifrada |
| Dispositivo perdido | revocar `ResidentDevice`, cerrar sesiones |

---

## 12. Modelo multi-tenant

- **Aislamiento a nivel aplicación:** toda consulta se filtra por `propertyId` derivado del contexto autenticado (helper/scope en el ORM).
- **Refuerzo (recomendado):** PostgreSQL **Row-Level Security (RLS)** con `propertyId` como columna de tenant en todas las tablas tenant-scoped. Evita fugas incluso ante bugs de query.
- **Regla de oro (testeada):** *El Edificio A jamás puede leer residentes/accesos del Edificio B.*
- **Roles:** `platform_admin` (global) vs `property_admin` (scoped a una propiedad).

---

## 13. Flujo de visitante

```
1. Escanea QR (cámara nativa) → https://dominio/access/<token>
2. Backend valida token → carga pantalla "¿A quién venís a visitar?"
3. Busca: nombre / apellido / depto / alias → resultados acotados
4. Selecciona residente/unidad
5. (Opcional) ingresa su nombre y mensaje
6. "AVISAR" → POST /visits → crea VisitRequest (PENDING, expiresAt)
7. Pantalla muestra estado en vivo (WebSocket): enviada → aceptada/rechazada/expirada
```

Reglas de privacidad: no listar todos los residentes; resultados parciales; rate limiting; challenge adaptativo solo ante abuso.

---

## 14. Flujo de propietario

```
1. Recibe push alta prioridad + sonido/vibración
2. Abre alerta: "Juan Pérez está en la entrada. Viene a visitar a Pedro."
3. [ACEPTAR] / [RECHAZAR]  (y opcionalmente [ACEPTAR Y ABRIR])
4. Si acepta: puede pulsar [ABRIR PUERTA] (ventana de tiempo limitada)
5. Backend autoriza → AccessController → relay → puerta
6. UI muestra estado real: "abriendo…" → "puerta abierta" o error
7. Todo queda en auditoría
```

---

## 15. Flujo de administrador

```
1. Login (panel web)
2. Crear/editar Property (edificio/barrio)
3. Crear/importar Units, asignar Residents
4. Crear AccessPoints, generar/revocar QR
5. Registrar AccessControllers y ver estado
6. Consultar auditoría y métricas
```

---

## 16. Manejo de errores

| Escenario | Respuesta |
|-----------|-----------|
| Push no llega | Reintento + respaldo in-app vía WebSocket; la visita expira si nadie responde |
| Propietario no responde | `VisitRequest` pasa a `EXPIRED` tras ventana configurable |
| Internet del propietario caído | Limitación documentada; apertura local (hardware) como fallback futuro |
| Controlador offline | "No se pudo conectar con el acceso." + `AccessAction.status = FAILED` |
| Relay no responde | Error registrado; distinto de "abierto" |
| QR inválido/inactivo | "Este acceso no está disponible." |
| Token expirado/replay | Rechazo con 401/409, registrado en auditoría |
| Rate limit | 429 con reintento; challenge adaptativo solo si persiste abuso |

---

## 17. Funcionamiento ante pérdida de Internet

| Componente | Sin Internet | Mitigación |
|------------|--------------|------------|
| Visitante (web) | No puede generar solicitud | N/A (necesita red) |
| Propietario (push) | No recibe push | No hay entrega; la visita expira |
| Backend ↔ controlador | Sin comando remoto | **Gateway local** que valida y abre en LAN |
| Puerta física | — | Fail-safe/secure según normativa |

**Conclusión:** la seguridad física **no debe depender exclusivamente de Internet**. Se contempla un **fallback de red local** (gateway/controlador que abre en LAN con autenticación local) para edificios que lo requieran.

---

## 18. Costos estimados

### 18.1 MVP (1 edificio, desarrollo)

| Rubro | Costo estimado |
|-------|----------------|
| Hosting backend (VPS pequeño / Render/Fly/Railway) | $0–20/mes |
| PostgreSQL (managed o en VPS) | $0–15/mes |
| Redis | $0–10/mes |
| Push (FCM + APNs) | $0 |
| Dominio | ~$10–15/año |
| TLS (Let's Encrypt) | $0 |
| Hardware (ESP32/RPi + relay, opcional en MVP) | $5–70 |
| **Total MVP** | **≈ $0–50/mes + hardware puntual** |

### 18.2 Escala comercial

| Rubro | Escala |
|-------|--------|
| Hosting + DB + Redis (HA) | $100–500/mes por ~100 edificios |
| Push | $0 (FCM/APNs son gratuitos) |
| VoIP/llamadas | $0 (no se usa llamada tradicional) |
| SMS (solo si se usa OTP) | ~$0.02–0.05/SMS (evitable con magic link) |
| Hardware por acceso | $10–400 según controlador elegido |
| Observabilidad (opcional) | $0–50/mes |

**Principio:** no introducir proveedor pago si existe alternativa gratuita/open source que cumpla los requisitos críticos.

---

## 19. Dependencias externas

| Dependencia | Tipo | Justificación | Alternativa |
|-------------|------|---------------|-------------|
| FCM (Google) | Push Android | Obligatorio en Android | Ninguna (OS) |
| APNs (Apple) | Push iOS | Obligatorio en iOS | Ninguna (OS) |
| PostgreSQL | DB | Multi-tenant, RLS, robusto | Supabase (lock-in) |
| Redis | Rate limit/colas | Anti-abuso, tokens | En memoria (no escala) |
| Node.js / NestJS | Backend | Tipado, modular, DI | Supabase/Firebase |
| React Native + Expo | App | Cross-platform, push integrado | Flutter / nativo |
| React | Web (visitante/admin) | SPA rápida | Next.js |
| MQTT broker (opcional) | Hardware | Gateway local | HTTPS |

---

## 20. Riesgos técnicos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Push no fiable por OEM (Android) | Alto | Canal alta prioridad + instrucciones de batería + pruebas reales |
| Revisión Apple (CallKit/Critical Alerts) | Medio | MVP sin ellos; pedir entitlements solo si se justifica |
| Seguridad de apertura | Crítico | Backend autoriza siempre; nunca relay directo |
| Abuso/scraping del QR | Medio | Rate limit + resultados parciales + challenge adaptativo |
| Fallo de hardware/red | Medio | Abstacción + gateway local + fail-safe/secure por normativa |
| Lock-in de proveedor | Medio | Módulos propios (`PushService`, `AccessController`) |
| Multi-tenant leak | Crítico | RLS + scope por `propertyId` + tests |

---

## 21. Limitaciones de Android (documentadas)

- **Full-screen intent restringido** desde Android 14 (target SDK 34): la app debe declararse de categoría llamada/alarma y pedir `USE_FULL_SCREEN_INTENT` (auto-otorgado solo a esas apps).
- **OEM agresivos** (Xiaomi, Huawei, Samsung) pueden matar la app en background pese a FCM; requiere que el usuario excluya la app de optimización de batería.
- **Doze/App Standby**: retrasan pushes no prioritarios; se mitiga con `priority: high` (también sujeto a cuota).
- **Canal de notificación**: el usuario puede bajar la importancia/sonido por canal; hay que usar un canal dedicado `HIGH`.

---

## 22. Limitaciones de iOS (documentadas)

- **No hay full-screen intent**: la pantalla tipo llamada solo vía CallKit/LiveCommunicationKit.
- **CallKit requiere PushKit (VoIP)** y Apple revisa su uso; mal uso → rechazo.
- **Critical Alerts** (sonido máximo + bypass de silencio/DND) requiere **entitlement aprobado por Apple** (justificable para seguridad, no garantizado).
- **Web Push** solo funciona en PWA instalada a Home Screen con iOS 16.4+; no aplica a visitantes en Safari sin instalar.
- **Background limitado**: la app no puede ejecutar lógica arbitraria en background; depende de APNs.
- **Usuario puede silenciar** notificaciones o activar Focus/DND; no hay bypass total sin Critical Alerts.

---

## 23. MVP recomendado

### Visitante
- QR → web responsive → búsqueda acotada → selección → mensaje opcional → envío → estado en vivo.

### Propietario
- App React Native (Expo): registro/invitación, push + sonido, aceptar/rechazar, botón abrir, historial.

### Administrador
- Panel web: propiedad, unidades, residentes, accesos, QR, controladores, auditoría.

### Backend
- NestJS + PostgreSQL + Redis: auth (magic link), visitas, push (FCM/APNs), autorización, auditoría, WebSocket.

### Hardware
- `AccessController` (interfaz) + `MockAccessController` (dev) + botón "SIMULAR APERTURA".

### Criterio de éxito (flujo completo verificable)
```
QR → visitante → residente → notificación/alerta → aceptación → autorización → apertura → auditoría
```
"Nada se da por terminado por tener solo la interfaz": push debe verificarse en dispositivo real y apertura debe recorrer autorización → comando → controlador → resultado (aunque el controlador sea Mock).

---

## 24. Roadmap (fases)

| Fase | Entregable | Verificación |
|------|------------|--------------|
| 0 | Investigación (este documento) | — |
| 1 | Arquitectura y modelo de datos | Schema + diagramas |
| 2 | Backend y autenticación | Auth magic-link, tests |
| 3 | Experiencia visitante QR | Flujo web completo |
| 4 | App propietario | Build Android/iOS |
| 5 | Push y alertas | Entrega real en dispositivo |
| 6 | Sistema de visitas | Estados + expiración + tests |
| 7 | Abstracción de hardware | `AccessController` + Mock |
| 8 | Controlador físico/mock | `MockAccessController` + simulación |
| 9 | Seguridad y auditoría | Permisos, anti-replay, logs |
| 10 | Pruebas reales Android/iOS | Bloqueado/cerrada/background/sonido |
| 11 | Piloto con un edificio | Flujo de punta a punta |

Cada fase: implementar → probar → tests → verificar build → documentar → verificar seguridad → pasar.

---

## 25. Selección de stack (comparación técnica)

### Criterios y pesos (según especificación)

| Criterio | Peso |
|----------|------|
| Usabilidad | 20% |
| Push/confiabilidad | 20% |
| Background/mobile | 15% |
| Seguridad | 15% |
| Integración hardware | 10% |
| Costo | 10% |
| Mantenibilidad | 5% |
| Escalabilidad | 5% |

### 25.1 Frontend visitante
| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| Web responsive (React/Vite) | Cero instalación, carga rápida, barato | Sin push (no lo necesita) |
| PWA | Cache/reintentos | Complejidad innecesaria para visitante |
**→ Web responsive.** (La PWA opcional solo para caché.)

### 25.2 App propietario
| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| React Native + Expo | 1 codebase, push integrado, escape hatch nativo (dev client/config plugins) | Full-screen/CallKit requieren código nativo |
| Flutter | 1 codebase, buena UI | Push/call también requieren nativo; ecosistema de notificaciones menos unificado |
| Kotlin + Swift (nativo) | Máxima confiabilidad y control | 2 codebases, mayor costo/mantenimiento |
**→ React Native + Expo** para MVP (velocidad + push), con salida a nativo cuando se requiera full-screen/CallKit.

### 25.3 Backend
| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| NestJS (Node/TS) | Modular, DI, WebSocket nativo, tipado, ideal para abstraer hardware | Curva de aprendizaje media |
| Node/Express plano | Simple | Menos estructura para crecer |
| Supabase | Rápido, realtime, auth | Lock-in, menos control de integración hardware/RLS compleja |
| Firebase | Rápido, push integrado | Lock-in, costos a escala, RLS limitado |
**→ NestJS + PostgreSQL + Redis**: control total, multi-tenant con RLS, integración hardware limpia, costos predecibles.

### 25.4 Push
**→ FCM + APNs directo** (módulo `PushService`), tokens vía Expo Notifications en cliente.

### 25.5 Tiempo real
| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| WebSocket (Socket.IO) | Control total, status de visitas/aperturas en vivo | Hay que mantenerlo |
| Supabase Realtime | Rápido | Lock-in |
| SSE | Simple | Unidireccional, limitado |
**→ WebSocket (NestJS Gateway)** para estado en vivo de visitas y aperturas; push como canal de despertar.

### 25.6 Hardware
**→ `AccessController` (interfaz)** + `MockAccessController`; luego `LocalGatewayController` (MQTT/HTTPS) y controladores HTTP/MQTT/Vendor.

---

## Conclusión de la auditoría

**Arquitectura recomendada:**
- **Visitante:** Web responsive (sin app, sin cuenta).
- **Propietario:** App React Native + Expo (push FCM/APNs + sonido + apertura autorizada).
- **Administrador:** Web SPA.
- **Backend:** NestJS + PostgreSQL (RLS) + Redis + WebSocket.
- **Push:** FCM (Android) + APNs (iOS) directos.
- **Hardware:** Abstracción `AccessController`; MVP con `MockAccessController`.
- **Alerta tipo llamada:** MVP = push alta prioridad + sonido; fase 2 = full-screen (Android) / CallKit-LiveCommunicationKit (iOS).

**No se implementa nada todavía.** El siguiente paso (si lo aprobás) es **FASE 1: Arquitectura y modelo de datos** (schema real + scaffolding del repositorio).
