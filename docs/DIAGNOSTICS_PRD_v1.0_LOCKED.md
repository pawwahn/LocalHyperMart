# KoyaKart — Diagnostics (Home Sample Collection)

## Document status

| Field | Value |
|--------|--------|
| **Version** | **1.6 LOCKED** |
| **Status** | **In development** (v1.6 product lock; backend + buyer/vendor/super-admin UI MVP landed) |
| **Parent PRD** | [`01_PRD.md`](./01_PRD.md) (town model, roles, payments, security, audit) |
| **Vertical** | Fourth service alongside Shop, Laundry, Beauty |

This module inherits **accounts (buyer/vendor login), payments, settlements, media, notifications, IDOR rules, and audit** from existing KoyaKart service patterns unless explicitly noted below.

---

## 1. Vision

Enable town-based **home blood/sample collection** booking with **local diagnostic labs** as vendors. KoyaKart provides **discovery, pricing, slot booking, fee collection, status tracking, prescription/sample photos, structured result entry, optional report file uploads, and customer-facing report access**.

KoyaKart is **not** a diagnostic laboratory and does **not** provide medical advice, diagnosis, or treatment.

---

## 2. Platform positioning (mandatory UI)

**Short banner** (first diagnostics use + order/report screens):

> KoyaKart helps you book sample collection slots and view reports shared by your lab. KoyaKart is not a diagnostic lab and does not provide medical advice.

**Long help** (link): tests and reports are the **selected lab’s** responsibility; for clinical questions contact **doctor or lab**; **not for emergencies**.

Generated report PDF **footer** repeats the short disclaimer + lab name/address.

---

## 3. Scope

### 3.1 In scope (MVP)

- Single **lab per booking** (no multi-lab cart).
- Lab-managed **test menu**, **packages**, and **prices**.
- **Home collection slots** (lab-defined capacity); no delivery-hub bag flow.
- **Patient** = account holder (Self) or **dependent** under the account.
- **Reference**: `SELF` or `DOCTOR`; if `DOCTOR`, required **doctor name** (free text).
- **Prepay (online)** and **COD**; COD adds **town-configured surcharge** for diagnostics.
- **Platform service fee** shown to customer (diagnostics-specific town settings).
- **Lab Admin / Manager** assigns **Collection Agent**; agent uses **vendor portal on mobile web** (“Collection → My visits”).
- Up to **5 sample photos** at collection; **prescription photo(s)** per rules (see §8).
- Lab **report ETA** after sample at lab.
- **Hybrid report**: lab enters **result values** (platform generates PDF) **and/or uploads report files**; customer sees all; lab edits until **Report finalized**.
- **OTP required** when lab initiates booking or adds dependents on a customer mobile number.
- **Accounts, payments, audits** aligned with Laundry/Beauty/Shop (see §12).

### 3.2 Out of scope (MVP)

- National lab API integrations, ABHA, HL7/FHIR.
- OCR on prescriptions; auto-merge of multiple PDFs into one file.
- Delivery hub consolidation, delivery-agent last mile for samples.
- Multi-lab checkout, dark-store inventory.
- Separate native collector app (use vendor portal mobile web).

---

## 4. Users and lab roles

### 4.1 Platform actors (non-lab)

| Actor | Description |
|--------|-------------|
| **Buyer (account holder)** | Existing KoyaKart OTP login; owns dependents and sees all bookings under that account. |
| **Patient** | Person sampled; may be Self or dependent profile. |
| **Lab vendor (legal entity)** | `DIAGNOSTICS` service type; same vendor registration/approval model as other services. |
| **Super admin / town hub admin** | Town diagnostics enablement and fees; disputes; **override/cancel with audit** per platform rules. |

### 4.2 Lab staff — visibility vs actions (locked)

**Principle:** All lab staff share the same **read plane**. Any active lab login may **view** (read-only): **all orders** (all branches), **all reports** (including in-progress before finalize), **payouts / settlement statements**, **catalog & branches**, and **audit history**. No role-based hiding of payouts or reports inside the lab.

**Writes** (who can change data) are still restricted below — audit records **who** did each action.

