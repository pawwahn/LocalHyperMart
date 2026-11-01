# Push notifications (FCM)

Order events already fan out **SMS + PUSH** from order-service to notification-service. PUSH uses templates in `notification-service` migrations; delivery is **stubbed by default** so local/QA behavior is unchanged.

## Backend order

1. **user-service** — `POST /api/v1/users/me/devices` (JWT), tokens in `device_tokens`; internal `GET /api/v1/internal/users/{userId}/device-tokens?appType=BUYER`; tokens removed on buyer account delete.
2. **notification-service** — When `channel=PUSH`, resolves app type from event code (`VENDOR_*` → `VENDOR`, else `BUYER`), loads tokens from user-service, sends via FCM HTTP v1 when enabled.
3. **Native apps** — After login, Capacitor Push Notifications registers token (native only; web is a no-op).

## Environment (notification-service)

| Variable | Default | Purpose |
|----------|---------|---------|
| `FCM_ENABLED` | `false` | Real FCM sends when `true` |
| `FCM_PROJECT_ID` | empty | Firebase project id |
| `FCM_CREDENTIALS_PATH` | empty | Service account JSON path |
| `HLM_USER_SERVICE_URI` | `http://localhost:8081` | Device token lookup |

With `FCM_ENABLED=false`, provider ref stays `dev-stub-*` (same as before).

## Buyer Android

- Dependency: `@capacitor/push-notifications`
- Permission: `POST_NOTIFICATIONS` in manifest
- Firebase: add `google-services.json` to the Android app when enabling FCM in Firebase console

## Later

Vendor, hub, and agent apps: same `registerNativePush` with `appType` `VENDOR`, `HUB`, or `DELIVERY`.
