# Open source license notices

Mobile and web apps include open-source software. Store policies (Google Play, etc.) expect accurate **Open source licenses** or **Third party notices** where required.

---

## Generate a license list (before each store release)

From each web app folder:

```powershell
cd LocalHyperMart\web\buyer-web
npx --yes license-checker --production --json > ..\..\docs\legal\generated\buyer-web-licenses.json
```

Repeat for `vendor-portal`, `delivery-portal`, `super-admin`.

For **Flutter** apps (when shipped):

```bash
flutter pub licenses > docs/legal/generated/flutter-licenses.txt
```

---

## In-app

Buyer **More → Privacy & data** links to **Open source** (`/legal/oss`), which summarizes that notices are available on request and points to this doc for maintainers.

---

## Compliance tip

- **Permissive** licenses (MIT, Apache-2.0): usually attribution in notices screen is enough.
- **Copyleft** (GPL): ensure you are not violating linking/distribution rules — escalate to counsel if GPL appears in mobile bundle.

Do not commit huge generated JSON unless you want them versioned; CI artifact is fine.