Each staff member is a **separate login** scoped to **one diagnostics vendor**. A member may hold **one or more** job roles (§4.3) on the same login (§4.5).

**24×7:** Slot templates may span **24 hours** per branch. Any shift lead uses the same global lab data; actions are attributed by login.

**Collector UX (locked 4-A):** mobile-friendly vendor portal; **My visits** is a **workflow shortcut** (assigned field work), not a permission wall.

### 4.3 Job roles — minimum required vs organizational labels

#### How many roles are **minimum required**?

| Layer | Minimum | Meaning |
|--------|---------|---------|
| **Platform enforcement** | **2 role types** | **`LAB_ADMIN`** + **`LAB_STAFF`**. Every human is at least Staff; ≥1 Admin per vendor. |
| **Field work** | **+1 capability** (not a third role type) | **`collectionCapable`** on any login — required for anyone who performs home visits. |
| **Organizational labels (optional but supported)** | **Up to 4 titles** | **Manager**, **Lab Technician**, **Collection Agent** — used for **staffing limits**, **UI defaults**, and **audit labels**; **same read access** as all Staff. |

**Smallest viable lab (1 person):** one login = **Lab Admin** + **`collectionCapable`** — runs everything.

**Typical 24×7 lab (your model):** **1+ Admin**, **up to 4 Manager-labelled Staff**, **N Technicians**, **N Collection Agents** — many logins, but still only **2 enforced role types** + collection flag + optional title.

**Do not confuse:** *minimum roles* (2 + flag) vs *minimum headcount* for 24×7 (operational — often ≥2 collection-capable staff plus bench coverage).

#### Four organizational titles (locked for product + audit)

| Title | Enforced type | Count limit | Typical write powers (in addition to universal **read**) |
|--------|---------------|-------------|-----------------------------------------------------------|
| **Lab Admin** | `LAB_ADMIN` | ≥1 | Staff: create/disable **Admin** & **Manager** (≤4); create all staff; **reopen** report; all operational writes. |
| **Manager** | `LAB_STAFF` + title | **≤4 active** | All operational writes (assign, catalog, branches, slots, OTP booking, results, finalize); create **Technician** & **Collection Agent** staff; disable Agent/Tech only. |
| **Lab Technician** | `LAB_STAFF` + title | N | **Bench-only writes:** receive at lab, report ETA, result entry, attachments, **finalize**. **No** assign collector, catalog/branches/slots, OTP booking, or staff CRUD (Manager/Admin desk). |
| **Collection Agent** | `LAB_STAFF` + **`collectionCapable`** | N | **Field writes only** on visits **assigned to them** (status, photos, COD mark); **no** result entry/finalize/staff CRUD unless also holds Admin/Manager/Tech title. |

“Front desk” is not a separate title — **Manager** or **Admin** runs OTP-assisted bookings.

### 4.4 Permission matrix — **writes only** (everyone reads all)

| Write capability | Lab Admin | Manager | Lab Technician | Collection Agent* |
|------------------|:---------:|:-------:|:--------------:|:-----------------:|
| Staff: add/remove **Lab Admin** | ✓ | — | — | — |
| Staff: add/remove **Manager** (≤4) | ✓ | — | — | — |
| Staff: add/remove **Technician** / **Agent** | ✓ | ✓ | — | — |
| Disable staff | ✓ | Agents/Tech only | — | — |
| Branches, catalog, slots, prices | ✓ | ✓ | — (read all) | — |
| Lab-initiated booking + OTP | ✓ | ✓ | — (read all) | — |
| Assign / reassign collector | ✓ | ✓ | — (read all) | — |
| Collection field steps | if capable | if capable | if capable | ✓ (assigned visits) |
| Mark **RECEIVED_AT_LAB**, report ETA | ✓ | ✓ | ✓ | — |
| Results, attachments, **finalize** | ✓ | ✓ | ✓ | — |
| **Reopen** finalized report | ✓ | — | — | — |

\*Collection Agent without other titles: **read everything**, **write** only collection steps on **assigned** orders.

**Authorization:** `vendorId` match + write matrix; **read** endpoints for lab portal = any active staff of that vendor. **IDOR:** no cross-vendor access.

