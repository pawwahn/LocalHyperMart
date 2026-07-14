# HyperLocalMart — Product Requirements Document (PRD)

## Version

**2.3** (Batch 3 complete: architecture, ops, legal, integrations, security SEC42+)

## Product Name

HyperLocalMart (LocalHyperMart)

## Document Status

| Section | Status |
|---|---|
| Town model, roles, order flow, catalog, assignments (M–S) | **Confirmed** |
| Architecture, ops, legal, integrations, security | **Confirmed** |
| System design & API docs sync | **Complete** |
| API contracts | `05_API_CONTRACTS.md` (**v2.0**) |

---

# Vision

Build a **town-based hyperlocal marketplace** for Tier-2 and Tier-3 Indian towns where buyers purchase from **multiple local vendors in a single order**, while the platform orchestrates **vendor sub-orders**, **delivery hub consolidation**, and **last-mile delivery**.

**We do not operate dark stores.** Inventory lives at vendor shops. The platform connects **buyers**, **vendors**, **town delivery hubs**, and **delivery agents**.

### Example

A buyer in Narsaraopet orders:

* Rice from Grocery Store A
* Tomatoes from Vegetable Store B
* Shampoo from Fancy Store C

The buyer sees **one order**. Internally the system creates a **master order** and **vendor sub-orders**. A delivery agent collects from vendors, brings goods to the town delivery hub, and another (or the same) agent delivers to the buyer.

### Positioning

This is **not** quick commerce (Instamart / Blinkit style). Delivery timing is managed by the **town delivery hub admin** (**2 / 6 / 12 / 24 hours** — not fixed quick commerce). Platform records timestamps for reporting: **order placed**, **received from vendors**, **brought to hub**, **delivered to buyer**.

### Scale Target

* **500+ orders per day per town** at steady state
* **300 towns** at maturity (~150,000 orders/day); rollout **24 towns in first 12 months**
* Peak load: **5×** normal on festivals; ~**200 concurrent users per town** at peak
* Platform uptime target: **99.9%**
* API capacity target: **10,000 requests/minute** (gateway + caching)
* Pilot town: **Narsaraopet, Andhra Pradesh** (may change)

---

# Business Model

Revenue and fees are **configurable per town** by super admin (and partially by town delivery hub admin where noted). Models are not fixed globally.

## Customers (Buyers)

* Mobile application — **Flutter** (Android Phase 1; iOS Phase 2; single codebase, performant UI/filtering)
* Login required to place orders; **guest browse** allowed
* Pay via **UPI / GPay / PhonePe / QR** (Razorpay + PhonePe gateways) and **COD**
* **Buyer wallet** — **Phase 2** (design APIs/data model in Phase 1 for easy add-on)

## Vendors

Platform collects from vendors using **town-configurable** models:

* Monthly subscription
* Percentage commission per order
* Hybrid (subscription + commission)
* Other models as configured per town

*Pending Batch 2*: commission base (item total vs delivery-inclusive), example rates for pilot town.

## Town Delivery Hub Partners

Platform collects from delivery hubs using **town-configurable** models:

* Monthly subscription
* Per-order fee
* Percentage commission
* Other models as configured per town

## Buyers (Delivery / Platform Fees)

**Town-configurable** delivery or platform fees:

* Flat fee per order
* Slab-wise rates based on order value (and potentially other dimensions later)

*Pending Batch 2*: example slabs for Narsaraopet.

## Settlements

* Vendor payouts: **weekly** (PDF + Excel statement); platform fee shown **on payout statement only**
* Hub partner payouts: **weekly**
* COD: delivery agent → town hub admin → **daily reconciliation** (see example below)
* Online payments: at order placement via **Razorpay** and **PhonePe**
* Fee rule changes: apply to **new orders only**; **clearly flagged in reports**
* Refund timeline: default **5 working days** (configurable per town)

### COD daily reconciliation (T6 example)

End of day — Hub admin **Ravi** in Narsaraopet:

1. Agent **Suresh** delivered 8 COD orders; collected ₹4,200 total.
2. Suresh hands cash to Ravi at hub.
3. Ravi opens **COD Close Day** in app: selects Suresh → enters ₹4,200 received → system matches 8 orders.
4. Status: orders marked **COD reconciled**; discrepancy flagged if amounts differ.
5. Super admin sees **town COD summary** in reports.

### Buyer delivery fee slabs (T3 example)

Configurable per town — example for Narsaraopet:

