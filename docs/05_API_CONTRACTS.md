# HyperLocalMart — API Contracts

## Version

**2.0** (aligned with PRD v2.3, System Design v2.0, Database Schema v2.0)

---

# What Is an API Contract?

An **API contract** is the agreed specification between **clients** (Flutter apps, React web) and **backend services**. It defines:

| Element | Purpose |
|---|---|
| **URL path** | Where to call (`POST /api/v1/orders`) |
| **HTTP method** | What action (GET = read, POST = create, PUT/PATCH = update) |
| **Headers** | Auth token, idempotency key, correlation ID |
| **Request body** | Exact JSON fields the client sends |
| **Response body** | Exact JSON fields the server returns |
| **Status codes** | 200 success, 400 validation error, 401 unauthorized, etc. |
| **Roles** | Who may call the endpoint (`BUYER`, `HUB_ADMIN`, …) |
| **Validation rules** | Required fields, formats, min/max |

**Why it matters:** Frontend, backend, and QA build against the **same contract** — no guesswork. OpenAPI/Swagger is generated from this. Changes are versioned (`/api/v1` → `/api/v2` when breaking).

**Gateway:** All external traffic hits **API Gateway** (`/api/v1/**`) which routes to microservices.

---

# 1. Global Standards

## 1.1 Base URL

| Environment | Base URL |
|---|---|
| Production | `https://api.hyperlocalmart.in/api/v1` |
| Staging | `https://api-staging.hyperlocalmart.in/api/v1` |
| Local | `http://localhost:8080/api/v1` |

## 1.2 Headers

| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes* | `Bearer {accessToken}` — *except public routes |
| `Content-Type` | Yes (JSON bodies) | `application/json` |
| `X-Correlation-Id` | Optional | Client UUID; server echoes in response |
| `Idempotency-Key` | POST orders, payments | UUID v4 — prevents duplicate writes |
| `X-Town-Id` | Browse/cart in town context | Selected town UUID (buyer apps) |

## 1.3 Standard Success Envelope

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { },
  "timestamp": "2026-06-24T10:00:00Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## 1.4 Standard Error Envelope

```json
{
  "success": false,
  "message": "Validation failed",
  "errorCode": "VALIDATION_ERROR",
  "errors": [
    { "field": "phone", "message": "Invalid Indian mobile number" }
  ],
  "timestamp": "2026-06-24T10:00:00Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## 1.5 Common Error Codes

| errorCode | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Missing/invalid JWT |
| `FORBIDDEN` | 403 | Wrong role or town scope |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate idempotency / state conflict |
| `TOWN_DISABLED` | 403 | Town not accepting orders |
| `MIN_ORDER_NOT_MET` | 400 | Below town minimum order value |
| `RATE_LIMITED` | 429 | Too many requests |

## 1.6 Pagination

Query params: `page` (0-based), `size` (default 20, max 100)

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 0,
    "size": 20,
    "totalElements": 145,
    "totalPages": 8
  }
}
```

## 1.7 Roles

`BUYER` | `VENDOR` | `HUB_ADMIN` | `DELIVERY_AGENT` | `SUPER_ADMIN`

## 1.8 Public Routes (no JWT)

* `POST /auth/register`
* `POST /auth/login`
* `POST /auth/forgot-password`
* `POST /auth/reset-password`
* `GET /towns` (list enabled towns for selector)
* `GET /catalog/items` (guest browse)

---

# 2. Gateway Routing

| Path prefix | Service |
|---|---|
| `/api/v1/auth/**`, `/api/v1/users/**`, `/api/v1/addresses/**` | user-service |
| `/api/v1/towns/**` | town-service |
| `/api/v1/vendors/**` | vendor-service |
| `/api/v1/catalog/**` | catalog-service |
| `/api/v1/cart/**` | cart-service |
| `/api/v1/orders/**` | order-service |
| `/api/v1/payments/**` | payment-service |
| `/api/v1/delivery/**` | delivery-service |
| `/api/v1/billing/**` | billing-service |
| `/api/v1/media/**` | media-service |
| `/api/v1/notifications/**` | notification-service |
| `/api/v1/reports/**` | reporting-service |

