# Restart local dev Java services or Vite web apps (Windows PowerShell).
#
#   .\scripts\restart-service.ps1 order-service
#   .\scripts\restart-service.ps1 vendor-portal
#   .\scripts\restart-service.ps1 all-java -SkipBuild
#   .\scripts\restart-service.ps1 all
#   .\scripts\restart-service.ps1 list
#
param(
    [Parameter(Position = 0)]
    [string]$Target = 'order-service',
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$JarVersion = '1.0.0-SNAPSHOT'
$LogDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$JavaServices = @(
    @{ Name = 'user-service';         Module = 'services\user-service';         Port = 8081; Maven = 'services/user-service' },
    @{ Name = 'town-service';         Module = 'services\town-service';         Port = 8082; Maven = 'services/town-service' },
    @{ Name = 'vendor-service';       Module = 'services\vendor-service';       Port = 8083; Maven = 'services/vendor-service' },
    @{ Name = 'catalog-service';      Module = 'services\catalog-service';      Port = 8084; Maven = 'services/catalog-service' },
    @{ Name = 'cart-service';         Module = 'services\cart-service';         Port = 8085; Maven = 'services/cart-service' },
    @{ Name = 'order-service';        Module = 'services\order-service';        Port = 8086; Maven = 'services/order-service' },
    @{ Name = 'payment-service';      Module = 'services\payment-service';      Port = 8087; Maven = 'services/payment-service' },
    @{ Name = 'delivery-service';     Module = 'services\delivery-service';     Port = 8088; Maven = 'services/delivery-service' },
    @{ Name = 'notification-service'; Module = 'services\notification-service'; Port = 8089; Maven = 'services/notification-service' },
    @{ Name = 'billing-service';      Module = 'services\billing-service';      Port = 8090; Maven = 'services/billing-service' },
    @{ Name = 'media-service';        Module = 'services\media-service';        Port = 8091; Maven = 'services/media-service' },
    @{ Name = 'reporting-service';    Module = 'services\reporting-service';    Port = 8092; Maven = 'services/reporting-service' },
    @{ Name = 'api-gateway';          Module = 'gateway\api-gateway';           Port = 8080; Maven = 'gateway/api-gateway' }
)

$WebApps = @(
    @{ Name = 'vendor-portal';   Dir = 'web\vendor-portal';   Port = 5173; HealthPath = '/' },
    @{ Name = 'delivery-portal'; Dir = 'web\delivery-portal'; Port = 5174; HealthPath = '/' },
    @{ Name = 'buyer-web';       Dir = 'web\buyer-web';       Port = 5175; HealthPath = '/shop' },
    @{ Name = 'super-admin';     Dir = 'web\super-admin';     Port = 5176; HealthPath = '/' }
)

$JavaOpts = @(
    '-XX:TieredStopAtLevel=1',
    '-Dmanagement.health.kafka.enabled=false',
    '-Dspring.datasource.hikari.maximum-pool-size=15',
    '-Dspring.datasource.hikari.minimum-idle=2',
    '-Dspring.datasource.hikari.connection-timeout=10000'
)

function Stop-Port([int]$Port) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}

function Wait-Health([string]$Url, [int]$Seconds = 90) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { return $true }
        } catch { }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Build-Maven([string]$MavenModule) {
    if (-not (Get-Command mvn -ErrorAction SilentlyContinue)) {
        Write-Error 'mvn not found. Install Maven or use -SkipBuild.'
        exit 1
    }
    Write-Host "    mvn -pl $MavenModule -am install -DskipTests"
    mvn -pl $MavenModule -am install -DskipTests -q
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Restart-Java([hashtable]$Svc) {
    $name = $Svc.Name
    $port = $Svc.Port
    Write-Host "==> $name ($port)"
    if (-not $SkipBuild) {
        Write-Host '    Building...'
        Build-Maven $Svc.Maven
    }
    $jar = Join-Path $Root (Join-Path $Svc.Module "target\$name-$JarVersion.jar")
    if (-not (Test-Path $jar)) {
        Write-Error "JAR missing: $jar (run without -SkipBuild)"
        exit 1
    }
    Stop-Port $port
    $logFile = Join-Path $LogDir "$name.log"
    Write-Host '    Starting...'
    $javaArgs = ($JavaOpts + @('-jar', "`"$jar`"")) -join ' '
    Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', "java $javaArgs > `"$logFile`" 2>&1" `
        -WorkingDirectory $Root `
        -WindowStyle Hidden
    $health = "http://localhost:$port/actuator/health"
    if (Wait-Health $health) {
        Write-Host "    UP  $health"
    } else {
        Write-Warning "    Health timed out. See logs\$name.log"
        exit 1
    }
}

function Restart-Web([hashtable]$App) {
    $name = $App.Name
    $port = $App.Port
    Write-Host "==> $name ($port)"
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Error 'npm not found. Add Node to PATH.'
        exit 1
    }
    $appDir = Join-Path $Root $App.Dir
    if (-not (Test-Path (Join-Path $appDir 'package.json'))) {
        Write-Error "Missing $appDir"
        exit 1
    }
    Stop-Port $port
    $logFile = Join-Path $LogDir "$name.log"
    Write-Host '    Starting vite...'
    Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', "npm.cmd run dev > `"$logFile`" 2>&1" `
        -WorkingDirectory $appDir `
        -WindowStyle Hidden
    $url = "http://localhost:$port$($App.HealthPath)"
    if (Wait-Health $url 120) {
        Write-Host "    UP  $url"
    } else {
        Write-Warning "    Timed out. See logs\$name.log"
        exit 1
    }
}

function Show-List {
    Write-Host 'Java (port):'
    $JavaServices | ForEach-Object { Write-Host "  $($_.Name)  $($_.Port)" }
    Write-Host 'Web (port):'
    $WebApps | ForEach-Object { Write-Host "  $($_.Name)  $($_.Port)" }
    Write-Host 'Groups:  all-java  all-web  all  both (order-service + buyer-web)'
}

$javaByName = @{}
foreach ($s in $JavaServices) { $javaByName[$s.Name] = $s }
$webByName = @{}
foreach ($w in $WebApps) { $webByName[$w.Name] = $w }

$Target = $Target.Trim().ToLower()
if ($Target -eq 'list' -or $Target -eq 'help' -or $Target -eq '-h' -or $Target -eq '--help') {
    Show-List
    exit 0
}

$queue = [System.Collections.Generic.List[string]]::new()
switch ($Target) {
    'all-java' { $JavaServices | ForEach-Object { $queue.Add($_.Name) } }
    'all-web'  { $WebApps | ForEach-Object { $queue.Add($_.Name) } }
    'all'      {
        $JavaServices | ForEach-Object { $queue.Add($_.Name) }
        $WebApps | ForEach-Object { $queue.Add($_.Name) }
    }
    'both'     { $queue.Add('order-service'); $queue.Add('buyer-web') }
    default    {
        if ($javaByName.ContainsKey($Target)) { $queue.Add($Target) }
        elseif ($webByName.ContainsKey($Target)) { $queue.Add($Target) }
        else {
            Write-Error "Unknown target '$Target'. Run: .\scripts\restart-service.ps1 list"
            exit 1
        }
    }
}

foreach ($item in $queue) {
    if ($javaByName.ContainsKey($item)) { Restart-Java $javaByName[$item] }
    elseif ($webByName.ContainsKey($item)) { Restart-Web $webByName[$item] }
}

Write-Host 'Done.'