| Order value | Delivery fee |
|---|---|
| ₹0 – ₹499 | ₹40 |
| ₹500 – ₹999 | ₹25 |
| ₹1,000+ | Free |

### Per-town config knobs (T1)

Super admin / hub admin configure per town:

* Town enable/disable
* Min order value
* Ready-for-pickup alert hours (default 1h)
* Delivery timing options (2 / 6 / 12 / 24h)
* Vendor fee: subscription / % commission / hybrid (amounts hidden from hub admin)
* Hub partner fee model
* Buyer delivery fee slabs
* Quiet hours for SMS/notifications
* Max SMS per order (cost control)
* Upload limits per order stage
* Maintenance window
* Refund working-days SLA

### Commission (T2)

Engine must support **all scenarios** configurable per town:

* % on item subtotal before/after discount
* % including/excluding delivery fee
* Flat per order
* Hybrid subscription + %
* Commission on vendor-rejected orders: **yes, but configurable** (default: no commission if order cancelled before delivery)

### Vendor reject refund (CF4 example)

Order `NRPT/AP-250626-O0001` — ₹850 paid online. Vendor B rejects (out of stock).

1. System **cancels master order** (all vendors).
2. Payment service initiates **full ₹850 refund** to buyer UPI/bank.
3. Buyer app: *"Order cancelled — refund in 5 working days"* (days configurable).
4. Vendor B records reject reason; hub admin + super admin notified.
5. Vendor A (who was ready) sees order cancelled — no partial delivery.

**COD case:** same cancel flow; no refund; buyer history shows reason.

### GST / invoice (T4, T15)

* Bill/invoice in app + **PDF download** (retail-style print)
* **GST line breakdown** on invoice where applicable
* Platform GST on fees — issued via **app/PDF** per tax rules (*legal review Batch 4*)

---

# Geography & Town Model

## Town Definition

* A town is identified by **town name + state** (multiple states may share the same town name).
* UI display format: **Town name (State)** — e.g. `Narsaraopet (Andhra Pradesh)` or short code `NRPT/AP`.
* Each town is an operational boundary for catalog visibility, vendors, delivery hub, fees, and delivery timing.
* On town creation: **pincode(s)** are recorded for reference, but coverage is the **whole town (~10 km radius)**, not strict pincode-by-pincode delivery zones (Tier-2/3 town model).

## Town Enable / Disable

* **Super admin** and **town delivery hub admin** can enable or disable a town.
* When disabled: **block new orders only**; in-flight orders continue.
* Existing vendors can still log in unless the vendor account is individually disabled.
* **Browse when disabled**: buyers may view catalog; **checkout blocked** with message.

## Buyer Town Selection

* Buyer town is **saved in profile** but can be **changed** (e.g. ordering for someone in another town).
* Buyer selects a town to browse and order; selector shows **town name (state)**.
* **Delivery address must match the selected town** — cannot deliver to profile town if a different town is selected for the order.
* Changing town while cart has items: **show warning; cart is emptied**.
* **Guest browse** allowed; **login required to place order**.

## Delivery Hub per Town

* **Always exactly one delivery hub per town** (no second hub in same town).
* If the same operator runs a hub in another town, they register a **separate hub** (distinct name + town).

## Town Go-Live Minimums

* Minimum **1 vendor**
* Master catalog: **~1000 items** target for town launch
* Delivery agents: **~10** default, or as decided by town delivery hub admin

---

# Roles & Permissions

## Role Summary

| Role | Scope |
|---|---|
| **Super Admin** | Platform-wide configuration, master catalog, all towns, audit |
| **Town Delivery Hub Admin** | One admin per town hub; town operations, agents, vendors, disputes |
| **Delivery Agent** | Pickup from vendors, hub handoff, last-mile delivery |
| **Vendor** | Shop and listings in one town |
| **Buyer** | Browse, cart, order, track |

## Super Admin

Can:

* Manage towns (create, enable, disable)
* Manage master catalog (**categories and items — super admin only**)
* Approve **vendor registrations** (final approval; town admin may only submit requests)
* Approve **new catalog item/category requests** (vendor-initiated)
* Configure **buyer-visible order status labels** (display names; internal status codes remain stable)
* Enable or disable notification channels (SMS, push, WhatsApp)
* Manage town-configurable billing rules
* Log in and **act on behalf of** town delivery hub admin, or edit data directly
* Delete delivery agents (town hub admin cannot delete)
* View all town history logs

