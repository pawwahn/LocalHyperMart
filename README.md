# HyperLocalMart

Town-based hyperlocal marketplace for Tier-2/3 India. Monorepo with Java 21 microservices, Flutter mobile apps (future), and React web portals (future).

## Documentation

| Doc | Description |
|---|---|
| [docs/01_PRD.md](docs/01_PRD.md) | Product requirements |
| [docs/02_SYSTEM_DESIGN.md](docs/02_SYSTEM_DESIGN.md) | Architecture & flows |
| [docs/04_DATABASE_SCHEMA_AND_ERD.md](docs/04_DATABASE_SCHEMA_AND_ERD.md) | Database schema |
| [docs/05_API_CONTRACTS.md](docs/05_API_CONTRACTS.md) | REST API contracts |

## Prerequisites

- **Java 21** (JDK)
- **Maven 3.9+**
- **Docker Desktop** (for infrastructure)

## Quick Start

### 1. Start infrastructure

```bash
docker compose up -d
```

Or on Windows (starts infra + build + all services):

```powershell
cd LocalHyperMart
.\scripts\start-dev.ps1
.\scripts\health-check.ps1
```

**Prerequisites:** Docker Desktop, Java 21, Maven 3.9+ on PATH.

This starts:

| Service | URL |
|---|---|
| PostgreSQL | `localhost:5432` (user/pass: `hyperlocalmart`) |
| Redis | `localhost:6379` (password: `hyperlocalmart`) |
| Kafka | `localhost:9092` |
| Kafka UI | http://localhost:8099 |
| OpenSearch | http://localhost:9200 |
| MinIO (S3 dev) | http://localhost:9000 (console: 9001) |

### 2. Build all modules

```bash
mvn clean install -DskipTests
```

### 3. Run a service (example: user-service)

```bash
mvn -pl services/user-service spring-boot:run
```

### 4. Run API Gateway (recommended entry point)

```bash
mvn -pl gateway/api-gateway spring-boot:run
```

Gateway: http://localhost:8080 — validates JWT on protected routes and forwards `Authorization` to services.

**Public routes (no JWT):** `POST /auth/register`, `/auth/login`, `/auth/refresh`, forgot/reset password, `GET /towns`, `GET /catalog/items`

**Internal service routes** (`/api/v1/internal/**`) are not exposed via the gateway; services call each other directly on localhost.

### 5. Health checks

| Service | Port | Health |
|---|---|---|
| api-gateway | 8080 | http://localhost:8080/actuator/health |
| user-service | 8081 | http://localhost:8081/actuator/health |
| town-service | 8082 | http://localhost:8082/actuator/health |
| vendor-service | 8083 | ... |
| catalog-service | 8084 | ... |
| cart-service | 8085 | ... |
| order-service | 8086 | ... |
| payment-service | 8087 | ... |
| delivery-service | 8088 | ... |
| notification-service | 8089 | ... |
| billing-service | 8090 | ... |
| media-service | 8091 | ... |
| reporting-service | 8092 | ... |

Internal info endpoint (per service): `GET /api/v1/internal/info`

## Project Structure

```
hyperlocalmart/
├── libs/common-core/          # Shared API envelope, exceptions, correlation ID
├── gateway/api-gateway/       # Spring Cloud Gateway
├── services/                  # Microservices (one DB each)
├── apps/                      # Flutter apps (TODO)
├── web/                       # React portals (Vite+TS) — vendor-portal in progress
├── infra/                     # Postgres init, K8s (TODO)
├── docs/                      # PRD, design, API contracts
└── docker-compose.yml
```

## Flyway Migrations

- **user-service**, **town-service**, **order-service**: full `V1__init.sql` schemas
- Other services: `V1__init.sql` placeholder — extend per `docs/04_DATABASE_SCHEMA_AND_ERD.md`

## Implementation Status

