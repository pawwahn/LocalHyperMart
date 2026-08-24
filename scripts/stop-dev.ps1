# Stop HyperLocalMart local stack (Java + web). Docker stays up unless -Down.
# Usage:
#   .\scripts\stop-dev.ps1
#   .\scripts\stop-dev.ps1 -Down     # also docker compose down

param(
    [switch]$Down
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$javaPorts = 8080..8092
$webPorts = 5173..5176

function Stop-Listeners([int[]]$Ports) {
    foreach ($port in $Ports) {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object {
                Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
            }
    }
}

Write-Host "Stopping Java services (ports 8080-8092)..."
Stop-Listeners $javaPorts

Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "hyperlocalmart|spring-boot:run|user-service-|api-gateway-" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Write-Host "Stopping web apps (ports 5173-5176)..."
Stop-Listeners $webPorts

if ($Down) {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Host "Stopping docker compose (down)..."
        docker compose down
    } else {
        Write-Host "Docker not in PATH - skip docker compose down"
    }
} else {
    Write-Host "Docker left running (next start is faster). Pass -Down to tear down containers."
}

Write-Host "Done."
