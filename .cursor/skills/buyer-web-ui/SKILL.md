---
name: buyer-web-ui
description: >-
  Crafts KoyaKart buyer-web UI to production q-commerce quality (Blinkit / Instamart
  bar). Use when editing web/buyer-web screens, polish, or when the user wants
  non-generic, senior-designed buyer UI.
---

# Buyer web UI (KoyaKart)

## Anti-patterns (reads as “AI / Cursor UI”)

- Emoji as **chrome** (header, search, tabs, pins, alerts) — use `@/shared/ui/ChromeIcons` or `NavIcons`.
- **Poppins** or decorative **serif** ribbons for product copy.
- **Stagger fade-up** on every card/list item; reserve motion for sheets and one-off success states.
- **ALL CAPS** marketing pills, lime multi-gradient hero bands, heavy **800** weight on all labels.
- Product placeholders as large emoji — use `productInitial()` on tinted media (`productVisual` tint only).

## Stack

- Vite + React + TS, inline `styles` objects, `@hlm-theme` CSS variables, `@/shared/ui/*`.
- Typography: **Plus Jakarta Sans** (`tokens.ts` / `index.html`).
- Shell: `PortalShell` (`shopChrome` on home), bottom tab bar with `hlm-buyer-tab--active` indicator.

## Reference surfaces

- Home chrome + search: `PortalShell.tsx`, `ShopPage.tsx`
- Product tile: `ProductCard.tsx`, `StickyCartBar.tsx`
- Tokens / global: `shared/theme/tokens.ts`, `globalStyles.ts`

## Finish checklist

1. Phone ~390px: one column, `--touch-min` taps, safe area respected.
2. Theme tokens only — no raw `#fff` / `#0C831F` unless Razorpay or third-party requires it.
3. No `window.alert` / `confirm`; themed dialogs only (`ui-theme.mdc`).
4. Lists paginated (`scale-list-ux.mdc`).
5. Hierarchy: one display weight (700) for titles, 600 for buttons, muted meta at 0.68–0.72rem.
