# KoyaKart (LocalHyperMart repo) - fast local startup (Windows PowerShell)
# Starts Docker infra + Java services (java -jar) + web apps.
# Repeat runs skip Maven if fat JARs already exist.
#
# Usage:
#   .\scripts\start-dev.ps1
#   .\scripts\start-dev.ps1 -Rebuild          # Maven package, then start
#   .\scripts\start-dev.ps1 -SkipBuild         # never Maven (fail if JAR missing)
#   .\scripts\start-dev.ps1 -ServicesOnly      # skip Docker
#   .\scripts\start-dev.ps1 -SkipWeb           # Java + Docker only
#   .\scripts\start-dev.ps1 -NoWait            # do not poll health

param(
    [switch]$SkipBuild,
    [switch]$ServicesOnly,
    [switch]$Rebuild,
    [switch]$SkipWeb,
    [switch]$NoWait
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Import-DotEnv([string]$Path) {
    if (-not (Test-Path $Path)) { return }
    Write-Host "==> Loading env from $(Split-Path -Leaf $Path)"
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $eq = $line.IndexOf("=")
        if ($eq -lt 1) { return }
        $name = $line.Substring(0, $eq).Trim()
        $value = $line.Substring($eq + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        Set-Item -Path "Env:$name" -Value $value
    }
}
Import-DotEnv (Join-Path $Root ".env.local")
Import-DotEnv (Join-Path $Root ".env")

$JarVersion = "1.0.0-SNAPSHOT"
$NodeHome = "C:\Tools\node"
$DockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

function Require-Command($name, $installHint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: $name not found. $installHint"
        exit 1
    }
}

function Test-HttpUp([string]$Url) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
    } catch {
        return $false
    }
}

function Test-PortListening([int]$Port) {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return [bool]$c
}

function Stop-PortListener([int]$Port) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

function Ensure-NodePath {
    if (Get-Command node -ErrorAction SilentlyContinue) { return }
    if (Test-Path (Join-Path $NodeHome "node.exe")) {
        $env:Path = "$NodeHome;" + $env:Path
    }
}

function Test-DockerReady {
    cmd /c "docker info >nul 2>&1"
    return ($LASTEXITCODE -eq 0)
}

function Ensure-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "docker not found. Install Docker Desktop and ensure it is running."
        exit 1
    }
    if (Test-DockerReady) { return }

    if (Test-Path $DockerDesktop) {
        Write-Host "==> Starting Docker Desktop..."
        Start-Process $DockerDesktop | Out-Null
    } else {
        Write-Error "Docker is not running. Start Docker Desktop and retry."
        exit 1
    }

    $deadline = (Get-Date).AddMinutes(5)
    while ((Get-Date) -lt $deadline) {
        if (Test-DockerReady) {
            Write-Host "    Docker is ready."
            return
        }
        Start-Sleep -Seconds 3
    }
    Write-Error "Docker Desktop did not become ready in 5 minutes."
    exit 1
}

function Get-FatJar([string]$Module, [string]$Name) {
    $path = Join-Path $Root (Join-Path $Module "target\$Name-$JarVersion.jar")
    if (-not (Test-Path $path)) { return $null }
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
        try {
            $entry = $zip.GetEntry("META-INF/MANIFEST.MF")
            if (-not $entry) { return $null }
            $reader = New-Object System.IO.StreamReader($entry.Open())
            $manifest = $reader.ReadToEnd()
            $reader.Close()
            if ($manifest -match "Main-Class:") { return $path }
            return $null
        } finally {
            $zip.Dispose()
        }
    } catch {
        return $null
    }
}

$services = @(
    @{ Name = "user-service";         Module = "services\user-service";         Port = 8081 },
    @{ Name = "town-service";         Module = "services\town-service";         Port = 8082 },
    @{ Name = "vendor-service";       Module = "services\vendor-service";       Port = 8083 },
    @{ Name = "catalog-service";      Module = "services\catalog-service";      Port = 8084 },
    @{ Name = "cart-service";         Module = "services\cart-service";         Port = 8085 },
    @{ Name = "order-service";        Module = "services\order-service";        Port = 8086 },
    @{ Name = "payment-service";      Module = "services\payment-service";      Port = 8087 },
    @{ Name = "delivery-service";     Module = "services\delivery-service";     Port = 8088 },
    @{ Name = "notification-service"; Module = "services\notification-service"; Port = 8089 },
    @{ Name = "billing-service";      Module = "services\billing-service";      Port = 8090 },
    @{ Name = "media-service";        Module = "services\media-service";        Port = 8091 },
    @{ Name = "reporting-service";    Module = "services\reporting-service";    Port = 8092 },
    @{ Name = "api-gateway";          Module = "gateway\api-gateway";           Port = 8080 }
)