All super admin actions (including on-behalf actions) are **logged in town history**.

## Town Delivery Hub Admin

Can:

* Enable or disable the town (along with super admin)
* Submit **vendor registration requests** (cannot final-approve — super admin approves only)
* Create and **disable** delivery agents (cannot delete; contact super admin for deletion)
* Assign delivery agents for **vendor pickup** and **last-mile delivery** (no self-claim by agents)
* Mark sub-orders as **Brought to Delivery Hub** upon receipt at hub
* Set / manage **delivery timing** (2 / 6 / 12 / 24 hours) per operational policy
* Manage town-level settings where permitted (e.g. minimum order value)
* Handle disputes for the town
* Override delivery OTP in exceptions (logged in audit)

Cannot:

* Delete delivery agents
* Modify buyer-visible status label configuration
* Enable/disable notification channels

All create/update/disable actions by town delivery hub admin are **logged in town history**.

## Delivery Agent

Can:

* Execute **assigned** vendor pickups only (no self-claim)
* At vendor: verify order/sub-order, upload photos (1–3), mark status **Order verified and picked** (display label configurable)
* Transport goods to delivery hub
* Execute **assigned** last-mile deliveries
* Mark **Picked from delivery hub**, then **Delivered** with **OTP required** and **optional delivery photo**
* Work for **multiple delivery hubs** (across towns via separate hub registrations)

Constraints:

* Orders assigned only when agent status is **active**
* Active/inactive controlled by town delivery hub admin and super admin
* Disabled agents cannot be assigned pickup or delivery

## Vendor

Can:

* Register with **name, phone, shop image (mandatory)**; GST, bank account, IFSC, and other fields **optional**
* If **GST provided**: **bank account number and IFSC become mandatory**
* Select items from **master catalog only**
* Set **price** and **discount price** when changed (town-specific via vendor registration)
* **Inactivate** a listing — item hidden from buyer catalog (availability model: **if visible, it is available** — no stock counters)
* Add optional **vendor-specific short description** on listing
* Toggle shop **active/inactive** for leave or vacation
* After order placed: **Reject** sub-order **or** mark **Ready for pickup** (all items — no partial qty)
* View operational dashboard (see § Vendor Dashboard)

Cannot:

* Create master catalog items directly (request super admin)
* See platform fee / commission terms (super admin approves registration)
* Log in when vendor account is disabled

Constraints:

* **One town per vendor registration**; additional shops = separate registration (same owner allowed — each registration is separate revenue)
* Registration **request** raised by town hub admin or super admin; **approval by super admin only**
* If **Ready for pickup** not marked within **configurable hours per town** (default 1h): alert hub admin and super admin
* When vendor goes **inactive**: listings hidden; **in-flight orders** continue under hub admin tracking

## Buyer

Can:

* Register / login with **mobile + password**; forgot password via reset flow or OTP
* **Guest browse** catalog; **login required to order**
* Select town showing **name (state)**
* Search products **by item name** (buyer does not browse a vendor directory)
* See **shop/vendor name on product card**
* Add to cart across multiple vendors in same town
* Place order with **one delivery address**; multiple saved addresses allowed
* **Reorder** from history with **price-change alert** before confirming
* Track order (single order view); bill **in-app + PDF download** (retail-style small print)
* Receive alerts on key order events

Cannot:

* Cancel orders (no cancellation in current scope)
* Order across towns in one cart

## Admin (Legacy term)

Maps to **Super Admin** and **Town Delivery Hub Admin** as defined above.

---

# Master Catalog Model

## Ownership

* **Super admin only** creates **categories** and **master catalog items**.
* Town delivery hub admin **does not** approve catalog requests.

## Master Item Fields

* Category
* Name
* Image (super admin only)
* Unit — from **configuration table** (enum values managed by super admin)
* MRP (reference)
* Default description

## Vendor Listings

Vendor selects from master catalog and maintains a **town-specific listing**:

* Price and discount price (updated when vendor changes)
* Active / inactive flag — **inactive = hidden**; **no stock quantity fields** (if shown to buyer, treat as available)
* Optional vendor-specific short description

Multiple vendors in the same town may sell the **same master item** at different prices.

## New Category / Item Requests

1. Vendor submits request (proposed fields: category, item name, unit, description, reason/notes, optional reference photo).
2. **Super admin only** approves or rejects.
3. Bulk price update by vendor: *TBD / Batch 3* (CSV example if needed at scale).

---

# Order Model

## Structure (example)