---

# 3. Authentication & User APIs

## 3.1 Register Buyer

`POST /auth/register` — **Public**

**Request:**
```json
{
  "phone": "9876543210",
  "password": "Secure@12",
  "firstName": "Pavan",
  "lastName": "Kumar",
  "email": "pavan@example.com"
}
```

**Validation:** phone (+91, 10 digits), password (min 8, complexity), firstName required.

**Response `201`:**
```json
{
  "data": {
    "userId": "uuid",
    "role": "BUYER"
  }
}
```

---

## 3.2 Login

`POST /auth/login` — **Public**

**Request:**
```json
{
  "phone": "9876543210",
  "password": "Secure@12"
}
```

**Response `200`:**
```json
{
  "data": {
    "accessToken": "jwt",
    "refreshToken": "jwt",
    "expiresIn": 3600,
    "roles": ["BUYER"],
    "userId": "uuid"
  }
}
```

---

## 3.3 Refresh Token

`POST /auth/refresh` — **Public**

**Request:** `{ "refreshToken": "jwt" }`

**Response `200`:** new access + refresh tokens (rotation).

---

## 3.4 Logout

`POST /auth/logout` — **Authenticated**

**Request:** `{ "refreshToken": "jwt" }`

**Response `204`**

---

## 3.5 Forgot / Reset Password

`POST /auth/forgot-password` — **Public** — sends OTP to phone.

`POST /auth/reset-password` — **Public**

```json
{
  "phone": "9876543210",
  "otp": "123456",
  "newPassword": "Secure@12"
}
```

---

## 3.6 Get Profile

`GET /users/me` — **BUYER, VENDOR, HUB_ADMIN, DELIVERY_AGENT, SUPER_ADMIN**

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "phone": "9876543210",
    "firstName": "Pavan",
    "lastName": "Kumar",
    "email": "pavan@example.com",
    "roles": ["BUYER"],
    "defaultTownId": "uuid"
  }
}
```

---

## 3.7 Update Profile

`PATCH /users/me`

```json
{
  "firstName": "Pavan",
  "lastName": "Kumar",
  "defaultTownId": "uuid"
}
```

---

## 3.8 Register Device (FCM)

`POST /users/me/devices`

```json
{
  "fcmToken": "token",
  "platform": "ANDROID",
  "appType": "BUYER"
}
```

---

## 3.9 Addresses

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/addresses` | BUYER | List saved addresses |
| `POST` | `/addresses` | BUYER | Create address |
| `PUT` | `/addresses/{id}` | BUYER | Update |
| `DELETE` | `/addresses/{id}` | BUYER | Delete |
| `PATCH` | `/addresses/{id}/default` | BUYER | Set default |

**Create request:**
```json
{
  "townId": "uuid",
  "label": "Home",
  "recipientName": "Pavan Kumar",
  "recipientPhone": "9876543210",
  "line1": "MG Road",
  "line2": "Near temple",
  "landmark": "Opposite bus stand",
  "pincode": "522601",
  "isDefault": true
}
```

---

# 4. Town APIs

## 4.1 List Towns (buyer selector)

`GET /towns?status=ENABLED` — **Public**

