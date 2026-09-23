# Despliega las Edge Functions a tu proyecto Supabase (nube).
# Requiere haber creado la DB (SQL) y ejecutado scripts/setup.ps1.
# NO requiere Docker.

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot
$supa = Join-Path $root "supabase"

$ref = Read-Host "Project ref de Supabase (ej. abcd1234abcd, esta en Project Settings -> General)"

Write-Host ""
Write-Host "Iniciando sesion en Supabase (se abre el navegador)..." -ForegroundColor Cyan
supabase login

$functions = @("search-residents", "create-visit", "visit-status", "open-access", "claim-invitation")
foreach ($f in $functions) {
  Write-Host "Desplegando $f ..." -ForegroundColor Green
  supabase functions deploy $f --project-ref $ref
}

Write-Host ""
Write-Host "Listo. Las funciones ya estan en la nube." -ForegroundColor Green
Write-Host "Ahora ejecuta: powershell -ExecutionPolicy Bypass -File scripts\run.ps1" -ForegroundColor Cyan