Buyer places one cart checkout → system creates:

```
Master Order  NRPT/AP-250626-O0001     (buyer sees this only)
├── Sub-Order A  → Vendor: Ravi Kirana     → Rice 5kg, Dal 1kg
├── Sub-Order B  → Vendor: Fresh Veg Mart    → Tomato 1kg, Onion 1kg
└── Sub-Order C  → Vendor: Fancy Stores      → Shampoo 1pc
```

* Buyer sees **one order ID**, **one bill**, **one delivery address**, **one timeline**.
* Hub admin and super admin see sub-orders, assignments, and timestamps.

## Order ID Format

Per town, per day sequence:

`{TOWN_CODE}/{STATE_CODE}-{DDMMYY}-O{SEQ}`

Examples: `NRPT/AP-250626-O0001`, `NRPT/AP-250626-O0002`

## Minimum Order Value

* **Configurable per town** by super admin and town delivery hub admin.

## Auto-Confirmation

* Orders are **automatically confirmed** on successful payment (no separate vendor “accept” step).
* Vendor actions per sub-order: **Reject** or **Ready for pickup** only.

## Partial Delivery & Cancellation

* **No partial delivery** — wait for all sub-orders at hub before last-mile.
* **No user-initiated cancellation** in current scope.
* Vendor **reject** after payment triggers **whole master order cancellation** and refund flow (see § Refunds).
* If vendor never marks ready within configurable hours → **alert** hub admin and super admin (order remains active).

## Payment Failure

* Gateway-confirmed failure → order status **PAYMENT_FAILED**; buyer may **retry payment**; **cart is not cleared**.

## COD Refusal

* Buyer refuses at delivery → status **BUYER_REJECTED**; recorded in **buyer order history**.

---

# Order Flow

## End-to-End Flow

```
1. Buyer places order (login required; guest may browse only)
   → Payment initiated (online and/or COD on bill)
   → On payment success: order auto-confirmed; hub admin notified

2. Each vendor sub-order: vendor marks Ready for pickup OR Rejects
   → If any reject: cancel master order + refund workflow

3. Hub admin assigns delivery agent for PICKUP (per sub-order)
   → Agent visits vendor, photos (1–3, max 5 MB each), marks Verified & Picked

4. Agent brings goods to hub

5. Hub admin marks each sub-order: Brought to Delivery Hub
   → When ALL sub-orders at hub: master order → Ready for Delivery

6. Hub admin assigns ONE agent for last-mile (master order)

7. Agent marks: Picked from delivery hub (status only, no photo)

8. Agent delivers: OTP required (hub admin may override, logged)
   → Optional delivery photo → Delivered
```

## Delivery Timing

* **2 / 6 / 12 / 24 hours** — town hub admin manages scheduling (not instant/quick commerce).
* Missed internal SLA → **alert town delivery hub admin**.

## Reporting Timestamps (required)

| Milestone | Recorded time |
|---|---|
| Order placed | Yes |
| Received from vendors (verified & picked) | Yes, per sub-order |
| Brought to delivery hub | Yes, per sub-order |
| Delivered to buyer | Yes |

## Hub Verification Policy

* Hub admin **does not approve/reject** quality — confirms **physical receipt** per sub-order.
* Pickup verification photos taken by **delivery agent** at vendor (Android/iOS agent app).

## Agent Assignment Rules

| Leg | Assigned By | Self-Claim |
|---|---|---|
| Vendor pickup | Town delivery hub admin | **No** |
| Hub → buyer delivery | Town delivery hub admin | **No** |

Same delivery agent may handle pickup and last-mile, or different agents. System maps **agent ↔ leg ↔ order/sub-order**. Last-mile: **one agent per master order**.

---

# Order Status Model

## Internal Status Codes vs Display Labels

| Internal Code | Default Buyer Label | Notes |
|---|---|---|
| `PLACED` | Order Placed | Payment success |
| `PAYMENT_FAILED` | Payment Failed | Retry allowed |
| `READY_FOR_PICKUP` | Being Prepared | Vendor marked ready |
| `VERIFIED_PICKED_FROM_VENDOR` | Picked from Shop | Per sub-order |
| `BROUGHT_TO_DELIVERY_HUB` | At Delivery Hub | Per sub-order |
| `READY_FOR_DELIVERY` | Ready for Delivery | All sub-orders at hub |
| `PICKED_FROM_DELIVERY_HUB` | Out for Delivery | *Optional buyer label* — see example below |
| `DELIVERED` | Delivered | OTP confirmed |
| `VENDOR_REJECTED` | Cancelled | Whole order cancelled |
| `BUYER_REJECTED` | Delivery Refused | COD refusal |
| `CANCELLED` | Cancelled | System/admin future use |

