# Build del APK (Android) local, con el toolchain de esta máquina.
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1          -> release (recomendado)
#   powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1 -Debug   -> debug
param([switch]$Debug)

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot
$mobile = Join-Path $root "mobile"
$android = Join-Path $mobile "android"

# Toolchain local
$env:JAVA_HOME = "C:\Users\Emanuel\AppData\Local\opencode\tools\jdk17"
$env:ANDROID_HOME = "C:\Users\Emanuel\AppData\Local\opencode\tools\android"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

Write-Host ""
Write-Host "=== BUILD APK LOCAL ===" -ForegroundColor Cyan
Write-Host "JAVA_HOME   : $env:JAVA_HOME"
Write-Host "ANDROID_HOME: $env:ANDROID_HOME"
Write-Host ""

# 1. Generar proyecto nativo si no existe
if (-not (Test-Path (Join-Path $android "settings.gradle"))) {
    Write-Host "[1/3] Generando proyecto nativo (expo prebuild)..." -ForegroundColor Yellow
    Push-Location $mobile
    npx expo prebuild --platform android --no-install
    $c = $LASTEXITCODE
    Pop-Location
    if ($c -ne 0) { throw "expo prebuild falló (exit $c)" }
} else {
    Write-Host "[1/3] Proyecto nativo ya existe." -ForegroundColor DarkGray
}

# 2. local.properties
@"
sdk.dir=$($env:ANDROID_HOME -replace '\\','/')
"@ | Set-Content -Path (Join-Path $android "local.properties") -Encoding ascii
Write-Host "[2/3] local.properties actualizado." -ForegroundColor DarkGray

# 3. Build
$variant = if ($Debug) { "assembleDebug" } else { "assembleRelease" }
Write-Host "[3/3] Compilando $variant ... (la primera vez puede tardar)" -ForegroundColor Yellow
Push-Location $android
& ".\gradlew.bat" $variant --console=plain
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) {
    Write-Host "BUILD FALLÓ (exit $code)" -ForegroundColor Red
    exit $code
}

# 4. Resultado
$apk = Get-ChildItem (Join-Path $android "app\build\outputs\apk") -Recurse -Filter "*.apk" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($apk) {
    Write-Host ""
    Write-Host "APK generado:" -ForegroundColor Green
    Write-Host "  $($apk.FullName)"
    Write-Host ("  Peso: {0:N1} MB" -f ($apk.Length / 1MB))
    Write-Host ""
    Write-Host "Instalar con adb: adb install `"$($apk.FullName)`"" -ForegroundColor DarkGray
} else {
    Write-Host "No se encontró el APK." -ForegroundColor Red
}
