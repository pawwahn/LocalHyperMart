# HyperLocalMart — Daily Steps

Run all commands in PowerShell from the project root:

    cd D:\LocalHyperMart\LocalHyperMart

---

# PART A — Startup (every day after reboot)

## A1. Start Docker Desktop

- Open **Docker Desktop** and wait until it shows **Running** (whale icon steady).
- Skip if Docker is already running.

## A2. Start infrastructure (Postgres, Redis, Kafka, etc.)

    docker compose up -d

Wait ~30 seconds. Check:

    docker compose ps

All containers should show **running**.

## A3. Start all Java microservices

    .\scripts\start-dev.ps1 -SkipBuild -ServicesOnly

- Uses the last Maven build (faster).
- If you changed code or get class-not-found errors:

    mvn clean install -DskipTests
    .\scripts\start-dev.ps1 -SkipBuild -ServicesOnly

Services start in the background. Logs are in `logs\`.
Wait **2–3 minutes** before checking health.

## A4. Verify everything is up

    .\scripts\health-check.ps1

Expected: all 10 services **UP**, and `GET /towns -> 1 town(s)`.

If a service is **DOWN**:

    Get-Content .\logs\<service-name>.log -Tail 40

## A5. Quick smoke (optional)

    Invoke-RestMethod -Uri "http://localhost:8080/api/v1/towns?status=ENABLED"

    Invoke-RestMethod -Uri "http://localhost:8080/api/v1/catalog/items?townId=a1111111-1111-4111-8111-111111111111"

## A6. Start vendor portal UI (optional)

Stack for all web apps: **Vite + React + TypeScript** (same for vendor, hub, buyer later).

Node portable (if not on PATH): `C:\Tools\node` — add to PATH for the session:

    $env:Path = "C:\Tools\node;" + $env:Path

Then:

    cd D:\LocalHyperMart\LocalHyperMart\web\vendor-portal
    npm install
    npm run dev

Open **http://localhost:5173**

Pilot login: phone `9876500001` / password `password`

Requires backend gateway UP (Part A3–A4). The Vite dev server proxies `/api` to `http://localhost:8080`.

## A7. Start delivery portal UI (hub + agent)

    $env:Path = "C:\Tools\node;" + $env:Path
    cd D:\LocalHyperMart\LocalHyperMart\web\delivery-portal
    npm install
    npm run dev

Open **http://localhost:5174**

| Role | Phone | Password |
|---|---|---|
| Hub admin | 9876500100 | password |
| Agent | 9876500200 | password |

## A8. Start buyer web UI

    $env:Path = "C:\Tools\node;" + $env:Path
    cd D:\LocalHyperMart\LocalHyperMart\web\buyer-web
    npm install
    npm run dev

Open **http://localhost:5175**

- Register a buyer (password example: `Buyer@123`) or login
- Shop → Cart → Add address → Place COD order → Orders

---

# PART B — Full E2E pilot test (buyer → vendor → hub → agent)

Do this after services are UP. Use **one PowerShell window** so variables (`$buyerToken`, `$orderId`, etc.) stay available.

## Reference IDs (pilot seed)

| Role | Phone | Password | Extra header / ID |
|---|---|---|---|
| Buyer | register a new one | (strong password) | — |
| Vendor (Ravi Kirana) | 9876500001 | password | X-Vendor-Id: b1111111-1111-4111-8111-111111111111 |
| Hub admin | 9876500100 | password | Hub: d1111111-1111-4111-8111-111111111111 |
| Delivery agent | 9876500200 | password | Agent: e1111111-1111-4111-8111-111111111111 |

| What | UUID |
|---|---|
| Town (Narsaraopet) | a1111111-1111-4111-8111-111111111111 |
| Listing (Tomato @ Ravi) | 01111111-1111-4111-8111-111111111111 |
| Gateway base URL | http://localhost:8080 |

Password for register must include upper, lower, digit, and special character (example: `Buyer@123`).