Labels configurable by **super admin only**.

### Buyer timeline example (Q8)

Simple (recommended MVP):

`Placed → Being Prepared → At Hub → Out for Delivery → Delivered`

Map internally: skip showing “Picked from Shop” to buyer if desired; hub/admin views show full detail.

---

# Vendor Dashboard (MVP)

Vendors should see:

* **Today / week order count**
* **Order list** with master order ref, sub-order amount, line items
* **Payment status** per order (paid online / COD pending / failed / refunded)
* **Sub-order status** (ready for pickup, picked, at hub, delivered, rejected)
* **Earnings summary** (gross, platform fee if shown post-settlement — *fee visibility Batch 3*)
* **Listing management** (active/inactive, price, discount)
* **Alerts**: new order, rejection reminder, hub picked up

---

# Photo & OTP Requirements

| Stage | Actor | Photos | OTP |
|---|---|---|---|
| Vendor pickup | Delivery agent | **1–3**, max **5 MB** each; malware scan | — |
| Hub receipt | Town hub admin | — | — |
| Pickup from hub | Delivery agent | **Status only** | — |
| Delivery to buyer | Delivery agent | **Optional** | **Required** (hub admin override logged) |

* Photo retention: **90 days**
* Photos viewable by hub admin and super admin; **hub admin cannot delete photos**
* Storage: **AWS S3 (ap-south-1)** recommended; private bucket + **signed URLs** (see below)
* Upload from **Android or iOS** agent apps

---

# Payments

## Modes

* **Online** (UPI/card/etc.) and **COD** — both supported.

## Timing

* Payment amount recorded **at order placement**.
* COD amount appears on the bill even when paid on delivery.

## COD Flow

1. Delivery agent collects cash from buyer.
2. Agent hands cash to town delivery hub admin.
3. Hub admin reconciles (*Pending Batch 2*: daily reconciliation workflow).

## Refunds (vendor reject — confirmed CF4)

When vendor **rejects** after payment:

1. **Cancel entire master order**.
2. **Online**: full refund via gateway; buyer notified — refund in **X working days** (configurable).
3. **COD**: order closed; **reject reason** stored on order and buyer history.
4. Notify hub admin, super admin, buyer (**U8**).
5. Commission on cancelled order: **default no commission** if rejected before delivery (**configurable** per town).

## Disputes

* Handled by **town delivery hub admin** with **buyer confirmation**
* Outcomes: refund / redelivery / credit — hub admin decides after speaking with buyer
* Online reversal and COD adjustment paths both supported
* Super admin may **override status** or **force-cancel** — **audit logged**
### Dispute types (W1 example — MVP)

| Type | Example |
|---|---|
| **Wrong item** | Ordered 5kg rice, received 1kg |
| **Missing item** | Shampoo not in bag |
| **Damaged** | Cracked oil tin |
| **Late delivery** | Promised same-day, delivered next day |
| **Quality** | Vegetables not fresh |

Hub admin contacts buyer → agrees outcome → records in system.

---

# Town-Configurable Settings

Per-town configuration (managed by super admin; some fields also by town delivery hub admin):

| Setting | Hub Admin | Super Admin |
|---|---|---|
| Town enable/disable | Yes | Yes |
| Minimum order value | Yes | Yes |
| Delivery SLA (6/12/24h) | *Pending Batch 2* | Yes |
| Vendor fee model | *Pending Batch 2* | Yes |
| Hub partner fee model | *Pending Batch 2* | Yes |
| Buyer delivery fee slabs | *Pending Batch 2* | Yes |
| Vendor payout frequency | — | Yes (default weekly) |
| Buyer status display labels | No | Yes |
| Notification channel toggles | No | Yes |
| Hub admin can edit master catalog | No | Yes (enable/disable) |

---

# Notifications

## Channels

| Channel | Phase |
|---|---|
| **SMS** | Phase 1 |
| **Push (Firebase FCM)** | Phase 1 |
| **WhatsApp** | Phase 2 |
| **Email** | Optional / later |

Super admin enables/disables channels platform-wide. **Firebase FCM** recommended for push (free tier, Android + future iOS, integrates with Flutter).

## Events (U1 example list)