| Step | Service | Status |
|---|---|---|
| Register / login / JWT | user-service | Done |
| Town list + pilot seed | town-service | Done |
| Set default town on profile | user-service | Done (`PATCH /users/me`) |
| Vendor shops (pilot seed) | vendor-service | Done |
| Browse catalog | catalog-service | Done (`GET /catalog/items`) |
| Cart (add/get/update/remove) | cart-service | Done |
| Delivery addresses | user-service | Done |
| Checkout / create order | order-service | Done (`POST /orders`) |
| Gateway JWT filter | api-gateway | Done |
| Payment (initiate + webhooks) | payment-service | Done |
| Order list (buyer history) | order-service | Done (`GET /orders?townId=...`) |
| Vendor sub-orders (ready/reject) | order-service | Done |
| Refund stub on vendor reject | payment-service | Done (`POST /internal/payments/refunds`) |
| Pilot vendor/hub/agent users | user-service | Done (seed migration V3) |
| Delivery pickup assignment | delivery-service | Done |
| SMS notification stub | notification-service | Done (internal send + logs) |
| Last-mile + OTP delivery | delivery-service | Done |
| Vendor listing CRUD | catalog-service | Done |
| Buyer reorder | order-service | Done (`POST /orders/{id}/reorder`) |
| Invoice PDF | order-service | Done (`GET /orders/{id}/invoice`) |
| Vendor dashboard | order-service | Done (`GET /orders/vendor/dashboard`) |
| Hub admin order views | order-service | Done (`GET /orders/admin`) |
| Agent CRUD | delivery-service | Done (`POST/GET/PATCH /delivery/agents`) |
| Hub dashboard | delivery-service | Done (`GET /delivery/hubs/{hubId}/dashboard`) |
| Delivery reassign | delivery-service | Done (`PATCH /delivery/assignments/{id}/reassign`) |

## Phase 1 Progress Checklist

Track overall MVP completion. Status: **Done** | **Partial** | **Not started**

| Area | Item | Status |
|---|---|---|
| **Buyer** | Register / login / JWT | Done |
| | Town selection + addresses | Done |
| | Catalog browse + cart + checkout | Done |
| | Order history, detail, reorder | Done |
| | Invoice PDF | Done |
| | FCM device registration | Not started |
| | Flutter buyer app | Not started |
| **Vendor** | Sub-orders (ready/reject) | Done |
| | Listing CRUD | Done |
| | Dashboard (orders + earnings) | Done |
| | Registration / approval flow | Not started |
| | Bulk price CSV | Not started |
| | Flutter vendor app | Not started |
| **Hub / delivery** | Pickup + hub receipt + last-mile + OTP | Done |
| | Admin order views | Done |
| | Agent CRUD | Done |
| | Hub dashboard | Done |
| | Delivery reassign | Done |
| | Hub admin PIN | Not started |
| | Agent offline sync | Not started |
| | Flutter delivery app | Not started |
| **Platform** | API gateway + JWT | Done |
| | Payment stub + refund stub | Partial |
| | Notification SMS stub | Partial |
| | Real Razorpay / MSG91 / FCM | Not started |
| | Kafka event bus | Not started |
| | OpenSearch catalog search | Not started |
| | billing / media / reporting services | Not started |
| | Settlements + COD reconciliation | Not started |
| | Super-admin town/vendor/catalog admin | Not started |
| | React web portals | Not started |
| **Ops** | Docker Compose infra | Done |
| | Dev scripts (`start-dev.ps1`) | Done |
| | CI/CD, K8s, integration tests | Not started |

**Rough completion:** core pilot backend flow ~**80%** · all Phase 1 backend APIs ~**60%** · full Phase 1 MVP (incl. apps) ~**35%**

**Architecture:** Loosely coupled microservices and UI (wireframe-resilient) — see `docs/02_SYSTEM_DESIGN.md` §2.1–§2.2 and `.cursor/rules/loose-coupling.mdc`.

### Pilot dev accounts (password: `password`)