$webApps = @(
    @{ Name = "vendor-portal";   Dir = "web\vendor-portal";   Port = 5173 },
    @{ Name = "delivery-portal"; Dir = "web\delivery-portal"; Port = 5174 },
    @{ Name = "buyer-web";       Dir = "web\buyer-web";       Port = 5175 },
    @{ Name = "super-admin";     Dir = "web\super-admin";     Port = 5176 }
)

Require-Command "java" "Install JDK 21 and add to PATH."

$logDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# --- Docker infra ---
if (-not $ServicesOnly) {
    Ensure-Docker
    Write-Host "==> Starting infrastructure (Postgres, Redis, Kafka, ...)"
    docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: docker compose up failed."
        exit 1
    }
    Write-Host "    Waiting for Postgres..."
    $retries = 40
    while ($retries -gt 0) {
        docker exec hlm-postgres pg_isready -U hyperlocalmart 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 2
        $retries--
    }
    if ($retries -eq 0) {
        Write-Warning "Postgres may not be ready yet. Services might fail on first start."
    } else {
        Write-Host "    Postgres is ready."
    }
}

# --- Build fat JARs only when missing or -Rebuild ---
$missingJars = @($services | Where-Object { -not (Get-FatJar $_.Module $_.Name) })
$needBuild = $Rebuild -or ((-not $SkipBuild) -and ($missingJars.Count -gt 0))

if ($SkipBuild -and $missingJars.Count -gt 0) {
    $names = ($missingJars | ForEach-Object { $_.Name }) -join ", "
    Write-Host "ERROR: Missing JARs (run without -SkipBuild, or use -Rebuild): $names"
    exit 1
}

if ($needBuild) {
    Require-Command "mvn" "Install Maven 3.9+ and add to PATH."
    if ($Rebuild) {
        Write-Host "==> Rebuilding all modules (package, skip tests, parallel)"
    } else {
        Write-Host "==> Building fat JARs (first run only; later starts skip this)"
    }
    # install (not only package) so shared libs like common-core stay in sync with fat JARs
    mvn -T 1C install -DskipTests -q
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Maven package failed."
        exit 1
    }
} else {
    Write-Host "==> Using existing fat JARs (skip Maven). Pass -Rebuild after code changes."
}

# --- Java services via java -jar (much faster than mvn spring-boot:run) ---
$javaOpts = @(
    "-XX:TieredStopAtLevel=1",
    "-Dmanagement.health.kafka.enabled=false",
    "-Dspring.datasource.hikari.maximum-pool-size=15",
    "-Dspring.datasource.hikari.minimum-idle=2",
    "-Dspring.datasource.hikari.connection-timeout=10000"
)