**Response:**
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "displayName": "Narsaraopet (Andhra Pradesh)",
        "townCode": "NRPT",
        "stateCode": "AP",
        "status": "ENABLED",
        "acceptingOrders": true
      }
    ]
  }
}
```

`acceptingOrders`: false when town disabled (browse may still work).

---

## 4.2 Get Town

`GET /towns/{townId}` — **Authenticated**

---

## 4.3 Create Town

`POST /towns` — **SUPER_ADMIN**

```json
{
  "name": "Narsaraopet",
  "state": "Andhra Pradesh",
  "townCode": "NRPT",
  "stateCode": "AP",
  "pincodes": ["522601", "522603"],
  "coverageRadiusKm": 10
}
```

---

## 4.4 Enable / Disable Town

`PATCH /towns/{townId}/status` — **SUPER_ADMIN, HUB_ADMIN** (own town)

```json
{ "status": "DISABLED", "reason": "Festival maintenance" }
```

---

## 4.5 Town Config

`GET /towns/{townId}/config` — **HUB_ADMIN, SUPER_ADMIN**

`PUT /towns/{townId}/config` — **HUB_ADMIN** (allowed keys), **SUPER_ADMIN** (all)

```json
{
  "minOrderValue": 199,
  "readyForPickupAlertHours": 1,
  "refundWorkingDays": 5,
  "maxSmsPerOrder": 6,
  "quietHours": { "start": "22:00", "end": "08:00" }
}
```

---

## 4.6 Order Status Labels

`GET /towns/{townId}/status-labels` — **Public** (buyer app)

`PUT /towns/status-labels` — **SUPER_ADMIN**

```json
{
  "labels": [
    { "internalCode": "PLACED", "displayLabel": "Order Placed", "visibleToBuyer": true, "sortOrder": 1 }
  ]
}
```

---

## 4.7 Town History (audit)

`GET /towns/{townId}/history?page=0&size=20` — **HUB_ADMIN** (own town), **SUPER_ADMIN**

---

## 4.8 Super Admin On-Behalf

`POST /towns/{townId}/on-behalf/start` — **SUPER_ADMIN**

**Response:** short-lived on-behalf session token or context flag.

`POST /towns/on-behalf/end` — **SUPER_ADMIN**

---

# 5. Vendor APIs

## 5.1 Submit Vendor Registration Request

`POST /vendors/registration-requests` — **HUB_ADMIN, SUPER_ADMIN**

```json
{
  "townId": "uuid",
  "businessName": "Ravi Kirana",
  "ownerName": "Ravi",
  "phone": "9876501234",
  "shopName": "Ravi Kirana Store",
  "address": "Main Bazaar",
  "gstNumber": "37XXXXX",
  "bankAccount": "1234567890",
  "ifsc": "SBIN0001234",
  "shopImageMediaId": "uuid",
  "gstCertMediaId": "uuid"
}
```

**Validation:** name, phone, shopName, shopImage required; if `gstNumber` → bank + IFSC required.

---

## 5.2 Approve / Reject Registration

`POST /vendors/registration-requests/{id}/approve` — **SUPER_ADMIN**

`POST /vendors/registration-requests/{id}/reject` — **SUPER_ADMIN**

```json
{ "reason": "Incomplete documents" }
```

---

## 5.3 List Vendors (hub / super admin)

`GET /vendors?townId={uuid}&status=ACTIVE` — **HUB_ADMIN, SUPER_ADMIN**

---

## 5.4 Get My Vendor Profile

`GET /vendors/me` — **VENDOR**

---

## 5.5 Update Shop Status

`PATCH /vendors/me/status` — **VENDOR**

```json
{ "status": "INACTIVE", "reason": "Vacation till Monday" }
```

---

## 5.6 Disable Vendor

`PATCH /vendors/{vendorId}/disable` — **HUB_ADMIN** (PIN required), **SUPER_ADMIN**

```json
{ "reason": "Policy violation", "pin": "1234" }
```

---

## 5.7 Vendor Dashboard

`GET /vendors/me/dashboard?from=2026-06-01&to=2026-06-24` — **VENDOR**

**Response:**
```json
{
  "data": {
    "orderCountToday": 12,
    "orderCountWeek": 48,
    "earningsGross": 24500.00,
    "recentOrders": []
  }
}
```

---

# 6. Catalog APIs

## 6.1 Master Catalog (Super Admin)

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/catalog/categories` | Public / Auth | List categories |
| `POST` | `/catalog/categories` | SUPER_ADMIN | Create category |
| `PUT` | `/catalog/categories/{id}` | SUPER_ADMIN | Update |
| `GET` | `/catalog/master-items` | SUPER_ADMIN | List master items |
| `POST` | `/catalog/master-items` | SUPER_ADMIN | Create master item |
| `PUT` | `/catalog/master-items/{id}` | SUPER_ADMIN | Update |
| `GET` | `/catalog/units` | SUPER_ADMIN | List units |
| `POST` | `/catalog/units` | SUPER_ADMIN | Create unit |