| Role | Phone | Vendor / Hub / Agent ID |
|---|---|---|
| Vendor (Ravi Kirana) | `9876500001` | `X-Vendor-Id: b1111111-1111-4111-8111-111111111111` |
| Vendor (Siva General) | `9876500002` | `X-Vendor-Id: b2222222-2222-4222-8222-222222222222` |
| Hub admin | `9876500100` | Hub `d1111111-1111-4111-8111-111111111111` |
| Delivery agent | `9876500200` | Agent `e1111111-1111-4111-8111-111111111111` |

Login via gateway: `POST /api/v1/auth/login` with `{ "phone": "9876500001", "password": "password" }`

### Buyer flow (manual test)

Pilot town UUID: `a1111111-1111-4111-8111-111111111111` (Narsaraopet)

```bash
# 1. List towns (via gateway, public)
GET http://localhost:8080/api/v1/towns?status=ENABLED

# 2. Register + login (via gateway)
POST http://localhost:8080/api/v1/auth/register
POST http://localhost:8080/api/v1/auth/login

# 3. Save selected town
PATCH /api/v1/users/me
Authorization: Bearer <token>
{ "defaultTownId": "a1111111-1111-4111-8111-111111111111" }

# 4. Browse catalog (public; vendor-service must be running for shop names)
GET http://localhost:8084/api/v1/catalog/items?townId=a1111111-1111-4111-8111-111111111111
GET http://localhost:8084/api/v1/catalog/items?townId=a1111111-1111-4111-8111-111111111111&q=tomato

# 5. Add to cart (JWT required; catalog + vendor + town services running)
POST http://localhost:8085/api/v1/cart/items
Authorization: Bearer <token>
{
  "townId": "a1111111-1111-4111-8111-111111111111",
  "listingId": "01111111-1111-4111-8111-111111111111",
  "quantity": 2
}

GET http://localhost:8085/api/v1/cart?townId=a1111111-1111-4111-8111-111111111111
Authorization: Bearer <token>

# 6. Add delivery address
POST http://localhost:8081/api/v1/addresses
Authorization: Bearer <token>
{
  "townId": "a1111111-1111-4111-8111-111111111111",
  "label": "Home",
  "recipientName": "Pavan Kumar",
  "recipientPhone": "9876543210",
  "line1": "MG Road",
  "pincode": "522601",
  "isDefault": true
}

# 7. Checkout (COD example)
POST http://localhost:8080/api/v1/orders
Authorization: Bearer <token>
Idempotency-Key: checkout-attempt-001
{ "townId": "...", "cartId": "...", "addressId": "...", "paymentMethod": "COD" }

# 8. Online checkout + simulate payment webhook
POST http://localhost:8080/api/v1/orders
Idempotency-Key: checkout-online-001
{ "townId": "...", "cartId": "...", "addressId": "...", "paymentMethod": "ONLINE", "paymentGateway": "RAZORPAY" }
# → returns payment.upiIntent

POST http://localhost:8080/api/v1/payments/webhooks/razorpay
X-Razorpay-Signature: dev-bypass
{ "orderId": "<orderId>", "gatewayPaymentId": "pay_test_123" }
# → order moves to PLACED

# 9. List my orders
GET http://localhost:8080/api/v1/orders?townId=a1111111-1111-4111-8111-111111111111&page=0
Authorization: Bearer <token>

# 10. Vendor sub-orders (JWT must include ROLE_VENDOR; pass vendor UUID from seed)
GET http://localhost:8080/api/v1/orders/vendor/sub-orders?status=PLACED&page=0
Authorization: Bearer <vendor-token>
X-Vendor-Id: b1111111-1111-4111-8111-111111111111

POST http://localhost:8080/api/v1/orders/vendor/sub-orders/{subOrderId}/ready
Authorization: Bearer <vendor-token>
X-Vendor-Id: b1111111-1111-4111-8111-111111111111

POST http://localhost:8080/api/v1/orders/vendor/sub-orders/{subOrderId}/reject
Authorization: Bearer <vendor-token>
X-Vendor-Id: b1111111-1111-4111-8111-111111111111
{ "reason": "Out of stock today" }
# → master order CANCELLED; online paid orders trigger refund stub (5 working days SLA)

# 11. Vendor login (pilot seed user)
POST http://localhost:8080/api/v1/auth/login
{ "phone": "9876500001", "password": "password" }
# → JWT with VENDOR role; use X-Vendor-Id header on vendor sub-order APIs

# 12. Delivery pickup flow (after vendor marks sub-order READY_FOR_PICKUP)
POST http://localhost:8080/api/v1/auth/login
{ "phone": "9876500100", "password": "password" }
# Hub admin assigns pickup agent
POST http://localhost:8080/api/v1/delivery/assignments/pickup
Authorization: Bearer <hub-admin-token>
{ "vendorSubOrderId": "<subOrderId>", "agentId": "e1111111-1111-4111-8111-111111111111" }

# Agent marks picked from vendor
POST http://localhost:8080/api/v1/auth/login
{ "phone": "9876500200", "password": "password" }
POST http://localhost:8080/api/v1/delivery/assignments/{assignmentId}/picked-from-vendor
Authorization: Bearer <agent-token>
{ "note": "Verified qty" }

# Hub admin marks at hub
POST http://localhost:8080/api/v1/delivery/sub-orders/{subOrderId}/at-hub
Authorization: Bearer <hub-admin-token>

# 13. Last-mile delivery (after order at hub)
POST http://localhost:8080/api/v1/delivery/assignments/last-mile
Authorization: Bearer <hub-admin-token>
{ "orderId": "<orderId>", "agentId": "e1111111-1111-4111-8111-111111111111" }
# → OTP sent via notification stub (check notification_logs.body for dev OTP)

POST http://localhost:8080/api/v1/delivery/assignments/{assignmentId}/picked-from-hub
Authorization: Bearer <agent-token>

POST http://localhost:8080/api/v1/delivery/assignments/{assignmentId}/deliver
Authorization: Bearer <agent-token>
{ "otp": "<otp-from-notification-log>", "recipientName": "Pavan" }
# → order status DELIVERED

# 14. Vendor — manage listings
GET http://localhost:8080/api/v1/catalog/master-items?page=0
GET http://localhost:8080/api/v1/catalog/vendors/me/listings
Authorization: Bearer <vendor-token>
X-Vendor-Id: b1111111-1111-4111-8111-111111111111

POST http://localhost:8080/api/v1/catalog/vendors/me/listings
Authorization: Bearer <vendor-token>
X-Vendor-Id: b1111111-1111-4111-8111-111111111111
{ "masterItemId": "f3333333-3333-4333-8333-333333333333", "price": 45.00, "active": true }

# 14b. Vendor — dashboard (today/week counts, earnings, recent sub-orders)
GET http://localhost:8080/api/v1/orders/vendor/dashboard?from=2026-06-01&to=2026-06-24
Authorization: Bearer <vendor-token>
X-Vendor-Id: b1111111-1111-4111-8111-111111111111
# → orderCountToday, orderCountWeek, earningsGross, statusCounts, recentOrders[]

# 15. Buyer — reorder from past order
POST http://localhost:8080/api/v1/orders/{orderId}/reorder
Authorization: Bearer <buyer-token>
# → returns cartId + priceChanged flag

# 15b. Buyer — download invoice PDF (PLACED/DELIVERED/CANCELLED orders)
GET http://localhost:8080/api/v1/orders/{orderId}/invoice
Authorization: Bearer <buyer-token>
# → application/pdf attachment; also see invoicePdfUrl on GET /orders/{orderId}

# 16. Hub admin — list and view town orders
GET http://localhost:8080/api/v1/orders/admin?townId=a1111111-1111-4111-8111-111111111111&page=0
Authorization: Bearer <hub-admin-token>

GET http://localhost:8080/api/v1/orders/admin/{orderId}?townId=a1111111-1111-4111-8111-111111111111
Authorization: Bearer <hub-admin-token>
# → includes subOrders[] and delivery assignments[]

# 17. Hub admin — manage delivery agents
GET http://localhost:8080/api/v1/delivery/agents?hubId=d1111111-1111-4111-8111-111111111111
Authorization: Bearer <hub-admin-token>

POST http://localhost:8080/api/v1/delivery/agents
Authorization: Bearer <hub-admin-token>
{ "userId": "<registered-user-uuid>", "name": "Agent Name", "phone": "9876500300" }

PATCH http://localhost:8080/api/v1/delivery/agents/{agentId}/status
Authorization: Bearer <hub-admin-token>
{ "status": "INACTIVE" }
# DISABLED requires SUPER_ADMIN role

# 18. Hub admin — dashboard + reassign
GET http://localhost:8080/api/v1/delivery/hubs/me
Authorization: Bearer <hub-admin-token>

GET http://localhost:8080/api/v1/delivery/hubs/d1111111-1111-4111-8111-111111111111/dashboard
Authorization: Bearer <hub-admin-token>
# → activeAgents, order queues, pickup/last-mile counts, activeAssignments

PATCH http://localhost:8080/api/v1/delivery/assignments/{assignmentId}/reassign
Authorization: Bearer <hub-admin-token>
{ "newAgentId": "e1111111-1111-4111-8111-111111111111", "reason": "Agent unavailable" }
```

