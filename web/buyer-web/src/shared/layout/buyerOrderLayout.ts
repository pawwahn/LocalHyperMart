/** Shared full-width buyer order / order-detail layout (mobile + web). */
export const BUYER_ORDER_LAYOUT_CSS = `
.hlm-buyer-order {
  width: 100%;
  min-width: 0;
  max-width: var(--shell-max);
  display: grid;
  gap: 0.55rem;
  padding-bottom: 1.35rem;
  box-sizing: border-box;
}
.hlm-buyer-order-back {
  display: inline-flex;
  align-items: center;
  gap: 0.12rem;
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--accent, #0f766e);
  text-decoration: none;
  padding: 0.3rem 0.45rem 0.3rem 0.1rem;
  margin-left: -0.1rem;
  border-radius: 10px;
  width: fit-content;
}
.hlm-buyer-order-back-chev {
  font-size: 1.2rem;
  line-height: 1;
  margin-top: -1px;
}
.hlm-buyer-order-muted {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.45;
}
.hlm-buyer-order-error {
  margin: 0;
  color: #b91c1c;
  font-weight: 700;
  font-size: 0.88rem;
}
.hlm-buyer-order-stack {
  display: grid;
  gap: 0.65rem;
  width: 100%;
  min-width: 0;
}
@media (min-width: 720px) {
  .hlm-buyer-order-stack {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.75rem 1rem;
    align-items: start;
  }
  .hlm-buyer-order-span-full {
    grid-column: 1 / -1;
  }
  .hlm-buyer-order-col-aside {
    display: grid;
    gap: 0.65rem;
    align-content: start;
  }
  .hlm-buyer-order-col-main {
    display: grid;
    gap: 0.65rem;
    align-content: start;
  }
}
@media (min-width: 960px) {
  .hlm-buyer-order-stack {
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
    gap: 0.85rem 1.25rem;
  }
}
.hlm-buyer-order-hero {
  border-radius: 18px;
  padding: 0.85rem 0.95rem;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--accent-soft, #ecfdf5) 55%, #fff) 0%,
    var(--bg-elevated, #fff) 52%,
    var(--bg-elevated, #fff) 100%
  );
  border: 1px solid color-mix(in srgb, var(--accent, #0f766e) 18%, var(--border, #e5e7eb));
  box-shadow: var(--shadow-soft, 0 8px 24px rgba(15, 23, 42, 0.06));
  display: grid;
  gap: 0.5rem;
}
@media (min-width: 720px) {
  .hlm-buyer-order-hero {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.75rem 1.25rem;
    padding: 1rem 1.15rem;
    align-items: start;
  }
}
.hlm-buyer-order-hero-main {
  min-width: 0;
  display: grid;
  gap: 0.35rem;
}
.hlm-buyer-order-hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;
  flex-wrap: wrap;
}
.hlm-buyer-order-id {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--accent-hover, #0f766e);
}
.hlm-buyer-order-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: var(--text);
  line-height: 1.2;
}
@media (min-width: 720px) {
  .hlm-buyer-order-title {
    font-size: 1.2rem;
  }
}
.hlm-buyer-order-pill {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.22rem 0.5rem;
  border-radius: 999px;
  background: var(--bg-elevated, #fff);
  border: 1px solid color-mix(in srgb, var(--accent, #0f766e) 22%, transparent);
  color: var(--accent-hover, #065f46);
}
.hlm-buyer-order-lead {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 750;
  color: var(--text);
  line-height: 1.35;
}
@media (min-width: 720px) {
  .hlm-buyer-order-lead {
    font-size: 1rem;
  }
}
.hlm-buyer-order-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  font-size: 0.86rem;
  margin: 0;
}
.hlm-buyer-order-row strong {
  font-weight: 800;
  text-align: right;
}
.hlm-buyer-order-total-chip {
  display: grid;
  gap: 0.12rem;
  justify-items: start;
  padding: 0.55rem 0.7rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--border, #e5e7eb);
  min-width: 7.5rem;
}
@media (min-width: 720px) {
  .hlm-buyer-order-total-chip {
    justify-items: end;
    text-align: right;
  }
}
.hlm-buyer-order-total-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.hlm-buyer-order-total-amt {
  font-size: 1.2rem;
  font-weight: 900;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--text, #111827);
  line-height: 1.1;
}
.hlm-buyer-order-card {
  border-radius: 16px;
  padding: 0.85rem 0.95rem;
  background: var(--bg-elevated, #fff);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card, 0 6px 18px rgba(15, 23, 42, 0.05));
  display: grid;
  gap: 0.45rem;
}
.hlm-buyer-order-section-title {
  margin: 0 0 0.35rem;
  font-family: var(--font-display);
  font-size: 0.92rem;
  font-weight: 900;
  color: var(--text);
}
.hlm-buyer-order-lines {
  list-style: none;
  margin: 0;
  padding: 0.35rem 0.45rem;
  display: grid;
  gap: 0.35rem;
  border-radius: 12px;
  background: var(--bg, #f8fafc);
  border: 1px solid var(--border);
}
@media (min-width: 720px) {
  .hlm-buyer-order-lines:has(> li:nth-child(2)) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
  }
}
.hlm-buyer-order-line-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.1rem 0.6rem;
  font-size: 0.86rem;
  font-weight: 700;
  padding: 0.45rem 0.5rem;
  border-radius: 10px;
  background: var(--bg-elevated, #fff);
  border: 1px solid transparent;
}
.hlm-buyer-order-bill {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.2rem 1rem;
  max-width: none;
  font-size: 0.86rem;
  margin-top: 0.25rem;
}
@media (min-width: 720px) {
  .hlm-buyer-order-bill {
    max-width: 22rem;
  }
}
.hlm-buyer-order-bill strong {
  font-weight: 900;
}
.hlm-buyer-order-pay-note {
  margin: 0;
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1.35;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
}
.hlm-buyer-order-primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 0.9rem;
  border-radius: 12px;
  border: 0;
  background: var(--accent);
  color: #fff;
  font-weight: 800;
  font-size: 0.88rem;
  cursor: pointer;
}
.hlm-buyer-orders-page {
  width: 100%;
  min-width: 0;
  max-width: var(--shell-max);
  display: grid;
  gap: 0.65rem;
}
.hlm-buyer-orders-list {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 16px);
  background: var(--bg-elevated);
  overflow: hidden;
}
@media (min-width: 900px) {
  .hlm-buyer-orders-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(12rem, 16rem);
    gap: 0.65rem;
    align-items: center;
  }
  .hlm-buyer-orders-row {
    padding: 0.72rem 1rem !important;
  }
  .hlm-buyer-orders-row .hlm-buyer-orders-amount {
    font-size: 1.05rem !important;
  }
  .hlm-buyer-orders-row .hlm-buyer-orders-order-no {
    font-size: 0.88rem !important;
  }
  .hlm-buyer-orders-row .hlm-buyer-orders-meta {
    font-size: 0.82rem !important;
  }
}
.hlm-buyer-order-line-item--flex {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  column-gap: 0.65rem;
  row-gap: 0.2rem;
  grid-template-columns: unset;
}
.hlm-buyer-order-line-name {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 700;
  color: var(--text);
}
.hlm-buyer-order-line-price {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  color: var(--text-muted);
}
.hlm-buyer-order-line-result {
  width: 100%;
  flex-basis: 100%;
  font-size: 0.78rem;
  color: var(--accent-hover, #0f766e);
  font-weight: 700;
}
.hlm-buyer-order-report-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.5rem;
}
.hlm-buyer-order-view-report,
.hlm-buyer-order-download {
  flex: 1 1 8rem;
  padding: 0.6rem 0.9rem;
  border-radius: 12px;
  font-weight: 800;
  font-size: 0.84rem;
  cursor: pointer;
}
.hlm-buyer-order-view-report {
  border: 1px solid var(--accent, #0f766e);
  background: var(--bg-elevated, #fff);
  color: var(--accent-hover, #065f46);
}
.hlm-buyer-order-download {
  border: none;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 75%, #000), var(--accent, #0f766e));
  color: #fff;
}
.hlm-buyer-order-cancel {
  width: 100%;
  border: 1px solid #fecaca;
  background: #fff;
  color: #b91c1c;
  border-radius: 12px;
  padding: 0.7rem;
  font-weight: 800;
  font-size: 0.88rem;
  cursor: pointer;
}
@media (min-width: 720px) {
  .hlm-buyer-order-cancel {
    max-width: 22rem;
    justify-self: start;
  }
}
`;