### 4.5 Staff and configuration audit (required)

Append-only **`DiagnosticsStaffAudit`** (or equivalent vendor-scoped audit stream), in addition to **`DiagnosticsOrderEvent`**:

| Event type | Examples |
|------------|----------|
| Staff lifecycle | `STAFF_CREATED`, `STAFF_DISABLED`, `STAFF_REENABLED`, `ROLES_CHANGED` |
| Staff actor on orders | All order events record **`actorStaffId`**, **`actorRoles[]`**, **`vendorId`** |
| Sensitive config | Branch add/edit/disable, radius change, catalog price change, slot template change |
| Report compliance | `REPORT_FINALIZED`, `REPORT_REOPENED` (with reason) |

**Any lab staff** may open **Audit history** (read-only). Retention aligns with platform audit minimums ([`06_SECURITY_REQUIREMENTS.md`](./06_SECURITY_REQUIREMENTS.md), town history patterns).

### 4.6 Multi-role on one person (locked)

When a staff member holds **multiple roles** (e.g. owner = Lab Admin + Manager + Technician + Collection Agent):

1. **Permissions** = **union** of all assigned roles (most permissive wins for allow; deny rules still apply e.g. only Admin reopens).
2. **Single login** — no “switch role” mode in MVP.
3. **UI** adapts to show **all applicable areas** in one navigation shell:
   - **Overview / Orders**, **Payouts**, **Reports**, **Audit** — visible to **all** titles (read)
   - **Dispatch**, **Lab desk**, **Staff & branches** — shown when login has write powers for those areas
   - **My visits** — when `collectionCapable` (shortcut to assigned field work)
4. **Mobile priority:** if user has **Collection Agent** and has **≥1 open visit today**, default landing = **My visits**; tab bar still exposes Orders / Lab desk if they also manage or tech.
5. **Backend** still logs **actual roles** on each action for audit clarity.

### 4.7 Scenario coverage

| Scenario | Expected behavior |
|----------|-------------------|
| Lab runs **24×7** with 4 Managers on rotating shifts | Each sees **same data**; **Managers** assign collectors; **Technicians** run bench/results only. |
| 5th **Manager title** attempted | **Blocked**; max 4 active Manager labels. |
| Manager adds **20 Collection Agents** | Allowed; audit `STAFF_CREATED`. |
| Night shift **Agent** checks payout / draft report on another order | **Read allowed**; **edit** report or finalize → **403**. |
| Agent completes **assigned** visit | Collection writes allowed; audited. |
| Technician finalizes | Allowed; `REPORT_FINALIZED` audited. |
| Wrong finalize | **Lab Admin** **reopen** only. |
| Admin disables Agent mid-route | No new actions; **complete in-progress assigned visit** allowed (audit flag). |
| Manager disables another Manager | **Not allowed** — Lab Admin only. |
| One person, all four titles + collection | Single UI (§4.6); full read; union of writes. |
| Two staff assign same visit | First assign wins; second sees conflict. |
| Branch added at 2 AM | Allowed for roles with branch write; audited. |
| Curious Agent exports settlement PDF | **Allowed read** (trust + audit trail; lab’s internal policy). |

---

## 5. Account and dependents

### 5.1 Rules

- **Primary account** = existing **user-service** buyer (mobile OTP).
- **Dependents** (`PatientProfile` / family member) stored **under account holder user id**.
- Every booking references **one patient profile** (Self or dependent).
- **Existing KoyaKart users** reuse login; first diagnostics use confirms Self profile or adds dependents.

### 5.2 Dependent fields (MVP)

| Field | Required |
|--------|----------|
| Display name | Yes |
| Relation (Self, Spouse, Child, Parent, Other) | Yes |
| Gender | Yes |
| Age **or** DOB | One required |
| Notes (e.g. fasting reminder) | No — display only |

### 5.3 Lab-created profiles and bookings

- Lab enters customer **mobile** → system sends **OTP** → customer must verify before booking/profile attach is confirmed (**locked**).
- Lab may propose new dependent; effective only after **OTP on that account’s number** (customer on phone at counter or SMS flow).

### 5.4 Account delete / privacy