Notifications (ORDER_PLACED, SUB_ORDER_READY, OUT_FOR_DELIVERY, ORDER_DELIVERED, etc.) are sent asynchronously to notification-service and logged in `notification_logs` (dev stub — no real SMS).

## Next Implementation Steps

1. **Real Razorpay/PhonePe** and **MSG91/FCM** (deferred per your plan)
2. **Media service** for delivery proof photos (deferred)
3. **Kafka event bus** (replace direct HTTP between services)
4. **Agent offline sync** or **hub admin PIN**

## Pending (not yet built)

### Environment (required to run locally)

| Item | Status |
|---|---|
| Java 21 on PATH | Not detected on this machine |
| Maven 3.9+ on PATH | Not detected |
| Docker Desktop | Not detected |

Install the above, then run `.\scripts\start-dev.ps1` — Flyway migrations run automatically on first service start.

### Buyer journey — remaining gaps

| Feature | API / area | Status |
|---|---|---|
| FCM device registration | `POST /users/me/devices` | Not started |
| Guest browse via gateway | Public catalog through `:8080` | Partial (direct `:8084` works) |

### Vendor / catalog — remaining gaps

| Feature | Status |
|---|---|
| Vendor registration / approval flow | Not started |
| Bulk price CSV upload | Not started |
| Catalog search (OpenSearch) | Not started — SQL browse only |

### Hub / admin — remaining gaps

| Feature | Status |
|---|---|
| Agent offline sync | Not started |
| Hub admin PIN for sensitive actions | Not started |

### Platform services — stubs only

| Service | Port | Status |
|---|---|---|
| billing-service | 8090 | Shell only — fee rules, settlements |
| media-service | 8091 | Shell only — pickup/delivery proof uploads |
| reporting-service | 8092 | Shell only — SLA dashboards |

### Integrations (Phase 1 → 2)

| Item | Status |
|---|---|
| Real payment gateway (Razorpay/PhonePe) | Dev webhook bypass only |
| Real SMS (MSG91) | Logs to `notification_logs` only |
| Push notifications (FCM) | Not started |
| Kafka domain events | Config present, not wired |
| Redis (sessions/cache) | Infra only, not used by services |
| COD reconciliation | Not started |
| Settlements / vendor payouts | Not started |

### Apps

| Item | Status |
|---|---|
| Flutter buyer app | TODO (`apps/`) |
| React portals (Vite+TS, all apps) | Vendor `:5173` · Delivery `:5174` · Buyer `:5175` |

## Pilot Town

Narsaraopet, Andhra Pradesh (`NRPT/AP`)
