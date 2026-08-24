# Check health of HyperLocalMart Java services and web apps
$endpoints = @(
    @{ Name = "api-gateway";          Url = "http://localhost:8080/actuator/health" },
    @{ Name = "user-service";         Url = "http://localhost:8081/actuator/health" },
    @{ Name = "town-service";         Url = "http://localhost:8082/actuator/health" },
    @{ Name = "vendor-service";       Url = "http://localhost:8083/actuator/health" },
    @{ Name = "catalog-service";      Url = "http://localhost:8084/actuator/health" },
    @{ Name = "cart-service";         Url = "http://localhost:8085/actuator/health" },
    @{ Name = "order-service";        Url = "http://localhost:8086/actuator/health" },
    @{ Name = "payment-service";      Url = "http://localhost:8087/actuator/health" },
    @{ Name = "delivery-service";     Url = "http://localhost:8088/actuator/health" },
    @{ Name = "notification-service"; Url = "http://localhost:8089/actuator/health" },
    @{ Name = "billing-service";      Url = "http://localhost:8090/actuator/health" },
    @{ Name = "media-service";        Url = "http://localhost:8091/actuator/health" },
    @{ Name = "reporting-service";    Url = "http://localhost:8092/actuator/health" }
)

$web = @(
    @{ Name = "vendor-portal";   Url = "http://localhost:5173" },
    @{ Name = "delivery-portal"; Url = "http://localhost:5174" },
    @{ Name = "buyer-web";       Url = "http://localhost:5175" },
    @{ Name = "super-admin";     Url = "http://localhost:5176" }
)

Write-Host "Java"
foreach ($ep in $endpoints) {
    try {
        $r = Invoke-WebRequest -Uri $ep.Url -UseBasicParsing -TimeoutSec 3
        $status = if ($r.StatusCode -eq 200) { "UP" } else { "HTTP $($r.StatusCode)" }
        Write-Host ("  {0,-22} {1}" -f $ep.Name, $status)
    } catch {
        Write-Host ("  {0,-22} DOWN" -f $ep.Name)
    }
}

Write-Host ""
Write-Host "Web"
foreach ($ep in $web) {
    try {
        $r = Invoke-WebRequest -Uri $ep.Url -UseBasicParsing -TimeoutSec 3
        $status = if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { "UP" } else { "HTTP $($r.StatusCode)" }
        Write-Host ("  {0,-22} {1}" -f $ep.Name, $status)
    } catch {
        Write-Host ("  {0,-22} DOWN" -f $ep.Name)
    }
}

Write-Host ""
Write-Host "Public smoke test:"
try {
    $towns = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/towns?status=ENABLED" -TimeoutSec 5
    $count = $towns.data.items.Count
    Write-Host "GET /towns -> $count town(s)"
} catch {
    Write-Host "GET /towns -> failed (gateway or town-service not ready)"
}