---

## B1. Register a buyer (or login if already registered)

    $buyerPhone = "9876511111"
    $registerBody = @{
      phone     = $buyerPhone
      password  = "Buyer@123"
      firstName = "Test"
      lastName  = "Buyer"
    } | ConvertTo-Json

    Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/auth/register" `
      -ContentType "application/json" -Body $registerBody

    $buyerLogin = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/auth/login" `
      -ContentType "application/json" `
      -Body (@{ phone = $buyerPhone; password = "Buyer@123" } | ConvertTo-Json)

    $buyerToken = $buyerLogin.data.accessToken
    $buyerHdr = @{ Authorization = "Bearer $buyerToken" }
    Write-Host "Buyer token ready. Roles: $($buyerLogin.data.roles)"

If phone is already taken, skip register and only run login.

---

## B2. Set default town

    Invoke-RestMethod -Method PATCH -Uri "http://localhost:8080/api/v1/users/me" `
      -ContentType "application/json" -Headers $buyerHdr `
      -Body '{"defaultTownId":"a1111111-1111-4111-8111-111111111111"}'

---

## B3. Browse catalog

    $catalog = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/catalog/items?townId=a1111111-1111-4111-8111-111111111111"
    $catalog.data.items | ForEach-Object { "$($_.name) | $($_.shopName) | Rs.$($_.price) | $($_.listingId)" }

Expected: about 4 items (Tomato, Onion, Rice across two shops).

---

## B4. Add item to cart

    $cartAdd = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/cart/items" `
      -ContentType "application/json" -Headers $buyerHdr -Body (@{
        townId    = "a1111111-1111-4111-8111-111111111111"
        listingId = "01111111-1111-4111-8111-111111111111"
        quantity  = 2
      } | ConvertTo-Json)

    $cartId = $cartAdd.data.cartId
    Write-Host "cartId = $cartId"

    # View cart
    Invoke-RestMethod -Uri "http://localhost:8080/api/v1/cart?townId=a1111111-1111-4111-8111-111111111111" `
      -Headers $buyerHdr

---

## B5. Add delivery address

    $addr = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/addresses" `
      -ContentType "application/json" -Headers $buyerHdr -Body (@{
        townId         = "a1111111-1111-4111-8111-111111111111"
        label          = "Home"
        recipientName  = "Test Buyer"
        recipientPhone = $buyerPhone
        line1          = "MG Road"
        pincode        = "522601"
        isDefault      = $true
      } | ConvertTo-Json)

    $addressId = $addr.data.id
    if (-not $addressId) { $addressId = $addr.data.addressId }
    Write-Host "addressId = $addressId"

---

## B6. Checkout (COD)

Use a unique Idempotency-Key each time (change the number if you retry).

    $idemKey = "checkout-$(Get-Date -Format 'yyyyMMddHHmmss')"
    $order = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/orders" `
      -ContentType "application/json" `
      -Headers @{ Authorization = "Bearer $buyerToken"; "Idempotency-Key" = $idemKey } `
      -Body (@{
        townId        = "a1111111-1111-4111-8111-111111111111"
        cartId        = $cartId
        addressId     = $addressId
        paymentMethod = "COD"
      } | ConvertTo-Json)

    $orderId = $order.data.orderId
    Write-Host "orderId = $orderId"
    $order.data | Format-List

---

## B7. Buyer — list my orders

    Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders?townId=a1111111-1111-4111-8111-111111111111&page=0" `
      -Headers $buyerHdr

---