| Event | Buyer | Hub admin | Vendor | Agent |
|---|---|---|---|---|
| Order placed | ✓ | SMS + in-app | ✓ | — |
| Payment failed | ✓ | ✓ | — | — |
| Ready for pickup overdue | — | ✓ | reminder | — |
| Vendor rejected (order cancelled) | ✓ + refund msg | ✓ | — | — |
| Pickup assigned | — | — | — | ✓ |
| Verified picked from vendor | — | in-app | ✓ | — |
| Brought to hub | — | in-app | ✓ | — |
| Ready for delivery | ✓ | in-app | — | — |
| Delivery assigned | ✓ | in-app | — | ✓ |
| Out for delivery | ✓ | — | — | — |
| Delivered | ✓ | in-app | ✓ | — |
| Buyer rejected (COD) | history | ✓ | — | ✓ |

Templates **editable by super admin**. **Quiet hours** configurable per town (hub admin + super admin).

## SMS cost control (U6 example)

Max **6 SMS per order** to buyer (placed, out for delivery, delivered, refund, etc.) — configurable per town.

---

# Audit & Town History

Immutable **append-only** logs; retention **3 years**.

Hub admin: **own town only**. Super admin: **all towns**.

Vendor notified when disabled — includes **who disabled** (hub admin vs super admin).

### Audit events (V1 — recommended list)

* Town / vendor / agent create, update, disable
* Catalog and fee config changes
* Super admin on-behalf sessions and direct edits
* Order status overrides and force-cancel
* OTP overrides at delivery
* COD daily reconciliation entries
* Refund initiated / completed
* Buyer / vendor block actions
* Login failures and account lockouts
* Photo viewed (dispute investigations)
* Payout and settlement exports

---

# Applications & Platforms

| Surface | Phase 1 | Technology |
|---|---|---|
| Buyer — Android | **Yes** | Flutter |
| Buyer — iOS | Phase 2 | Flutter |
| Vendor — Web | **Yes** | React |
| Vendor — Mobile App | **Yes** | Flutter |
| Town hub admin — Web | **Yes** | React |
| Town hub admin — Android | **Yes** | Flutter |
| Delivery agent — Android | **Yes** | Flutter |
| Super admin — Web | **Yes** | React |

**App strategy (X9):** separate apps — **Buyer**, **Vendor**, **Delivery** (agent + hub mobile features). Super admin web only. Avoids role confusion and simplifies store listings and permissions.

**Narsaraopet go-live:** soft launch first; all Phase 1 surfaces mandatory; buyer support **phone** (town admin); legal policies from **super admin**; **bulk price CSV** in Phase 1.

## Out of Scope (Current / Later Phases)

* Live GPS tracking of delivery agents (*future*)
* iOS buyer app (*Phase 2*)
* Dark stores / warehouse inventory
* Order cancellation workflows
* Partial order fulfillment
* AI recommendations, demand forecasting (*Phase 3*)

---

# Vendor Registration

## Required / Collected Fields

* **Mandatory**: vendor/shop name, phone (+91), shop image
* **Optional**: GST, GST certificate image, bank account, IFSC, address, closed-day notes
* **Conditional**: if GST provided → bank account + IFSC **required**

## Approval

* **Request** submitted by town hub admin or super admin.
* **Final approval by super admin only** (town hub admin does not see platform fee terms).

---

# Microservice Architecture

## API Gateway

* Authentication, routing, rate limiting, request logging
* Spring Cloud Gateway

## Services

| Service | Responsibilities |
|---|---|
| **User Service** | Registration, login, JWT, roles, buyer profile, addresses |
| **Town Service** | Towns, enable/disable, town config, town history |
| **Vendor Service** | Vendor registration, shop, approval, active/inactive |
| **Catalog Service** | Master catalog, vendor listings, stock, catalog requests |
| **Cart Service** | Cart, cart items, town-change validation |
| **Order Service** | Master orders, sub-orders, status machine, agent leg mapping |
| **Payment Service** | Payments, COD tracking, settlements, refunds |
| **Delivery Service** | Delivery hubs, agents, assignments, pickup/delivery legs |
| **Notification Service** | SMS, push, WhatsApp |
| **Billing Service** | Town fee rules, commission, slabs, invoicing (*may merge with Town/Payment initially*) |
| **Media Service** | Photo upload, retention (*may be module within Delivery/Order initially*) |
| **Analytics Service** | Reports, KPIs (*Phase 2/3*) |

