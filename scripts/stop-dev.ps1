# Stop HyperLocalMart dev stack
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Stopping Java/Maven spring-boot processes (best effort)..."
Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "hyperlocalmart|spring-boot:run" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "Stopping docker compose..."
    docker compose down
} else {
    Write-Host "Docker not in PATH — skip docker compose down"
}

Write-Host "Done."
