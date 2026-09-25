# Aplica una migracion SQL a tu proyecto Supabase en la nube usando la Management API.
# Requiere haber hecho `supabase login` (el token queda guardado en el Administrador de credenciales).
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\apply-migration.ps1 -SqlFile supabase\migrations\0004_invitation_claimed_by.sql
#   powershell -ExecutionPolicy Bypass -File scripts\apply-migration.ps1 -SqlFile supabase\migrations\0005_xxxx.sql

param(
    [Parameter(Mandatory = $true)][string]$SqlFile,
    [string]$ProjectRef = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot

# --- Resolver project ref desde web/.env.local si no se pasa por parametro ---
if (-not $ProjectRef) {
    $envFile = Join-Path $root "web\.env.local"
    if (-not (Test-Path $envFile)) { throw "No se encontro web\.env.local. Pasa -ProjectRef manualmente." }
    $line = Get-Content $envFile | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_URL=' } | Select-Object -First 1
    $ProjectRef = ($line -replace '^NEXT_PUBLIC_SUPABASE_URL=https://', '') -replace '\.supabase\.co', ''
}
if (-not $ProjectRef) { throw "No se pudo resolver el project ref." }

# --- Leer token de supabase login desde el Administrador de credenciales ---
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class SupabaseCred {
  [StructLayout(LayoutKind.Sequential)]
  private struct CREDENTIAL {
    public uint Flags; public uint Type; public IntPtr TargetName; public IntPtr Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist;
    public uint AttributeCount; public IntPtr Attributes; public IntPtr TargetAlias; public IntPtr UserName;
  }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("advapi32.dll", SetLastError = true)]
  private static extern void CredFree(IntPtr buffer);
  public static string Read(string target) {
    IntPtr ptr;
    if (!CredRead(target, 1, 0, out ptr)) return null;
    try {
      var cred = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
      if (cred.CredentialBlobSize == 0) return null;
      byte[] bytes = new byte[cred.CredentialBlobSize];
      Marshal.Copy(cred.CredentialBlob, bytes, 0, bytes.Length);
      return Encoding.UTF8.GetString(bytes);
    } finally { CredFree(ptr); }
  }
}
"@

$token = [SupabaseCred]::Read("Supabase CLI:supabase")
if (-not $token) { throw "No se encontro el token de supabase login. Ejecuta `supabase login` primero." }

# --- Leer SQL y serializar el JSON correctamente ---
$sqlPath = Join-Path $root $SqlFile
if (-not (Test-Path $sqlPath)) { throw "No se encontro el archivo SQL: $sqlPath" }
$sql = (Get-Content -Raw $sqlPath) -replace '\uFEFF', ''

Add-Type -AssemblyName System.Web.Extensions
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$json = $serializer.Serialize(@{ query = $sql })

$tmp = Join-Path $env:TEMP ("mig_" + [System.IO.Path]::GetFileNameWithoutExtension($sqlPath) + ".json")
[System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Aplicando $SqlFile al proyecto $ProjectRef ..." -ForegroundColor Cyan
$response = & curl.exe -s -X POST "https://api.supabase.com/v1/projects/$ProjectRef/database/query" `
    -H "Authorization: Bearer $token" -H "Content-Type: application/json" --data-binary "@$tmp"

Write-Host $response
Write-Host "Listo." -ForegroundColor Green