- Follow [`01_PRD.md`](./01_PRD.md) and [`09_LEGAL_COMPLIANCE_MATRIX.md`](./09_LEGAL_COMPLIANCE_MATRIX.md): buyer delete **anonymizes PII**; **financial and order audit retained**.
- Report and prescription media: access via **signed URLs**; IDOR tests include diagnostics order IDs ([`QA_SECURITY_CHECKLIST.md`](./QA_SECURITY_CHECKLIST.md)).

---

## 6. Booking flow (buyer)

1. Select town → enabled **diagnostics** lab(s).
2. Add tests/packages to **diagnostics cart** (single lab).
3. Select **patient** (Self/dependent).
4. **Reference**: Self **or** Doctor; if Doctor → **doctor name** (required, max 120 chars).
5. Collection **address** (must match **selected town** — same rule as main PRD).
6. System resolves **serving branch** from address + branch radii (§6.1); **Date + slot** for that branch (branch capacity).
7. Optional/required **prescription upload** (§8).
8. **Fee review** (§7) + payment method.
9. Confirm → order **BOOKED** (payment rules §7).

### 6.1 Service area — branches and radius (locked)

Labs often have **multiple branches in the same town**. One **diagnostics vendor** may manage **many collection branches** (primary location at registration + add more anytime).

**Per branch (collection point):**

| Field | Notes |
|--------|--------|
| Branch label | e.g. “Main lab”, “Branch – MG Road” |
| Address | Geocoded to **lat/lng** (anchor) |
| **`homeCollectionRadiusKm`** | X km for **this** branch |
| Active flag | Inactive branch = not used for new bookings |

**Updates:** Lab admin may **add, edit, disable branches, and change X km at any time** — each change **audit logged** (same vendor audit patterns as other services). No super-admin approval required for radius/branch edits unless town policy adds a cap (optional **`diagnosticsMaxRadiusKm`** per town).

**Eligibility** (home collection offered) when **all** hold:

1. Collection address is in the **buyer’s selected town** (main PRD), **and**
2. Geocoded collection address is within **X km** (haversine) of **at least one active branch** anchor for that lab.

**Serving branch:** Among branches that cover the address, select **nearest** anchor. Persist **`servingBranchId`** on the order (snapshot); collector assignment and slots use this branch. If the buyer changes address before confirm, re-resolve branch.

**Buyer UX:** Lab card may show “Home collection from N branches in town”. Out of coverage: “No branch of {lab} collects at this address — try another lab or visit a branch.”

**Why radius per branch:** Collectors dispatch from the **branch** that owns the visit; matches spread-out labs without pincode maintenance.

**Ops notes (implementation later):** geocode on address/branch save; if geocode fails, block confirm until fixed. Map pin for address (Phase 2). Existing **confirmed** orders keep original **`servingBranchId`** even if branch is later disabled or radius shrinks.

---

## 7. Payments and fees

Follow **payment-service** and **order-service** patterns used for **Laundry** and **Beauty**:

| Item | Behavior |
|------|----------|
| **Online prepay** | Payment intent at confirm; order proceeds on success (same gateways as platform). |
| **COD** | Allowed when town **`diagnosticsCodEnabled`**; adds **`diagnosticsCodSurchargeAmount`** (₹X) as **visible line item** at checkout and on order/invoice snapshot. |
| **Platform fee** | **Flat ₹ per order** (`diagnosticsPlatformFeeFlat`) from diagnostics town settings; **always visible** to customer (checkout, order detail, generated PDF). **MVP:** no % fee (may add later). |
| **Lab test subtotal** | Snapshot at booking time (vendor prices + home collection fee if lab charges). |
| **Refunds** | Prepaid: platform default SLA (e.g. 5 working days, town-configurable) on cancel per policy; **COD: no refund path**. |
| **Settlements** | Lab payouts / commission on diagnostics GMV follow **same vendor settlement pipeline** as other vendor services (weekly statements, fee on payout statement per main PRD). |
| **COD reconciliation** | **Collected at doorstep**: collector marks **COD received** with amount; flows into existing **COD / open accounts** treatment for service orders (same as laundry COD surcharge semantics in shop-held docs where applicable). |

