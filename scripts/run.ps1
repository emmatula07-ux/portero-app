# Arranca la Web (visitante + admin) y la App movil en local.
# Requiere: setup.ps1 (claves), base de datos creada y funciones desplegadas.

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot
$web = Join-Path $root "web"
$mobile = Join-Path $root "mobile"

Write-Host ""
Write-Host "=== ARRANCANDO PORTERO ===" -ForegroundColor Cyan

Write-Host "[1/2] Web visitante + panel admin (puerto 3000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList '-NoExit','-Command','npm run dev' -WorkingDirectory $web

Start-Sleep -Seconds 3

Write-Host "[2/2] App movil (Expo)..." -ForegroundColor Green
Start-Process powershell -ArgumentList '-NoExit','-Command','npx expo start' -WorkingDirectory $mobile

Write-Host ""
Write-Host "=== LISTO ===" -ForegroundColor Cyan
Write-Host "Visitante (probalo en el navegador):" -ForegroundColor Green
Write-Host "  http://localhost:3000/access/dev_entrada_principal"
Write-Host "Panel de administracion:" -ForegroundColor Green
Write-Host "  http://localhost:3000/admin"
Write-Host "App movil: escanea el QR de la ventana de Expo con tu telefono (Expo Go)" -ForegroundColor Green