**Create master item:**
```json
{
  "categoryId": "uuid",
  "name": "Tomato",
  "description": "Fresh tomato",
  "unitId": "uuid",
  "mrp": 40.00,
  "imageMediaId": "uuid"
}
```

---

## 6.2 Browse / Search (Buyer — guest allowed)

`GET /catalog/items?townId={uuid}&q=tomato&page=0&size=20` — **Public**

**Response:**
```json
{
  "data": {
    "items": [
      {
        "listingId": "uuid",
        "masterItemId": "uuid",
        "name": "Tomato",
        "unit": "KG",
        "shopName": "Ravi Kirana",
        "vendorId": "uuid",
        "price": 30.00,
        "discountPrice": 28.00,
        "imageUrl": "https://cdn.../signed"
      }
    ],
    "page": 0,
    "totalElements": 15
  }
}
```

---

## 6.3 Vendor Listings

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/catalog/vendors/me/listings` | VENDOR | My listings |
| `POST` | `/catalog/vendors/me/listings` | VENDOR | Add listing from master catalog |
| `PATCH` | `/catalog/vendors/me/listings/{id}` | VENDOR | Update price / active |
| `POST` | `/catalog/vendors/me/listings/bulk-price` | VENDOR | CSV bulk update (Phase 1) |

**Add listing:**
```json
{
  "masterItemId": "uuid",
  "price": 30.00,
  "discountPrice": 28.00,
  "vendorNote": "Local farm",
  "active": true
}
```

---

## 6.4 Catalog Requests (vendor → super admin)

`POST /catalog/requests` — **VENDOR**

```json
{
  "requestType": "NEW_ITEM",
  "proposedName": "Green Chilli",
  "categoryId": "uuid",
  "unitId": "uuid",
  "description": "Local variety",
  "notes": "Needed for town launch"
}
```

`POST /catalog/requests/{id}/approve` — **SUPER_ADMIN**

`POST /catalog/requests/{id}/reject` — **SUPER_ADMIN**

---

# 7. Cart APIs

## 7.1 Get Cart

`GET /cart?townId={uuid}` — **BUYER**

**Response:**
```json
{
  "data": {
    "cartId": "uuid",
    "townId": "uuid",
    "itemsSubtotal": 458.00,
    "itemCount": 3,
    "items": [
      {
        "itemId": "uuid",
        "listingId": "uuid",
        "name": "Tomato",
        "shopName": "Fresh Veg Mart",
        "quantity": 2,
        "unitPrice": 30.00,
        "lineTotal": 60.00
      }
    ],
    "minOrderValue": 199,
    "minOrderMet": true
  }
}
```

---

## 7.2 Add Item

`POST /cart/items` — **BUYER**

```json
{
  "townId": "uuid",
  "listingId": "uuid",
  "quantity": 2
}
```

---

## 7.3 Update / Remove Item

`PATCH /cart/items/{itemId}` — `{ "quantity": 3 }`

`DELETE /cart/items/{itemId}`

---

## 7.4 Change Town (clear cart)

`POST /cart/change-town` — **BUYER**

```json
{ "newTownId": "uuid", "confirmClear": true }
```

**Response:** empty cart or `409` if `confirmClear` false.

---

# 8. Order APIs

## 8.1 Create Order (Checkout)

`POST /orders` — **BUYER** — **Requires `Idempotency-Key`**

```json
{
  "townId": "uuid",
  "cartId": "uuid",
  "addressId": "uuid",
  "paymentMethod": "ONLINE",
  "paymentGateway": "RAZORPAY"
}
```

`paymentMethod`: `ONLINE` | `COD`

**Response `201`:**
```json
{
  "data": {
    "orderId": "uuid",
    "orderNumber": "NRPT/AP-250626-O0001",
    "status": "PAYMENT_PENDING",
    "totalAmount": 538.00,
    "payment": {
      "paymentId": "uuid",
      "status": "PENDING",
      "upiIntent": "upi://pay?...",
      "qrPayload": "..."
    }
  }
}
```

**COD:** `status`: `PLACED` immediately; no gateway payload.

---

## 8.2 Retry Payment

`POST /orders/{orderId}/payments/retry` — **BUYER** — **Idempotency-Key**

Cart **not** cleared on failure; order stays `PAYMENT_FAILED` until retry succeeds.

---

## 8.3 Get Order (buyer — single view)

`GET /orders/{orderId}` — **BUYER** (own), **HUB_ADMIN**, **SUPER_ADMIN**

**Response:**
```json
{
  "data": {
    "orderId": "uuid",
    "orderNumber": "NRPT/AP-250626-O0001",
    "status": "PLACED",
    "displayStatus": "Order Placed",
    "timeline": [
      { "code": "PLACED", "label": "Order Placed", "at": "2026-06-26T10:00:00Z" }
    ],
    "itemsSubtotal": 498.00,
    "deliveryFee": 40.00,
    "totalAmount": 538.00,
    "paymentMethod": "ONLINE",
    "paymentStatus": "PAID",
    "deliveryAddress": { },
    "items": [
      {
        "name": "Tomato",
        "shopName": "Fresh Veg Mart",
        "quantity": 2,
        "lineTotal": 60.00
      }
    ],
    "invoicePdfUrl": "/orders/{id}/invoice.pdf"
  }
}
```

*Buyer does not see sub-order IDs.*

---

## 8.4 List My Orders

`GET /orders?townId={uuid}&page=0` — **BUYER**

---

## 8.5 Reorder

`POST /orders/{orderId}/reorder` — **BUYER**

**Response:** new cart with items; `priceChanged: true` if any listing price differs.

---

## 8.6 Download Invoice

`GET /orders/{orderId}/invoice` — **BUYER** — returns PDF.

---

## 8.7 Vendor Sub-Orders

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/orders/vendor/sub-orders` | VENDOR | My sub-orders |
| `GET` | `/orders/vendor/sub-orders/{id}` | VENDOR | Detail |
| `POST` | `/orders/vendor/sub-orders/{id}/ready` | VENDOR | Mark ready for pickup |
| `POST` | `/orders/vendor/sub-orders/{id}/reject` | VENDOR | Reject (cancels master) |