## Communication

* **REST** — synchronous queries and commands
* **Kafka** — asynchronous business events (order created, payment, delivery, notifications)
* **Database per service** — no cross-service direct DB access
* **Transactional outbox** — mandatory for event producers

## Infrastructure

* PostgreSQL (per service)
* Redis (caching)
* Apache Kafka
* Docker / Docker Compose (MVP); Kubernetes (production)

---

# Technology Stack

## Backend

* Java 21
* Spring Boot 3
* Spring Security, Spring Cloud
* JPA / Hibernate
* Maven
* Flyway
* MapStruct, Lombok
* OpenAPI, Actuator, Micrometer

## Frontend & Mobile

* **Web**: React, TypeScript, Redux Toolkit, Material UI
* **Mobile**: **Flutter** — Buyer, Vendor, Delivery apps (Android Phase 1; iOS Phase 2; shared codebase)
* **Apps**: three separate apps (Buyer / Vendor / Delivery); super admin web only

## Repository & Architecture

* **Git monorepo** — all microservices and shared libraries in **one repository**
* **Shared Java library** — events, auth helpers, outbox, correlation ID, common DTOs
* **API version**: `/api/v1` until breaking change
* **Order coordination**: **Kafka event choreography** (no central orchestrator service in MVP)
* **Idempotency-Key** header required on POST for orders and payments
* **Feature flags** per town (super admin)
* **Deploy**: rolling updates for pilot; **blue/green** when running 24+ towns

## Search Performance

* **OpenSearch** for catalog search from Phase 1 (fast typeahead, filters; avoids slow DB scans at scale)
* Redis cache for hot catalog queries; CDN for images
* Target: search feels instant; no UI jank on low-end devices

## Integrations

| Integration | Choice | Phase |
|---|---|---|
| SMS | **MSG91** (recommended for India; compare with AWS SNS) | 1 |
| WhatsApp | **Meta WhatsApp Cloud API** or Gupshup (price compare at Phase 2) | 2 |
| Email | AWS SES — skip heavy use in Phase 1 | 1 (minimal) |
| Maps | Google Maps — **super admin toggle** per platform | 2 |
| Payments | Razorpay + PhonePe | 1 |
| Push | Firebase FCM | 1 |
| Storage | AWS S3 ap-south-1 + signed URLs | 1 |

## Data & Messaging

* PostgreSQL, Apache Kafka, Redis
* Kafka: async events (order created → payment → notification). Sizing: ~**2,000–5,000 events/sec** at full 300-town scale (infra sized with headroom)
* **Analytics service**: Phase 2 (Kafka topics ready in Phase 1)
* **Data warehouse**: Phase 3 (export via analytics service until then)
* **SLA reporting** (vendor ready time, pickup, hub, delivery): Phase 1

## Security

* JWT authentication
* BCrypt password encoding
* Role-based access control
* Correlation ID propagation
* Audit logging

---

# Database Design (High Level)

## Core Entities by Service

* **User**: users, roles, user_roles, addresses
* **Town**: towns, town_config, town_history, town_status_labels
* **Vendor**: vendors, shops
* **Catalog**: categories, master_items, vendor_listings, catalog_requests
* **Cart**: carts, cart_items
* **Order**: orders, vendor_orders, order_items, order_assignments, outbox_events, processed_events
* **Payment**: payments, refunds, settlements, cod_reconciliation
* **Delivery**: delivery_hubs, delivery_agents, agent_hub_links, deliveries, delivery_photos
* **Notification**: notification_logs, channel_config

See `04_DATABASE_SCHEMA_AND_ERD.md` for schema (**v2.0**).

---

# Non-Functional Requirements

| Requirement | Target |
|---|---|
| API response time (p95) | **< 500 ms** reads; **< 1 s** writes |
| Availability | **99.9%** |
| Disaster recovery | RPO **1 hour**, RTO **4 hours** (recommended) |
| Region | **Single India region** first (e.g. ap-south-1 Mumbai); multi-region when >100 towns |
| Catalog search | **OpenSearch** Phase 1 + Redis cache |
| Kafka throughput | ~2,000–5,000 events/sec at maturity (with headroom) |
| CDN | **Yes** — product images via CloudFront/Cloudflare (lower latency, offloads API) |
| DB strategy | DB-per-service; **shard by town** in Order/Catalog services when >100 towns |
| Maintenance window | Configurable (default Sun 2–4 AM IST) |
| Concurrent users (peak/town) | ~200 |

