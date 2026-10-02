# Load smoke tests (k6)

Requires [k6](https://k6.io/docs/get-started/installation/).

## Catalog browse (anonymous)

Set your pilot town UUID and optional gateway base URL:

```powershell
$env:TOWN_ID = "<town-uuid>"
$env:API_BASE = "http://localhost:8080"
k6 run scripts/load/k6-catalog-browse.js
```

## Authenticated login + catalog

Provide a buyer test account:

```powershell
$env:API_BASE = "http://localhost:8080"
$env:BUYER_PHONE = "9876543210"
$env:BUYER_PASSWORD = "your-test-password"
$env:TOWN_ID = "<town-uuid>"
k6 run scripts/load/k6-login-browse.js
```

Tune virtual users and duration via `K6_VUS` and `K6_DURATION` (see script defaults).
