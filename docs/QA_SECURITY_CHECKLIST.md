# QA & production security checklist

Use before promoting a build to shared QA or production. See also `docs/06_SECURITY_REQUIREMENTS.md`.

## Secrets & environment

- [ ] `JWT_SECRET` — unique, ≥32 random characters; same value on gateway and all Java services
- [ ] `HLM_INTERNAL_SERVICE_SECRET` — unique random string; **same on all services** in QA/prod (required when `hlm-secure` profile is active)
- [ ] `POSTGRES_PASSWORD`, `REDIS_PASSWORD` — strong; not defaults from dev
- [ ] `RAZORPAY_*` / Cashfree / PhonePe — test keys in QA, live keys only in prod; never in git
- [ ] `PAYMENT_DEV_WEBHOOK_BYPASS` — **unset** in QA/prod (local dev may use `dev-bypass` via `.env.local`)
- [ ] `PASSWORD_RESET_OTP_FIXED_CODE`, `DELIVERY_OTP_FIXED_CODE` — **unset** in prod; QA only if documented
- [ ] `.env.qa` / prod secrets — from vault or SSM, not committed

## Compose / runtime (QA)

- [ ] `SPRING_PROFILES_ACTIVE=hlm-secure` (default in `docker-compose.qa.yml`)
- [ ] `HLM_GATEWAY_RATE_LIMIT=true` and Redis reachable from api-gateway
- [ ] `HLM_CORS_ALLOWED_ORIGIN_PATTERN` set to your QA site origin (not `*` on public hosts)
- [ ] Only port **80** (web) exposed; service ports **not** published to the internet

## Authentication & access

- [ ] Login, refresh, logout work for buyer, vendor, delivery, super-admin
- [ ] **IDOR:** another user’s order/cart/address/beauty/laundry IDs return 403/404
- [ ] Super-admin and hub-admin routes reject buyer/vendor tokens
- [ ] Spoofed `X-User-Id` on API calls through gateway has no effect (gateway strips client headers)

## Internal APIs

- [ ] Direct call to a service port `/api/v1/internal/...` without `X-Internal-Service-Secret` returns **404** (when secret is configured)
- [ ] Checkout, payouts, and webhooks still work (RestClient sends internal secret automatically)

## Payments & webhooks

- [ ] Online checkout happy path (Razorpay test / configured gateway)
- [ ] Webhook with **invalid** signature → rejected
- [ ] Duplicate webhook → idempotent success state

## Uploads & abuse

- [ ] Reject non-image and wrong magic-byte uploads on media endpoints
- [ ] OTP rate limit after repeated requests

## Exposure & headers

- [ ] `/swagger-ui`, `/v3/api-docs` **disabled** with `hlm-secure` profile
- [ ] Actuator limited to health (+ prometheus on internal monitoring only)
- [ ] Gateway responses include security headers (`X-Content-Type-Options`, etc.)
- [ ] HTTPS/TLS in front of QA/prod (reverse proxy or load balancer)

## Frontend (all four web apps)

- [ ] Mobile widths: ~360px, ~390px — no broken checkout or admin flows
- [ ] Slow 3G — loading states, no double payment submit
- [ ] No secrets in `VITE_*` or built `dist/` assets

## Before production

- [ ] Dependency / secret scan in CI
- [ ] Pen test or structured security review per `06_SECURITY_REQUIREMENTS.md`
- [ ] Separate prod DB and keys from QA