foreach ($svc in $services) {
    $healthUrl = "http://localhost:$($svc.Port)/actuator/health"
    if (Test-HttpUp $healthUrl) {
        Write-Host "==> $($svc.Name) already UP on $($svc.Port)"
        continue
    }
    if (Test-PortListening $svc.Port) {
        Write-Warning "$($svc.Name) port $($svc.Port) in use but not healthy - recycling process."
        Stop-PortListener $svc.Port
        Start-Sleep -Seconds 1
    }

    $jar = Get-FatJar $svc.Module $svc.Name
    if (-not $jar) {
        Write-Host "ERROR: JAR not found for $($svc.Name). Run with -Rebuild."
        exit 1
    }

    $logFile = Join-Path $logDir "$($svc.Name).log"
    Write-Host "==> Starting $($svc.Name) on port $($svc.Port)"
    $javaArgs = ($javaOpts + @("-jar", "`"$jar`"")) -join " "
    # cmd redirect: Start-Process cannot send stdout and stderr to the same file.
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "java $javaArgs > `"$logFile`" 2>&1" `
        -WorkingDirectory $Root `
        -WindowStyle Hidden
}

# --- Web apps ---
if (-not $SkipWeb) {
    Ensure-NodePath
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Warning "npm not found. Skipping web apps. Add Node to PATH or install under $NodeHome."
    } else {
        foreach ($app in $webApps) {
            $appDir = Join-Path $Root $app.Dir
            if (-not (Test-Path (Join-Path $appDir "package.json"))) {
                Write-Warning "Skip $($app.Name) - no package.json"
                continue
            }
            if (Test-PortListening $app.Port) {
                Write-Host "==> $($app.Name) already listening on $($app.Port)"
                continue
            }
            $nm = Join-Path $appDir "node_modules"
            if (-not (Test-Path $nm)) {
                Write-Host "==> npm install $($app.Name)"
                Push-Location $appDir
                try { npm install --no-fund --no-audit } finally { Pop-Location }
            }
            $logFile = Join-Path $logDir "$($app.Name).log"
            Write-Host "==> Starting $($app.Name) on port $($app.Port)"
            # Single-string /c so PATH npm.cmd works (quoted Program Files paths break cmd).
            Start-Process -FilePath "cmd.exe" `
                -ArgumentList "/c npm.cmd run dev > `"$logFile`" 2>&1" `
                -WorkingDirectory $appDir `
                -WindowStyle Hidden
        }
    }
}

if ($NoWait) {
    Write-Host ""
    Write-Host "Started in background. Logs: $logDir"
    Write-Host "Health: .\scripts\health-check.ps1"
    exit 0
}

Write-Host ""
Write-Host "==> Waiting for Java health (up to 3 minutes)..."
$deadline = (Get-Date).AddSeconds(180)
$pending = @($services)
while ((Get-Date) -lt $deadline) {
    $still = @()
    foreach ($svc in $pending) {
        if (Test-HttpUp "http://localhost:$($svc.Port)/actuator/health") {
            Write-Host ("    {0,-22} UP" -f $svc.Name)
        } else {
            $still += $svc
        }
    }
    $pending = $still
    if ($pending.Count -eq 0) { break }
    Start-Sleep -Seconds 3
}

if ($pending.Count -gt 0) {
    Write-Host ""
    Write-Host "==> Retrying $($pending.Count) service(s) that did not come up..."
    Start-Sleep -Seconds 5
    foreach ($svc in @($pending)) {
        if (Test-HttpUp "http://localhost:$($svc.Port)/actuator/health") { continue }
        if (Test-PortListening $svc.Port) { continue }
        $jar = Get-FatJar $svc.Module $svc.Name
        if (-not $jar) { continue }
        $logFile = Join-Path $logDir "$($svc.Name).log"
        Write-Host "    retry $($svc.Name)"
        $javaArgs = ($javaOpts + @("-jar", "`"$jar`"")) -join " "
        Start-Process -FilePath "cmd.exe" `
            -ArgumentList "/c", "java $javaArgs > `"$logFile`" 2>&1" `
            -WorkingDirectory $Root `
            -WindowStyle Hidden
    }
    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $deadline) {
        $still = @()
        foreach ($svc in $pending) {
            if (Test-HttpUp "http://localhost:$($svc.Port)/actuator/health") {
                Write-Host ("    {0,-22} UP" -f $svc.Name)
            } else {
                $still += $svc
            }
        }
        $pending = $still
        if ($pending.Count -eq 0) { break }
        Start-Sleep -Seconds 3
    }
}

if ($pending.Count -gt 0) {
    Write-Host ""
    Write-Warning "Still starting (check logs\):"
    foreach ($svc in $pending) {
        Write-Host ("    {0,-22} DOWN  logs\{1}.log" -f $svc.Name, $svc.Name)
    }
} else {
    Write-Host "    All Java services UP."
}

Write-Host ""
if (-not $SkipWeb) {
    Write-Host "==> Waiting for web apps..."
    $webDeadline = (Get-Date).AddSeconds(30)
    foreach ($app in $webApps) {
        $up = $false
        while ((Get-Date) -lt $webDeadline) {
            if (Test-HttpUp "http://localhost:$($app.Port)/") { $up = $true; break }
            Start-Sleep -Seconds 2
        }
        $status = if ($up) { "UP" } else { "DOWN" }
        Write-Host ("    {0,-22} {1}" -f $app.Name, $status)
    }
}

Write-Host ""
Write-Host "Gateway:      http://localhost:8080"
Write-Host "Vendor:       http://localhost:5173"
Write-Host "Hub/agent:    http://localhost:5174"
Write-Host "Buyer:        http://localhost:5175"
Write-Host "Super-admin:  http://localhost:5176"
Write-Host "Logs:         $logDir"
Write-Host "Health:       .\scripts\health-check.ps1"
Write-Host "Pilot vendor: 9876500001 / password"
