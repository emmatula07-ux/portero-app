# Configura el entorno local. Ejecutar UNA vez.
# Backend: Supabase gratis (nube). Web + app movil: en tu PC.

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot

Write-Host ""
Write-Host "=== CONFIGURACION PORTERO ===" -ForegroundColor Cyan
Write-Host "1) Crea un proyecto gratis en https://supabase.com"
Write-Host "2) En 'Project Settings -> API' copia la Project URL, anon key y service_role key"
Write-Host ""

$url = Read-Host "Supabase URL (https://xxxx.supabase.co)"
$anon = Read-Host "Anon (public) key"
$service = Read-Host "Service role key (secreta)"

# web/.env.local
@"
NEXT_PUBLIC_SUPABASE_URL=$url
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon
SUPABASE_SERVICE_ROLE_KEY=$service
"@ | Set-Content -Path (Join-Path $root "web\.env.local") -Encoding utf8

# mobile/.env
@"
EXPO_PUBLIC_SUPABASE_URL=$url
EXPO_PUBLIC_SUPABASE_ANON_KEY=$anon
"@ | Set-Content -Path (Join-Path $root "mobile\.env") -Encoding utf8

Write-Host "Archivos de configuracion creados." -ForegroundColor Green
Write-Host ""
Write-Host "=== PASO 2 de 3: crear la base de datos ===" -ForegroundColor Cyan
Write-Host "En https://supabase.com/dashboard -> tu proyecto -> SQL Editor,"
Write-Host "pega y ejecuta EN ESTE ORDEN:"
Write-Host "  1) el contenido de: supabase/migrations/0001_init.sql"
Write-Host "  2) el contenido de: supabase/migrations/0002_search_privacy.sql"
Write-Host "  3) el contenido de: supabase/seed.sql"
Write-Host ""
Write-Host "=== PASO 3 de 3: desplegar las funciones ===" -ForegroundColor Cyan
Write-Host "Ejecuta:  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1"
Write-Host ""
Write-Host "Luego:     powershell -ExecutionPolicy Bypass -File scripts\run.ps1" -ForegroundColor Green