## B8. Vendor — login and mark sub-order READY

    $vendorLogin = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/auth/login" `
      -ContentType "application/json" `
      -Body '{"phone":"9876500001","password":"password"}'
    $vendorToken = $vendorLogin.data.accessToken
    $vendorHdr = @{
      Authorization = "Bearer $vendorToken"
      "X-Vendor-Id" = "b1111111-1111-4111-8111-111111111111"
    }

    # List new sub-orders for Ravi Kirana
    $subs = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders/vendor/sub-orders?status=PLACED&page=0" `
      -Headers $vendorHdr
    $subs.data.items | ForEach-Object { "$($_.subOrderId) | $($_.orderNumber) | $($_.status) | Rs.$($_.subtotal)" }

    $subOrderId = $subs.data.items[0].subOrderId
    Write-Host "subOrderId = $subOrderId"

    # Mark ready for pickup
    Invoke-RestMethod -Method POST `
      -Uri "http://localhost:8080/api/v1/orders/vendor/sub-orders/$subOrderId/ready" `
      -Headers $vendorHdr

Optional — vendor dashboard:

    Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders/vendor/dashboard" -Headers $vendorHdr

---

## B9. Hub admin — assign pickup agent

    $hubLogin = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/auth/login" `
      -ContentType "application/json" `
      -Body '{"phone":"9876500100","password":"password"}'
    $hubToken = $hubLogin.data.accessToken
    $hubHdr = @{ Authorization = "Bearer $hubToken" }

    $pickup = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/delivery/assignments/pickup" `
      -ContentType "application/json" -Headers $hubHdr -Body (@{
        vendorSubOrderId = $subOrderId
        agentId          = "e1111111-1111-4111-8111-111111111111"
      } | ConvertTo-Json)

    $pickupAssignmentId = $pickup.data.assignmentId
    Write-Host "pickupAssignmentId = $pickupAssignmentId"

---

## B10. Agent — pick up from vendor

    $agentLogin = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/auth/login" `
      -ContentType "application/json" `
      -Body '{"phone":"9876500200","password":"password"}'
    $agentToken = $agentLogin.data.accessToken
    $agentHdr = @{ Authorization = "Bearer $agentToken" }

    Invoke-RestMethod -Method POST `
      -Uri "http://localhost:8080/api/v1/delivery/assignments/$pickupAssignmentId/picked-from-vendor" `
      -ContentType "application/json" -Headers $agentHdr `
      -Body '{"note":"Verified qty"}'

---

## B11. Hub admin — mark sub-order at hub

    Invoke-RestMethod -Method POST `
      -Uri "http://localhost:8080/api/v1/delivery/sub-orders/$subOrderId/at-hub" `
      -Headers $hubHdr

---

## B12. Hub admin — assign last-mile delivery

    $lastMile = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/delivery/assignments/last-mile" `
      -ContentType "application/json" -Headers $hubHdr -Body (@{
        orderId = $orderId
        agentId = "e1111111-1111-4111-8111-111111111111"
      } | ConvertTo-Json)

    $lastMileAssignmentId = $lastMile.data.assignmentId
    Write-Host "lastMileAssignmentId = $lastMileAssignmentId"

OTP is sent via notification stub (no real SMS). Fetch it from Postgres:

    docker exec hlm-postgres psql -U hyperlocalmart -d hyperlocalmart_notification -c "SELECT body FROM notification_logs ORDER BY created_at DESC LIMIT 5;"

Look for a line containing `OTP` / digits and copy the code into `$otp` below.

    $otp = "123456"   # <-- replace with OTP from the query above

---

## B13. Agent — pick from hub and deliver with OTP

    Invoke-RestMethod -Method POST `
      -Uri "http://localhost:8080/api/v1/delivery/assignments/$lastMileAssignmentId/picked-from-hub" `
      -Headers $agentHdr

    Invoke-RestMethod -Method POST `
      -Uri "http://localhost:8080/api/v1/delivery/assignments/$lastMileAssignmentId/deliver" `
      -ContentType "application/json" -Headers $agentHdr -Body (@{
        otp           = $otp
        recipientName = "Test Buyer"
      } | ConvertTo-Json)

Order should move to **DELIVERED**.

---