**Town settings (diagnostics-only — do not reuse beauty/laundry scratch/prepay knobs):**

- `diagnosticsEnabled`
- `diagnosticsPlatformFeeFlat` (₹ per order — super admin / town config)
- `diagnosticsCodEnabled`
- `diagnosticsCodSurchargeAmount`
- `diagnosticsMaxPrescriptionPhotos` (default 3)
- `diagnosticsMaxSamplePhotos` (default 5)
- `diagnosticsMaxReportAttachments` (default 5)
- Upload size limits: align with town **upload limits** + media-service

### 7.1 Cancellation and reschedule (locked default)

| When | Buyer | Lab (Admin/Manager) | Refund (prepaid) |
|------|--------|---------------------|------------------|
| Before **`ASSIGNED`** | Cancel or reschedule slot (self-serve) | Cancel/reschedule | **Full** refund per platform SLA |
| **`ASSIGNED`** or later | Cancel **not** self-serve; contact lab | Cancel with reason (audited) | Refund per lab/platform policy (MVP: **manual ops** / super-admin assist; automated rules Phase 2) |
| **COD** | Same status gates | Same | N/A (no payment collected yet at cancel) |

Reschedule before **ASSIGNED**: free slot change if capacity available. Collection started (`COLLECTION_IN_PROGRESS`+): no reschedule — lab **NO_SHOW** / **RETEST** flows only.

---

## 8. Prescription

- **Default:** optional for all tests.
- Lab marks test **`prescriptionRequired`** → checkout **blocks confirm** until at least one prescription photo uploaded.
- **Lab** can view and **download** prescription media (signed URL, audit on admin access per [`05_API_CONTRACTS.md`](./05_API_CONTRACTS.md) media patterns).
- No OCR in MVP.

---

## 9. Order lifecycle

Statuses (internal codes stable; buyer labels town-configurable like main PRD):

```
BOOKED → ASSIGNED → COLLECTION_IN_PROGRESS → SAMPLES_COLLECTED
  → RECEIVED_AT_LAB → REPORT_ETA_SET → REPORT_IN_PROGRESS → REPORT_FINALIZED → COMPLETED
```

Side states: `CANCELLED`, `NO_SHOW`, `COLLECTION_FAILED` / `RETEST_REQUIRED` (with lab note).

| Stage | Who | Notes |
|--------|-----|--------|
| BOOKED | System / buyer | Slot reserved; payment per method |
| ASSIGNED | Lab Admin / Manager | Collection Agent assigned |
| Collection | Collection Agent (mobile vendor portal) | 1–5 sample photos; mark COD received if COD |
| RECEIVED_AT_LAB | Admin / Manager / Technician | Triggers **report ETA** (required) |
| REPORT_IN_PROGRESS | Admin / Manager / Technician | Enter values + upload files |
| REPORT_FINALIZED | Admin / Manager / Technician | Locks report; notifies buyer |
| COMPLETED | System | Optional terminal after customer acknowledgment or auto after N days |

**Edits:** Lab may edit **values and attachments** until **REPORT_FINALIZED**.

**Reopen (locked default):** **Lab admin only** may **reopen** finalized report with **mandatory reason** → status back to REPORT_IN_PROGRESS → **audit event** → re-finalize.

**Reference/doctor name:** editable until **RECEIVED_AT_LAB**; then read-only unless lab admin override with audit note.

---

## 10. Reports (hybrid — locked)

### 10.1 Structured entry

- Per booked test line: result **value**, **unit**, optional **reference range** text, optional flag (normal/high/low).
- Platform renders **branded PDF** (patient, lab, tests, reference/doctor, dates, fee disclaimer footer).
- **Customer and lab** can **download** generated PDF.

### 10.2 File upload

- Lab may upload **PDF/JPEG/PNG** report files (count/size limits per town).
- **Customer/patient** sees downloads for **generated PDF + each attachment** (separate buttons in MVP; no merged pack).

### 10.3 Visibility

- After finalize: customer sees report section; before finalize: customer sees status/ETA only (not draft values unless product toggles “preliminary” — **MVP: hidden until finalize**).

---