---

# Operations

| Topic | Decision |
|---|---|
| Platform issues | **Central platform team** (super admins) owns infra/outages |
| Support hours | **10 AM – 5 PM IST** (platform on-call / support window) |
| Runbooks | Required before launch (payment stuck, Kafka lag, town outage) |
| Bulk admin tools | **Phase 1** (disable town, bulk notify, export orders) |
| Dashboards | **Real-time** orders/GMV for super admin and hub admin |
| Regional admins | **No** — super admins only; town hub admins report to platform |

---

# Legal & Compliance (Launch)

| Requirement | Phase 1 |
|---|---|
| FSSAI for food vendors | **No** mandatory field |
| E-invoicing | **Yes** |
| Return/refund policy in app | **Yes** |
| Grievance officer contact | **Yes** (super admin configurable) |
| Terms & Privacy | Super admin provides content |

---

# Client UX

| Requirement | Decision |
|---|---|
| Agent offline queue | **Yes** — queue status/photos, sync when online |
| Low-end Android | **Yes** — target 2 GB RAM, **Android 8+** |
| Accessibility | Phase 1 if low effort (font scaling minimum) |
| i18n | English UI only; **no i18n keys** required in Phase 1 |
| Hub admin PIN | **Yes** — disable vendor, COD close day |
| Google Maps | Phase 2; super admin enable/disable |

---

# Delivery Agents

* **One login**; linked to multiple hubs by respective hub admins.
* **No device binding** — agents may change phones; security via login, disable account, audit logs, Play Integrity.
* When **inactive**: block **new** assignments; hub admin may **manually reassign** in-flight work.
* App shows **assigned orders only**.
* **No cap** on concurrent deliveries per agent.

---

# MVP Scope

## Phase 1 — Narsaraopet Pilot

* All Phase 1 apps (Buyer/ Vendor/ Delivery Flutter + web admin)
* OpenSearch catalog search, Redis cache, CDN images
* Kafka event pipeline with outbox pattern
* Real-time admin dashboards; bulk admin tools
* Hub admin PIN; agent offline sync
* E-invoicing, policies, grievance officer in app
* SLA timestamps reporting (placed → picked → hub → delivered)
* Play Integrity on Delivery app
* Soft launch before public

## Phase 2

* Buyer **wallet**
* Buyer **iOS** (Flutter)
* **WhatsApp** notifications
* **Google Maps** (super admin toggle)
* Live GPS tracking of delivery agents
* Advanced analytics service / data warehouse prep
* Regional languages (i18n)

## Phase 3

* AI recommendations
* Demand forecasting
* ONDC integration (*optional future*)
* Route optimization

---

# Related Documents

| Document | Purpose |
|---|---|
| `02_SYSTEM_DESIGN.md` | Service interactions, sequence flows (**v2.0**) |
| `03_EVENT_DRIVEN_ARCHITECTURE.md` | Kafka topics, outbox, idempotency |
| `04_DATABASE_SCHEMA_AND_ERD.md` | Table definitions (**v2.0**) |
| `05_API_CONTRACTS.md` | REST API specs (**v2.0**) |
| `06_SECURITY_REQUIREMENTS.md` | Security / PIN / pen test |
| `08_GO_LIVE_PLAN.md` | 12-week Narsaraopet soft → public plan |

---

# Deliverables Expected From Implementation

1. Complete microservice architecture
2. Spring Boot applications per service
3. PostgreSQL schemas and Flyway migrations
4. Docker Compose (Kafka, Redis, per-service databases)
5. Kafka producers/consumers with outbox, retry, DLQ, idempotency
6. Redis caching where applicable
7. REST APIs with JWT security
8. Configurable order status labels
9. Town-configurable billing framework
10. Unit and integration tests
11. OpenAPI / Swagger documentation
12. Postman collection
13. CI/CD pipeline
14. Kubernetes deployment files (production)

Code must be production-ready, scalable, and follow clean architecture principles.

---

# Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | — | Initial PRD: multi-vendor marketplace, basic microservices |
| 2.0 | 2026-06-24 | Town model, delivery hub workflow, master catalog, agent assignments, configurable billing/statuses, updated roles, Narsaraopet pilot, no dark stores, no cancellation in v1 |
| 2.3 | 2026-06-24 | Batch 3 complete: monorepo, OpenSearch, ops, legal, integrations, SEC42+, no device binding, 99.9% uptime, Phase 2 wallet |
