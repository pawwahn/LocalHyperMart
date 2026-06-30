# Check health of all running HyperLocalMart services
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
    @{ Name = "notification-service"; Url = "http://localhost:8089/actuator/health" }
)

foreach ($ep in $endpoints) {
    try {
        $r = Invoke-WebRequest -Uri $ep.Url -UseBasicParsing -TimeoutSec 5
        $status = if ($r.StatusCode -eq 200) { "UP" } else { "HTTP $($r.StatusCode)" }
        Write-Host ("{0,-22} {1}" -f $ep.Name, $status)
    } catch {
        Write-Host ("{0,-22} DOWN" -f $ep.Name)
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