## 11. Catalog (lab vendor)

- Tests and packages with **home collection** flag.
- Prices set by lab; super admin does not own lab test catalog (unlike grocery master catalog).
- Package = bundle price + member tests.
- Fasting/prep text per test; buyer checkbox “I understand” before pay.

---

## 12. Alignment with existing platform (accounts, payments, audit)

### 12.1 Accounts and auth

- Buyer: **JWT** after OTP; same session as shop/laundry/beauty.
- Vendor: **vendor-service** registration, approval, `X-Vendor-Id` / role claims as today.
- Lab sub-users: enforced `{ LAB_ADMIN | LAB_STAFF }`, optional **`collectionCapable`**, optional **title** `{ MANAGER, TECHNICIAN, COLLECTION_AGENT }` for limits/UI/audit; JWT resolves **read = all staff**, **write = §4.4**.
- **Lab staff login (locked):** each staff member uses **mobile OTP** (same pattern as buyer/vendor owner); Admin creates staff with **unique mobile** per person; no shared passwords in MVP.
- **Internal APIs**: `X-Internal-Service-Secret` per [`06_SECURITY_REQUIREMENTS.md`](./06_SECURITY_REQUIREMENTS.md).

### 12.2 Payments

- Create/capture/refund via **payment-service** linked to diagnostics order id (same correlation as beauty/laundry orders).
- Order stores **payment method**, **amount snapshot**, **platform fee**, **COD surcharge** line items.
- Webhooks and idempotency: same patterns as existing service orders.

### 12.3 Audit and history

- Entity tables extend **`BaseAuditEntity`** (`created_at`, `updated_at`, etc.) like `LaundryOrder`, `BeautyOrder`.
- Append-only **`DiagnosticsOrderEvent`** (mirror `LaundryOrderEvent` / `BeautyOrderEvent`) for status changes, assign, finalize, reopen, ETA changes, payment markers — each with **`actorStaffId`** + roles.
- Append-only **`DiagnosticsStaffAudit`** for staff CRUD, role changes, and sensitive lab config (§4.4).
- **Super admin** force-cancel / status override: **`POST /orders/admin/...`** style endpoints with **town admin audit** (`appendAdminAudit`) — same as grocery orders.
- Sensitive media access logged per security requirements.
- **Town history** append-only for config changes to diagnostics town flags.

### 12.4 Notifications

- Reuse **notification-service** (SMS + PUSH templates): booked, assigned, ETA set/updated, report finalized.
- Quiet hours / max SMS per order: town rules from main PRD.

### 12.5 Media

- **media-service** stages: `PRESCRIPTION`, `SAMPLE_COLLECTION`, `REPORT_ATTACHMENT`.
- Signed URL download; upload limits from town diagnostics settings.

---

## 13. Technical placement (reference only — no build yet)

| Concern | Service |
|---------|---------|
| Town diagnostics flags/fees | town-service |
| Dependents / patient profiles | user-service |
| Lab catalog, slots, staff | vendor-service (+ catalog if shared pattern) |
| Diagnostics order aggregate | order-service |
| Payments | payment-service |
| Files / PDF storage | media-service (+ PDF generation module TBD in order or dedicated) |

**Gateway:** public routes under same `/api/v1/` conventions; no cross-DB access ([`02_SYSTEM_DESIGN.md`](./02_SYSTEM_DESIGN.md)).

---

## 14. Edge cases (product behavior)

| Case | Behavior |
|------|----------|
| Address geocode fails | Do not allow confirm until resolved (retry/edit address) |
| Address in town but outside all branch radii | Block checkout; suggest another lab or walk-in branch |
| Lab adds branch / increases radius | More addresses become eligible immediately for **new** bookings |
| Lab disables branch or shrinks radius | **In-flight** orders on that branch continue; **new** bookings re-evaluated |
| Address covered by two branches | **Nearest** branch wins; order stores snapshot |
| Lab changes radius after bookings | Existing **confirmed** orders unchanged; new rules apply to new bookings only |
| Wrong patient before collection | Buyer/lab edit until collection started |
| Slot full | Not offered |
| Lab disabled | No new bookings; in-flight continue |
| Price changed before pay | Refresh at confirm |
| Test removed from menu | Block checkout |
| No-show | Collector marks NO_SHOW; reschedule manual |
| Partial panel failure | Lab notes; partial refund Phase 2 / manual ops MVP |
| Duplicate dependents | Allowed with warning; disambiguate by DOB/age |
| OTP fail on lab booking | Cannot confirm until verified |

