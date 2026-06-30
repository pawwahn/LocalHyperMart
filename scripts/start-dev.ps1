# HyperLocalMart — local dev startup (Windows PowerShell)
# Prerequisites: Docker Desktop, Java 21, Maven 3.9+
# Usage: .\scripts\start-dev.ps1 [-SkipBuild] [-ServicesOnly]

param(
    [switch]$SkipBuild,
    [switch]$ServicesOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Require-Command($name, $installHint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Error "$name not found. $installHint"
    }
}

Require-Command "docker" "Install Docker Desktop and ensure it is running."
Require-Command "mvn" "Install Maven 3.9+ and add to PATH."
Require-Command "java" "Install JDK 21 and add to PATH."

Write-Host "==> Java version"
java -version

if (-not $ServicesOnly) {
    Write-Host "==> Starting infrastructure (Postgres, Redis, Kafka, ...)"
    docker compose up -d
    Write-Host "Waiting for Postgres..."
    $retries = 30
    while ($retries -gt 0) {
        try {
            docker exec hlm-postgres pg_isready -U hyperlocalmart | Out-Null
            if ($LASTEXITCODE -eq 0) { break }
        } catch { }
        Start-Sleep -Seconds 2
        $retries--
    }
    if ($retries -eq 0) {
        Write-Warning "Postgres may not be ready yet. Services might fail on first start."
    }
}

if (-not $SkipBuild) {
    Write-Host "==> Building all modules (skip tests)"
    mvn clean install -DskipTests
}

$services = @(
    @{ Name = "user-service";         Module = "services/user-service";         Port = 8081 },
    @{ Name = "town-service";         Module = "services/town-service";         Port = 8082 },
    @{ Name = "vendor-service";       Module = "services/vendor-service";       Port = 8083 },
    @{ Name = "catalog-service";      Module = "services/catalog-service";      Port = 8084 },
    @{ Name = "cart-service";         Module = "services/cart-service";         Port = 8085 },
    @{ Name = "order-service";        Module = "services/order-service";        Port = 8086 },
    @{ Name = "payment-service";      Module = "services/payment-service";      Port = 8087 },
    @{ Name = "delivery-service";     Module = "services/delivery-service";     Port = 8088 },
    @{ Name = "notification-service"; Module = "services/notification-service"; Port = 8089 },
    @{ Name = "api-gateway";          Module = "gateway/api-gateway";          Port = 8080 }
)

$logDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

foreach ($svc in $services) {
    $logFile = Join-Path $logDir "$($svc.Name).log"
    Write-Host "==> Starting $($svc.Name) on port $($svc.Port) -> $logFile"
    Start-Process -FilePath "mvn" `
        -ArgumentList "-pl", $svc.Module, "spring-boot:run" `
        -WorkingDirectory $Root `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError $logFile `
        -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "All services starting in background. Logs: $logDir"
Write-Host "Gateway: http://localhost:8080"
Write-Host "Run health check: .\scripts\health-check.ps1"
Write-Host "Pilot vendor login: POST /api/v1/auth/login { `"phone`": `"9876500001`", `"password`": `"password`" }"
