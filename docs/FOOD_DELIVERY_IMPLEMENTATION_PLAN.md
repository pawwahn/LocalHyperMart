# Food delivery — implementation plan (living)

**Status:** Foundation in repo — Option A (listing bridge), simple menu, one hotel per order.

## Locked product rules

| Rule | Decision |
|------|----------|
| Menu shape | **Category → items** (no sub-category) |
| Pricing | **Simple** fixed price per item (no customization sheet in v1) |
| Veg / Non-veg | **Mandatory** on every dish (vendor must choose) |
| Customer note | **Mandatory** `buyerNote` — shown to buyer on menu & stored on listing `vendorNote` |
| Cart | **One hotel per order** |
| Checkout / payments / audit | **Same as grocery** (bag orders, settlement, COD/UPI) |
| Catalog mode | **Option A** — each menu item publishes a `FOOD_MENU` `vendor_listing` + `master_item` |
| Delivery | When hub is on and hotel has staff: buyer sees **hub delivery** and **hotel staff delivery** |
| Buyer isolation | `/food` journey — no grocery aisles or other services in that flow |

## Delivered (foundation)

| Layer | Scope |
|--------|--------|
| **vendor-service** | `Food Delivery` service offering (`hides_listings`), `food_profiles`, `CatalogListingPolicy.isFoodDeliveryService` |
| **catalog-service** | `food_menu_categories`, `food_menu_items` with `master_item_id` / `vendor_listing_id`; `vendor_listings.listing_kind` (`GROCERY` / `FOOD_MENU`); system category for food master items |
| **town-service** | `foodDeliveryEnabled` in operational config + shop-settings |

## Next

1. **Menu publish service** — on save item → create/update master item + `FOOD_MENU` listing (bridge)
2. **vendor-service / catalog APIs** — hotel profile + menu CRUD; vendor portal **Menu** nav
3. **buyer-web** — `/food` hotel grid + menu page; town banner; one-hotel cart guard
4. **Checkout** — delivery mode UI (hub vs hotel staff) when town + vendor allow
5. **Settlement** — report label `FOOD` (candidates registry)
6. **Super-admin** — food toggle in town Services (+ optional `/food` admin later)

## Pilot checklist

1. Super-admin: enable **Food delivery** for pilot town.
2. Register vendor with service **Food Delivery**; enable `food_profiles`.
3. Hotel: add categories + items (publish creates listings).
4. Buyer: order from `/food` → pay → track like grocery bag.
5. Verify payout / open accounts row matches grocery economics.