---

## 15. MVP pilot

- **1 town**, **1–2 labs**, **~20–30 tests** each.
- Enable `diagnosticsEnabled` after lab onboarding and UAT.

---

## 16. Acceptance criteria (MVP done)

1. End-to-end booking with Self/Doctor reference, visible platform + COD fees, OTP lab booking path.
2. Collector completes visit on **mobile vendor portal** with photos (+ COD mark if applicable).
3. Lab sets ETA, enters results, uploads file(s), finalizes; customer downloads generated PDF and attachments.
4. Edits blocked after finalize except **lab admin reopen** with audit.
5. IDOR: foreign order/patient/media returns 403/404.
6. Payment and settlement records appear in same reporting/settlement flows as laundry/beauty.
7. RBAC: 5th Manager blocked; Agent cannot finalize; Admin reopen audited; multi-role staff sees unified UI; staff actions appear in audit history.

---

## 17. Change control

| Version | Date | Notes |
|---------|------|--------|
| 1.0 LOCKED | 2025-11-05 | All thread decisions consolidated; implementation **explicitly deferred** until PO says “start”. |
| 1.1 LOCKED | 2025-11-05 | **A6:** home collection area = **radius X km** from lab anchor at registration (replaces pincode allow-list). |
| 1.2 LOCKED | 2025-11-05 | **A6:** **multi-branch** per lab; **radius editable anytime** (audited); serving branch on order. |
| 1.3 LOCKED | 2025-11-05 | **RBAC:** 4 lab roles; max **4 Managers**; unlimited agents/techs; multi-role UI; staff + order audit. |
| 1.4 LOCKED | 2025-11-05 | **Universal lab read** (payouts, reports, orders, audit); **min 2 enforced types** + `collectionCapable`; 4 titles = organizational. |
| 1.5 LOCKED | 2025-11-05 | **Technician = bench-only writes** (results/ETA/finalize); dispatch & catalog = Admin/Manager only. |
| 1.6 LOCKED | 2025-11-05 | Platform fee **flat ₹/order**; cancel/reschedule **default** §7.1; lab staff **mobile OTP**. |

Amendments require a new version row and explicit unlock — do not implement speculative scope beyond this document.

---

## 18. Locked decision log (summary)

| # | Decision |
|---|----------|
| 1 | Prepay + COD; COD surcharge ₹X per **diagnostics town settings** |
| 2 | OTP **must** for lab-initiated booking/dependents on customer number |
| 3 | Hybrid report: enter values → PDF **+** file uploads; edit until finalize |
| 4 | **4-A** Collector = vendor portal mobile web, “My visits” |
| 5 | Platform fee **visible** to customer |
| 6 | Prescription photo: customer upload; lab view/download; required only if test flagged |
| 7 | **Diagnostics-specific** town settings only |
| 8 | Reference Self or Doctor + doctor name field |
| A4 | COD collected **at doorstep**; collector marks received |
| A6 | **Multi-branch** home collection: each branch has anchor + **X km**; editable **anytime** (audit); address must fall in **any** active branch radius; **nearest** branch = serving branch on order |
| A8 | Reopen finalized report: **lab admin only** + reason + audit |
| A9 | **Read:** all staff see payouts, reports, orders, audit. **Write:** §4.4. **Technician:** bench-only. **Min enforced:** **Lab Admin + Lab Staff** + **`collectionCapable`**. **Titles:** Admin, Manager (≤4), Technician (N), Agent (N). |
| A10 | **Platform fee MVP:** **flat ₹ per order** (`diagnosticsPlatformFeeFlat`) |
| A11 | **Cancel/reschedule:** §7.1 default (buyer free until **ASSIGNED**) |
| A12 | **Lab staff auth:** **mobile OTP** per staff member (unique phone) |
