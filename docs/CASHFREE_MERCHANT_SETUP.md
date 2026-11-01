# Cashfree merchant dashboard (KoyaKart)

Reference for sandbox/production setup. KoyaKart integrates via **Payment Gateway** API keys in `payment-service`; dashboard tasks below are **merchant-side**, not in this repo.

## Two different areas

| Area | Path | Use for |
|------|------|---------|
| **Developers** | Developers → Products → **Payment Gateway** | API Keys, Webhooks, API logs, rate limits |
| **Settings** | **Settings** → General → **Branding** | Checkout **business name**, logo, brand colours shown on Cashfree hosted checkout |

The purple checkout header **“Business Name”** comes from **Settings → Branding** (and related checkout customisation), not from Create Order API. Set display name **KoyaKart** and primary colour **`#009111`** when those fields exist.

Env `RAZORPAY_CHECKOUT_NAME` / `checkout-name` only affects Razorpay modal title and Cashfree `order_note` — not the Cashfree header.

## Developers → Payment Gateway (required for dev)

1. **API Keys** → sandbox App ID + secret → `.env.local` as `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`.
2. **Webhooks** → `https://<public-host>/api/v1/payments/webhooks/cashfree` (optional on localhost).
3. **API Logs** — debug failed creates / webhooks.

Product home **“Explore our products”** → open **Payment Gateway** → **Try Test Environment** if the account is not activated yet.

## Settings → Branding (checkout UX)

1. Open **Settings** (gear).
2. Under **General**, select **Branding**.
3. Set business / brand name **KoyaKart**, logo URL or upload, primary colour **#009111**.
4. Save; re-open a test payment to verify the hosted checkout header.

If a separate **Visual Customisation** page appears under Payment Gateway / One Click Checkout, use the same name, logo, and colour there.

## MCP Server (optional — future)

**Settings → MCP Server** exposes Cashfree data/tools to external AI clients (e.g. Claude, ChatGPT, local MCP install).

| Toggle | Typical use | KoyaKart note |
|--------|-------------|----------------|
| MCP Server master | Enable integration | Leave **off** until there is a defined ops/automation need |
| Read tools | View orders, payments, settlements, reports | Could help finance/support investigations; prefer **KoyaKart admin APIs** for product features |
| Write tools | Create orders, refunds, payment links, recon | **High risk** — keep **off** unless a controlled automation owns credentials and audit |

**Manage access to MCP** — restrict to trusted users; do not enable write tools for casual experimentation. Production refunds and payment creation should stay in `payment-service` + super-admin flows with JWT and audit trails.

## KoyaKart code touchpoints

- `services/payment-service/.../cashfree/CashfreeClient.java` — create order, refunds
- `POST /api/v1/payments/webhooks/cashfree` — async payment status
- Buyer checkout — gateway pick after Pay now (`OnlinePaymentSheet`); brand colour in app: **`#009111`** (see `.cursor/rules/brand-theme.mdc`)

## Checklist (sandbox pilot)

- [ ] Payment Gateway test API keys in `.env.local`
- [ ] Settings → Branding: KoyaKart + `#009111`
- [ ] Webhook URL on QA/public host
- [ ] MCP: disabled unless explicitly needed
