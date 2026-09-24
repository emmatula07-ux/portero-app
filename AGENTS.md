# AGENTS.md — Contexto del proyecto

Portero/timbre inteligente (visitante por QR, propietario con push, apertura remota, control de deudas). Stack: Supabase (backend/DB/Auth) + Next.js (web visitante + panel admin) + Expo/React Native (app móvil).

## Build local del APK (Android)

Siempre que se pida "build local del .apk", usar el script dedicado:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
```

Produce: `mobile/android/app/build/outputs/apk/release/app-release.apk` (firmado con keystore de debug, sirve para test; ~67 MB).

### Toolchain local (ya instalado en esta máquina)
- Java (OpenJDK 17 Temurin): `C:\Users\Emanuel\AppData\Local\opencode\tools\jdk17`
- Android SDK: `C:\Users\Emanuel\AppData\Local\opencode\tools\android` (platforms android-35 y android-36, build-tools 34/35/36, NDK 27.1.12297006, CMake 3.22.1)
- Gradle: usa el wrapper del proyecto (9.3.1); hay un gradle 8.9 del sistema en `tools\gradle-8.9` (no se usa)

### Detalles que hay que recordar
- El primer build tardó ~1h porque descargó NDK, platform 36, build-tools 36, CMake y gradle. **Los siguientes tardan ~2–5 min** (todo cacheado).
- `gradlew.bat` corre en el **directorio actual**, no en el del script: hay que ejecutarlo con `workdir = mobile/android` (el script ya lo hace con `Push-Location`).
- Si `mobile/android` no existe, el script corre `npx expo prebuild --platform android --no-install` primero.
- `local.properties` necesita `sdk.dir` apuntando al SDK (el script lo escribe).
- Para correr el build en background y monitorearlo: `Start-Process cmd.exe -ArgumentList "/c","gradlew.bat assembleRelease --console=plain" -WorkingDirectory <mobile\android>` redirigiendo a un log, y hacer polling del log (los procesos largos en foreground los mata el entorno).

## Dos caminos para generar el APK

1. **EAS cloud (recomendado para producción)**:
   ```powershell
   cd mobile
   npx eas-cli@latest build --profile preview --platform android
   ```
   - Firma y configuración de FCM gestionadas por Expo. `eas.json` ya tiene `env` con `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   - Plan free: 15 builds Android + 15 iOS/mes. Resultado: APK descargable desde el link que da EAS.

2. **Local (rápido, para iterar/testear)**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
   ```
   - Firmado con keystore de debug (no apto para Play Store).
   - Necesita el toolchain local (arriba).

## Datos clave del proyecto

- Backend: Supabase (región `us-west-2`). Migraciones en `supabase/migrations/` (0001_init, 0002_search_privacy, 0003_rbac).
- Web: Next.js 16 en Vercel (`https://portero-app-omega.vercel.app`). Panel admin en `/admin`.
- Móvil: Expo SDK 57 / React Native 0.86.
- Roles: `DEVELOPER` (dueño), `ADMIN` (1 o más edificios vía `property_admins`), `RESIDENT`.
- Secretos en `web/.env.local` y `mobile/.env` (gitignored; NO commitear). Plantillas: `.env.local.example` / `.env.example`.
- Documentación local (no versionada): `local/manual-uso.html` y `local/BITACORA.md`.

## Comandos útiles

```powershell
# web (local)
cd web; npm run dev        # http://localhost:3000

# app móvil (local)
cd mobile; npx expo start

# desplegar Edge Functions (si cambian)
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1

# typecheck
cd web; npm run build
cd mobile; npx tsc --noEmit
```