**Reject:**
```json
{ "reason": "Out of stock today" }
```

---

## 8.8 Hub / Super Admin Order Views

`GET /orders/admin?townId={uuid}&status=&page=0` — **HUB_ADMIN, SUPER_ADMIN**

`GET /orders/admin/{orderId}` — includes `subOrders[]`, assignments, timestamps.

---

## 8.9 Super Admin Override

`POST /orders/admin/{orderId}/override-status` — **SUPER_ADMIN** (audited)

`POST /orders/admin/{orderId}/force-cancel` — **SUPER_ADMIN** (audited)

---

# 9. Payment APIs

## 9.1 Get Payment

`GET /payments/{paymentId}` — **BUYER** (own order), **HUB_ADMIN**, **SUPER_ADMIN**

---

## 9.2 Payment Webhooks (internal)

`POST /payments/webhooks/razorpay` — **Gateway** (signature verified)

`POST /payments/webhooks/phonepe` — **Gateway**

*Not called by mobile apps.*

---

## 9.3 COD Daily Reconciliation

`POST /payments/cod/close-day` — **HUB_ADMIN** (PIN required)

```json
{
  "agentId": "uuid",
  "receivedAmount": 4200.00,
  "orderIds": ["uuid1", "uuid2"],
  "pin": "1234"
}
```

`GET /payments/cod/summary?townId={uuid}&date=2026-06-26` — **HUB_ADMIN, SUPER_ADMIN**