## B14. Buyer — invoice PDF + order history

    # Order detail
    Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders/$orderId" -Headers $buyerHdr

    # Download invoice PDF to Desktop
    $invoicePath = "$env:USERPROFILE\Desktop\invoice-$orderId.pdf"
    Invoke-WebRequest -Uri "http://localhost:8080/api/v1/orders/$orderId/invoice" `
      -Headers $buyerHdr -OutFile $invoicePath
    Write-Host "Invoice saved: $invoicePath"

Optional reorder:

    Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/orders/$orderId/reorder" `
      -Headers $buyerHdr

---

## B15. Hub admin — dashboard (optional)

    Invoke-RestMethod -Uri "http://localhost:8080/api/v1/delivery/hubs/me" -Headers $hubHdr

    Invoke-RestMethod -Uri "http://localhost:8080/api/v1/delivery/hubs/d1111111-1111-4111-8111-111111111111/dashboard" `
      -Headers $hubHdr

    Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders/admin?townId=a1111111-1111-4111-8111-111111111111&page=0" `
      -Headers $hubHdr

---

## E2E success checklist

| Step | Expected |
|---|---|
| Register / login buyer | accessToken returned |
| Catalog browse | 4 items |
| Add to cart | cartId returned |
| Checkout COD | orderId returned |
| Vendor mark ready | sub-order READY_FOR_PICKUP |
| Pickup + at hub | assignment completed / at hub |
| Last-mile + OTP deliver | order DELIVERED |
| Invoice PDF | file downloads |

---

# PART C — End of day (optional — free RAM)

Stop Java services (ports 8080–8089):

    8080,8081,8082,8083,8084,8085,8086,8087,8088,8089 | ForEach-Object {
      Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    }

Stop Docker infra:

    docker compose stop

---

# PART D — Troubleshooting

| Problem | Fix |
|---|---|
| Script blocked | `Set-ExecutionPolicy -Scope Process Bypass` |
| Port already in use | Stop process on that port (see service table below) |
| All services DOWN | Start services with `start-dev.ps1` first, then health-check |
| Docker not running | Start Docker Desktop, then `docker compose up -d` |
| Missing or invalid JWT | Login again; send `Authorization: Bearer <token>` |
| Catalog 500 | Restart catalog-service after latest fix |
| addressId / cartId null | Inspect `$addr` / `$cartAdd` with `| ConvertTo-Json -Depth 5` |
| No OTP in logs | Confirm last-mile assignment succeeded; re-query notification_logs |
| Vendor empty sub-orders | Use correct X-Vendor-Id; status may not be PLACED |

---

# PART E — Service ports (individual restart)

| Service | Port | Restart command |
|---|---|---|
| api-gateway | 8080 | `mvn -pl gateway/api-gateway spring-boot:run` |
| user-service | 8081 | `mvn -pl services/user-service spring-boot:run` |
| town-service | 8082 | `mvn -pl services/town-service spring-boot:run` |
| vendor-service | 8083 | `mvn -pl services/vendor-service spring-boot:run` |
| catalog-service | 8084 | `mvn -pl services/catalog-service spring-boot:run` |
| cart-service | 8085 | `mvn -pl services/cart-service spring-boot:run` |
| order-service | 8086 | `mvn -pl services/order-service spring-boot:run` |
| payment-service | 8087 | `mvn -pl services/payment-service spring-boot:run` |
| delivery-service | 8088 | `mvn -pl services/delivery-service spring-boot:run` |
| notification-service | 8089 | `mvn -pl services/notification-service spring-boot:run` |

Stop one port before restart:

    Get-NetTCPConnection -LocalPort 8084 -ErrorAction SilentlyContinue |
      ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

Gateway URL: http://localhost:8080

To regenerate this Word file after editing the .md source:

    powershell -ExecutionPolicy Bypass -File .\scripts\md-to-docx.ps1 `
      -InputFile ".\Documents\DailySteps.md" `
      -OutputFile ".\Documents\DailySteps.docx"
