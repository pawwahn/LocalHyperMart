# Shop-held COD fee — test plan

Regression cases for **commission + buyer platform fee** on COD where the **shop keeps customer cash**. All surfaces must agree on **total to collect** (Amount / To KoyaKart / Send bill), with **commission** shown separately where labeled.

Reference scenario (P Mart–style): **2 bags**, GMV **₹1845** (₹800 + ₹1045), **7.5%** commission **₹138.38**, platform **₹3.00** (e.g. ₹1.50 × 2 orders) → **₹141.38** owed to KoyaKart.

---

## 1. Cross-surface totals (must match)

| # | Step | Expected |
|---|------|----------|
| 1.1 | **Town dues** → line for shop-held COD (Shop pays) | **Amount** = ₹141.38; **Commission** column = ₹138.38 only; detail includes `commission ₹138.38` and `platform fee ₹3.00` |
| 1.2 | **Super-admin → Settlements → Vendor pays KoyaKart** (same vendor/town, both bags selected) | **To collect** / **Send bill** = ₹141.38; summary: commission + platform fee rows sum to ₹141.38 |
| 1.3 | **Vendor portal → Payouts** (Unpaid, same period) | **To KoyaKart** = ₹141.38; not ₹138.38 (commission only) or ₹161.38 (commission + grocery COD surcharge) |
| 1.4 | After **Send bill**, vendor **Pay** + admin **Confirm received** (with **bank statement date**) | Bill **net** = ₹141.38; ledger/settlement lines include commission + platform fee |

**Fail if:** any two of 1.1–1.3 differ by more than ₹0.01 without an explained extra charge.

---

## 2. Vendor Payouts — breakdown & rows

| # | Step | Expected |
|---|------|----------|
| 2.1 | **Commission** metric card | Shows **₹138.38** (shop terms / slab), not ₹141.38 |
| 2.2 | Commission hint / subtext | Mentions **+ ₹3.00 platform** (or equivalent) on shop-cash bags |
| 2.3 | **Awaiting** table — **Est. fee** per shop-held row | **Commission + that bag’s platform share** (e.g. ~₹61.50 and ~₹79.88 for 800 / 1045 bags), not commission-only ₹60 / ₹78.38 |
| 2.4 | Footer **Cash in shop · 2 bags** | Fee total **−₹141.38**; **You pay KoyaKart** bar **₹141.38** |
| 2.5 | **Money map** (super-admin summary) | Collect step text references **commission + platform fee**; amount **₹141.38** (excludes double-counted “extra charges”) |

---

## 3. Grocery vs laundry — COD surcharge

| # | Step | Expected |
|---|------|----------|
| 3.1 | Grocery COD, shop-held, order has **non-zero `codFee`** on parent order | Vendor Payouts **does not** add grocery COD surcharge to “To KoyaKart” (only platform + commission per settlement rules) |
| 3.2 | Laundry COD, shop-held | **Platform + laundry COD fee** on cash kept can appear in pass-through; bill matches **Payouts** and admin collect tab |

---

## 4. Platform fee allocation (backend)

| # | Step | Expected |
|---|------|----------|
| 4.1 | **Two separate orders**, one bag each, platform ₹1.50 per order | Total platform **₹3.00** across both bags |
| 4.2 | **One order, two bags**, order platform **₹3.00**, goods ₹800 + ₹1045 | Split **₹1.30 + ₹1.70** (by goods share), not **₹3.00 per bag** |
| 4.3 | Sales report / settlement candidates for multi-bag order | Sibling bags loaded before share; same numbers as settlement API |

**Automated:** `OrderBuyerFeeShareTest`, `OrderSiblingBagsTest`, `OpenAccountsServiceTest.shopHeldCash_*`

---

## 5. Bills & confirm (financial accountability)

| # | Step | Expected |
|---|------|----------|
| 5.1 | Create/send **COLLECTION** bill for the 2 bags | `netAmount` = ₹141.38; line items: **COMMISSION** + **PLATFORM_FEE** (and **COD_FEE** only when product includes it, e.g. laundry) |
| 5.2 | Admin **Confirm payment received** | **Bank statement date** (`bankPaidOn`, IST) required; reject path requires comment to vendor |
| 5.3 | Vendor **Not received** / resubmit | Bill returns to vendor with comment; totals unchanged unless bags/selection change |

---

## 6. Filters & edge cases

| # | Step | Expected |
|---|------|----------|
| 6.1 | Change **date filter** on vendor Payouts | **To KoyaKart** for open shop fees still quotes **all unpaid shop bags** for fee API (filter affects list, not under-counting platform on selected view) |
| 6.2 | Select **one of two** shop-held bags on admin collect tab | To collect = that bag’s commission + platform share + extras only |
| 6.3 | **Open bills** already sent | Vendor **To KoyaKart** uses **bill `netAmount`** (₹141.38), not re-estimate from commission card alone |

---

## Quick smoke (after deploy)

1. Restart **order-service** (8086) and **payment-service** (8087) after fee-allocation changes.
2. Hard refresh **super-admin Settlements** and **vendor Payouts**.
3. Run: `mvn -f services/order-service/pom.xml test -Dtest=OrderBuyerFeeShareTest,OrderSiblingBagsTest`  
   `mvn -f services/payment-service/pom.xml test -Dtest=OpenAccountsServiceTest`