---

## 9.4 Settlements

`GET /payments/settlements?townId={uuid}&payeeType=VENDOR` — **VENDOR** (own), **SUPER_ADMIN**

`GET /payments/settlements/{id}/statement.pdf` — PDF download

`GET /payments/settlements/{id}/statement.xlsx` — Excel download

---

# 10. Delivery APIs

## 10.1 Hub

`GET /delivery/hubs/me` — **HUB_ADMIN**

`GET /delivery/hubs/{hubId}/dashboard` — **HUB_ADMIN** — real-time counts.

---

## 10.2 Agents

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/delivery/agents` | HUB_ADMIN | Create agent |
| `PATCH` | `/delivery/agents/{id}/status` | HUB_ADMIN, SUPER_ADMIN | Active/inactive |
| `GET` | `/delivery/agents?hubId={uuid}` | HUB_ADMIN | List agents |
| `DELETE` | `/delivery/agents/{id}` | SUPER_ADMIN | Soft delete / disable permanent |

---

## 10.3 Assignments

**Assign pickup (per sub-order):**

`POST /delivery/assignments/pickup` — **HUB_ADMIN**

```json
{
  "vendorSubOrderId": "uuid",
  "agentId": "uuid"
}
```

**Assign last-mile (per master order):**

`POST /delivery/assignments/last-mile` — **HUB_ADMIN**

```json
{
  "orderId": "uuid",
  "agentId": "uuid"
}
```

**Reassign:**

`PATCH /delivery/assignments/{id}/reassign` — **HUB_ADMIN**

```json
{ "newAgentId": "uuid", "reason": "Agent inactive" }
```

---

## 10.4 Agent Mobile APIs

`GET /delivery/agents/me/assignments?status=ASSIGNED` — **DELIVERY_AGENT**

**Mark picked from vendor:**

`POST /delivery/assignments/{id}/picked-from-vendor`

```json
{
  "mediaIds": ["uuid1", "uuid2"],
  "note": "Verified qty"
}
```

**Hub admin — brought to hub:**

`POST /delivery/sub-orders/{vendorSubOrderId}/at-hub` — **HUB_ADMIN**

**Mark picked from hub:**

`POST /delivery/assignments/{id}/picked-from-hub` — **DELIVERY_AGENT**

**Deliver:**

`POST /delivery/assignments/{id}/deliver` — **DELIVERY_AGENT**

```json
{
  "otp": "482910",
  "deliveryPhotoMediaId": "uuid",
  "recipientName": "Pavan"
}
```

**Buyer refused (COD):**

`POST /delivery/assignments/{id}/buyer-rejected` — **DELIVERY_AGENT**

```json
{ "reason": "Customer not available" }
```

**OTP override:**

`POST /delivery/orders/{orderId}/otp-override` — **HUB_ADMIN** (PIN + audit)

---

## 10.5 Offline Sync (agent)

`POST /delivery/agents/me/sync` — **DELIVERY_AGENT**

```json
{
  "events": [
    {
      "clientEventId": "uuid",
      "assignmentId": "uuid",
      "eventType": "PICKED_FROM_VENDOR",
      "occurredAt": "2026-06-26T11:00:00Z",
      "payload": { }
    }
  ]
}
```

**Response:** accepted/rejected per event (idempotent on `clientEventId`).

---

# 11. Media APIs

## 11.1 Upload

`POST /media/upload` — **multipart/form-data** — **VENDOR, DELIVERY_AGENT, HUB_ADMIN, SUPER_ADMIN**

| Field | Type |
|---|---|
| `file` | binary (max 5 MB) |
| `context` | `PICKUP_PROOF`, `DELIVERY_PROOF`, `SHOP`, `GST_CERT` |
| `orderId` | uuid (optional) |
| `vendorSubOrderId` | uuid (optional) |

**Response `201`:**
```json
{
  "data": {
    "mediaId": "uuid",
    "scanStatus": "PENDING"
  }
}
```

---

## 11.2 Get Signed URL

`GET /media/{mediaId}/url` — **HUB_ADMIN, SUPER_ADMIN** (audit logged)

**Response:**
```json
{
  "data": {
    "url": "https://s3.../signed",
    "expiresAt": "2026-06-26T12:30:00Z"
  }
}
```

---

# 12. Billing APIs (Super Admin)

`GET /billing/towns/{townId}/fee-rules` — **SUPER_ADMIN**

`POST /billing/towns/{townId}/fee-rules` — **SUPER_ADMIN** — creates new version.

```json
{
  "vendorFee": {
    "feeType": "COMMISSION_PCT",
    "commissionPct": 5.0,
    "commissionBase": "AFTER_DISCOUNT",
    "rejectOrderCommission": false
  },
  "hubFee": { "feeType": "PER_ORDER", "perOrderAmount": 10.00 },
  "deliverySlabs": [
    { "minOrderValue": 0, "maxOrderValue": 499, "deliveryFee": 40.00 },
    { "minOrderValue": 500, "maxOrderValue": 999, "deliveryFee": 25.00 },
    { "minOrderValue": 1000, "maxOrderValue": null, "deliveryFee": 0 }
  ],
  "effectiveFrom": "2026-07-01T00:00:00Z"
}
```

`POST /billing/checkout/preview` — **BUYER** (internal/cart) — returns fee breakdown before order.

---

# 13. Reporting APIs

`GET /reports/dashboard?townId={uuid}` — **HUB_ADMIN, SUPER_ADMIN**

**Response:** real-time orders today, GMV, pending pickups, overdue ready alerts.

`GET /reports/sla?townId={uuid}&from=&to=` — SLA metrics.

`GET /reports/exports/orders?townId={uuid}&from=&to=` — **HUB_ADMIN, SUPER_ADMIN** — CSV/Excel async export.

---

# 14. Notification Admin APIs

`GET /notifications/templates` — **SUPER_ADMIN**

`PUT /notifications/templates/{eventCode}` — **SUPER_ADMIN**

`GET /notifications/channels` — **SUPER_ADMIN**

`PATCH /notifications/channels` — enable/disable SMS, push, WhatsApp.

---

# 15. Platform Settings

`GET /platform/settings` — **SUPER_ADMIN**

`PATCH /platform/settings` — maps toggle, feature flags, maintenance window.

---

# 16. HTTP Status Codes

| Code | Usage |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No content (delete/logout) |
| 400 | Validation / business rule |
| 401 | Unauthorized |
| 403 | Forbidden / town disabled |
| 404 | Not found |
| 409 | Conflict / idempotency replay |
| 429 | Rate limited |
| 500 | Server error |

---

# 17. Webhook & Internal APIs

| Endpoint | Caller |
|---|---|
| `POST /payments/webhooks/*` | Payment gateways |
| `POST /internal/catalog/reindex` | Admin job (reindex OpenSearch) |

Internal service-to-service calls use mTLS or internal network in production; not exposed via public gateway.

---

# 18. OpenAPI

* Each service exposes `/v3/api-docs` (Springdoc OpenAPI).
* Gateway aggregates to `/api/v1/swagger-ui.html`.
* Every endpoint documents: summary, roles, request/response examples, error codes.

---

# 19. Implementation Checklist

1. Global `@ControllerAdvice` error handler → standard envelope
2. `CorrelationIdFilter` at gateway and services
3. `IdempotencyFilter` on order + payment controllers
4. `@PreAuthorize` role + town scope on hub/vendor endpoints
5. Integration tests per critical flow (register → browse → cart → order → pay)
6. Postman collection generated from OpenAPI

---

# Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | — | Basic CRUD APIs |
| 2.0 | 2026-06-24 | Full PRD alignment: town, hub, agents, assignments, catalog listings, COD reconcile, media, billing, reporting, idempotency, guest browse |

All APIs follow REST best practices and are production-ready per HyperLocalMart PRD v2.3.
