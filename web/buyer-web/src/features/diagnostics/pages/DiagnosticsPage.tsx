import { parseBlockedSlotsByDate } from '@hlm-beauty';
import { PickerDateField } from '@hlm-dates';
import {
  defaultCollectionSlotsForBuyer,
  displayFastingPrepForTest,
  formatDiagnosticsSlotAmPmRange,
  isDiagnosticsSlotTemplateUuid,
} from '@hlm-diagnostics';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import { ApiError } from '@/shared/api/http';
import { listAddresses, type AddressDto } from '@/features/shop/api/shopApi';
import { CheckoutDismissedError, openGatewayCheckout, preloadGatewayCheckout } from '@/features/shop/lib/gatewayCheckout';
import { PaymentGatewayChoices, usePaymentGateways } from '@/features/shop/components/PaymentGatewayChoices';
import { confirmOnlinePaymentResilient } from '@/features/shop/api/shopApi';
import { resolveOnlineCheckout, tenDigitIndianPhone } from '@/features/shop/lib/loadOnlineCheckout';
import {
  fetchDiagnosticsLabDetail,
  fetchDiagnosticsLabs,
  createPatientProfile,
  fetchPatientProfiles,
  placeDiagnosticsOrder,
  retryDiagnosticsPayment,
  type DiagnosticsLab,
  type DiagnosticsLabDetail,
  type DiagnosticsPackage,
  type DiagnosticsSlot,
  type PatientProfile,
} from '../api/diagnosticsApi';

const PATIENT_RELATIONS = [
  'Self',
  'Spouse',
  'Son',
  'Daughter',
  'Mother',
  'Father',
  'Brother',
  'Sister',
  'Child',
  'Other',
] as const;

const PATIENT_GENDERS = ['Male', 'Female', 'Other'] as const;

const PACKAGE_META_FALLBACK = 'Health package · home collection included';

const POPULAR_TEST_SEARCHES = ['CBC', 'Thyroid', 'HbA1c', 'Lipid profile', 'Vitamin D', 'LFT'] as const;

const DIAG_HERO_IMG = '/diagnostics/hero-home-collection.jpg';

const HOME_COLLECTION_FLOW = [
  { title: 'Book online', detail: 'Choose lab, tests & time slot' },
  { title: 'Home visit', detail: 'Phlebotomist collects sample safely' },
  { title: 'Lab processing', detail: 'Partner lab runs your tests' },
  { title: 'Report ready', detail: 'View or download in Orders' },
] as const;

function packageSubtitleText(
  pkg: DiagnosticsPackage,
  testNameById: Map<string, string>,
): string {
  const text = pkg.description?.trim();
  if (text) return text;
  const names = (pkg.testIds ?? [])
    .map((id) => testNameById.get(id))
    .filter((n): n is string => Boolean(n));
  if (names.length > 0) {
    return `Includes: ${names.join(' · ')} · home collection included`;
  }
  return PACKAGE_META_FALLBACK;
}

/** Search packages by name, free-text description, or included test names. */
function packageSearchHaystack(pkg: DiagnosticsPackage, testNameById: Map<string, string>): string {
  const parts: string[] = [pkg.name, pkg.description ?? ''];
  for (const id of pkg.testIds ?? []) {
    const n = testNameById.get(id);
    if (n) parts.push(n);
  }
  return parts.join(' ').toLowerCase();
}

const SKIN = `
.hlm-diag-scope,
.hlm-diag-unavailable {
  --diag-brand: #0c2f2a;
  --diag-brand-hover: #081f1c;
  --diag-royal: #0f3d36;
  --diag-gold: #c6a75e;
  --diag-gold-soft: #f5efe2;
  --diag-gold-line: #e2d4bc;
  --diag-ink: #2f2b26;
  --diag-ink-mid: #524a42;
  --diag-muted: #787066;
  --diag-line: #e8e0d4;
  --diag-accent: #0f3d36;
  --diag-accent-deep: #0c2f2a;
  --diag-accent-bright: #155a50;
  --diag-accent-soft: #f6f3ed;
  --diag-accent-tint: #ede6d8;
  --diag-sky-soft: #faf7f2;
  --diag-page: #f7f3ec;
  --diag-panel-edge: #ebe3d8;
  --diag-cream: #fffdfa;
  --diag-on-dark: #fffef9;
  --diag-shadow: rgba(47, 43, 38, 0.12);
  --diag-shadow-soft: rgba(47, 43, 38, 0.06);
}
.hlm-diag-scope {
  color: var(--diag-ink);
  color-scheme: light;
}
.hlm-diag-root {
  display: grid;
  gap: 0.65rem;
  padding: 0.2rem 0.1rem 5.5rem;
  color: var(--diag-ink);
  color-scheme: light;
  background: linear-gradient(180deg, var(--diag-page) 0%, #faf6f0 100%);
  border-radius: 16px;
}
.hlm-diag-root--dock {
  padding-bottom: calc(5.5rem + var(--tabbar-h, 60px));
}
.hlm-diag-hero {
  position: relative;
  border-radius: 16px;
  padding: 0.75rem 0.85rem;
  overflow: hidden;
  color: var(--diag-ink);
  background: linear-gradient(145deg, var(--diag-cream) 0%, #f9f4eb 52%, #f3ece2 100%);
  border: 1px solid var(--diag-line);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 6px 22px var(--diag-shadow-soft);
}
.hlm-diag-hero::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--diag-gold), transparent);
  opacity: 0.85;
}
.hlm-diag-hero-grid {
  display: grid;
  gap: 0.65rem;
  align-items: center;
}
@media (min-width: 640px) {
  .hlm-diag-hero-grid {
    grid-template-columns: minmax(0, 1fr) minmax(9.75rem, 36%);
    gap: 0.75rem;
    align-items: center;
  }
}
.hlm-diag-hero-body {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 0.38rem;
  min-width: 0;
}
.hlm-diag-hero-visual {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 16 / 10;
  min-height: 7.75rem;
  max-height: 10.5rem;
  background: var(--diag-gold-soft);
  box-shadow:
    0 0 0 1px var(--diag-gold-line),
    0 10px 24px var(--diag-shadow-soft);
  border: 1px solid rgba(255, 255, 255, 0.95);
}
@media (min-width: 640px) {
  .hlm-diag-hero-visual {
    aspect-ratio: 4 / 3;
    min-height: 7.25rem;
    max-height: 9.25rem;
    max-width: 13.25rem;
    justify-self: end;
    width: 100%;
  }
}
@media (min-width: 960px) {
  .hlm-diag-hero-visual {
    max-width: 14.5rem;
    max-height: 10rem;
  }
}
.hlm-diag-hero-visual img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 55% 40%;
  display: block;
}
.hlm-diag-kicker {
  display: inline-flex;
  width: fit-content;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--diag-royal);
  background: rgba(255, 253, 248, 0.92);
  border: 1px solid var(--diag-gold-line);
}
.hlm-diag-hero h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 4.5vw, 1.85rem);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.12;
  text-wrap: balance;
  color: var(--diag-ink);
}
.hlm-diag-hero p {
  margin: 0;
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.48;
  color: var(--diag-muted);
  max-width: 26rem;
}
.hlm-diag-hero-trust {
  display: flex;
  flex-wrap: wrap;
  gap: 0.32rem;
  margin-top: 0.2rem;
}
.hlm-diag-hero-trust span {
  font-size: 0.58rem;
  font-weight: 800;
  padding: 0.22rem 0.48rem;
  border-radius: 999px;
  background: #fff;
  border: 1px solid var(--diag-line);
  color: var(--diag-ink-mid);
  letter-spacing: 0.02em;
}
.hlm-diag-hero-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.35rem;
}
.hlm-diag-hero-links a {
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--diag-royal);
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--diag-gold) 55%, transparent);
}
.hlm-diag-flow-compact {
  display: none;
}
.hlm-diag-flow-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.42rem;
  border-radius: 8px;
  font-size: 0.58rem;
  font-weight: 700;
  color: var(--diag-ink-mid);
  background: #fff;
  border: 1px solid var(--diag-line);
  line-height: 1.2;
}
.hlm-diag-flow-pill em {
  font-style: normal;
  font-weight: 900;
  color: var(--diag-accent);
  font-size: 0.6rem;
}
.hlm-diag-flow-card {
  flex: 0 0 auto;
  scroll-snap-align: start;
  width: min(8.25rem, 38vw);
  border-radius: 12px;
  padding: 0.4rem 0.45rem;
  background: rgba(255,255,255,0.72);
  border: 1px solid color-mix(in srgb, var(--diag-accent) 14%, var(--diag-line));
  display: grid;
  gap: 0.15rem;
}
.hlm-diag-flow-card strong {
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--diag-ink);
  line-height: 1.2;
}
.hlm-diag-flow-card span {
  font-size: 0.58rem;
  font-weight: 600;
  color: var(--diag-muted);
  line-height: 1.3;
}
.hlm-diag-flow-num {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 6px;
  display: grid;
  place-items: center;
  font-size: 0.58rem;
  font-weight: 900;
  color: var(--diag-accent);
  background: var(--diag-accent-soft);
  border: 1px solid var(--diag-accent-tint);
}
.hlm-diag-progress {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.15rem;
  padding: 0.45rem 0.5rem;
  border-radius: 12px;
  background: var(--diag-cream);
  border: 1px solid var(--diag-line);
  box-shadow: 0 2px 12px var(--diag-shadow-soft);
}
.hlm-diag-progress span {
  text-align: center;
  font-size: 0.58rem;
  font-weight: 800;
  color: #9aa5a3;
  line-height: 1.25;
  padding: 0.32rem 0.12rem 0.28rem;
  border-radius: 8px;
  position: relative;
  border-bottom: 2px solid transparent;
}
.hlm-diag-progress span em {
  display: inline-grid;
  place-items: center;
  font-style: normal;
  font-size: 0.58rem;
  width: 1.15rem;
  height: 1.15rem;
  margin: 0 auto 0.12rem;
  border-radius: 999px;
  background: var(--diag-gold-soft);
  color: var(--diag-muted);
  border: 1px solid var(--diag-line);
}
.hlm-diag-progress span.hlm-diag-progress--on {
  color: var(--diag-royal);
  background: linear-gradient(180deg, #fffefb 0%, var(--diag-gold-soft) 100%);
  border-bottom-color: var(--diag-gold);
}
.hlm-diag-progress span.hlm-diag-progress--on em {
  background: var(--diag-brand);
  color: var(--diag-on-dark);
  border: 1px solid var(--diag-gold);
}
.hlm-diag-progress span.hlm-diag-progress--done {
  color: var(--diag-royal);
  border-bottom-color: color-mix(in srgb, var(--diag-gold) 40%, transparent);
}
.hlm-diag-progress span.hlm-diag-progress--done em {
  background: var(--diag-brand);
  color: var(--diag-on-dark);
  border: 1px solid color-mix(in srgb, var(--diag-gold) 65%, transparent);
  font-size: 0.62rem;
}
.hlm-diag-layout {
  display: grid;
  gap: 0.65rem;
  align-items: start;
}
@media (min-width: 820px) {
  .hlm-diag-layout {
    grid-template-columns: minmax(0, 1fr) minmax(16rem, 19.5rem);
    gap: 0.85rem;
  }
}
.hlm-diag-main {
  display: grid;
  gap: 0.65rem;
  min-width: 0;
}
.hlm-diag-aside {
  min-width: 0;
}
@media (min-width: 900px) {
  .hlm-diag-aside {
    position: sticky;
    top: 0.35rem;
  }
}
.hlm-diag-summary {
  border-radius: 14px;
  padding: 0;
  overflow: hidden;
  background: var(--diag-cream);
  border: 1px solid var(--diag-panel-edge);
  box-shadow: 0 10px 28px var(--diag-shadow-soft);
  display: grid;
}
.hlm-diag-summary-banner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 0.7rem;
  background: linear-gradient(145deg, var(--diag-accent-soft) 0%, #faf6f0 58%, var(--diag-cream) 100%);
  color: var(--diag-ink);
  border-bottom: 1px solid var(--diag-line);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  font-family: var(--font-display);
  font-size: 0.86rem;
  font-weight: 900;
  letter-spacing: -0.02em;
}
.hlm-diag-summary-banner::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--diag-gold), transparent);
  opacity: 0.88;
}
.hlm-diag-summary-body {
  display: grid;
  gap: 0.48rem;
  padding: 0.6rem 0.65rem 0.65rem;
}
.hlm-diag-summary-icon {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: linear-gradient(165deg, var(--diag-royal) 0%, var(--diag-brand) 100%);
  color: var(--diag-on-dark);
  border: 1px solid color-mix(in srgb, var(--diag-gold) 38%, transparent);
  box-shadow: 0 2px 8px var(--diag-shadow-soft);
  flex-shrink: 0;
}
.hlm-diag-summary-items {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.hlm-diag-summary-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.32rem 0.38rem;
  border-radius: 10px;
  background: #faf7f2;
  border: 1px solid var(--diag-line);
}
.hlm-diag-summary-item-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}
.hlm-diag-summary-item-copy strong {
  font-size: 0.74rem;
  font-weight: 800;
  color: var(--diag-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.hlm-diag-summary-item-copy span {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--diag-ink-mid);
  flex-shrink: 0;
}
.hlm-diag-summary-remove {
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.15rem;
  border-radius: 6px;
}
.hlm-diag-summary-remove:hover {
  color: #b91c1c;
  background: #fef2f2;
}
.hlm-diag-summary-empty {
  margin: 0;
  padding: 0.5rem 0.15rem;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--diag-muted);
  line-height: 1.4;
}
.hlm-diag-summary-total {
  margin: 0.15rem 0 0;
  padding-top: 0.45rem;
  border-top: 1px dashed #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--diag-muted);
}
.hlm-diag-summary-total strong {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 900;
  color: var(--diag-ink);
  letter-spacing: -0.02em;
}
.hlm-diag-step {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 10px;
  background: linear-gradient(165deg, var(--diag-royal) 0%, var(--diag-brand) 100%);
  border: 1px solid color-mix(in srgb, var(--diag-gold) 45%, transparent);
  color: var(--diag-on-dark);
  font-size: 0.72rem;
  font-weight: 900;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px var(--diag-shadow-soft);
  font-family: var(--font-display);
}
.hlm-diag-panel-head-text {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
  flex: 1;
}
.hlm-diag-section-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.92rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: var(--diag-ink);
  line-height: 1.2;
}
.hlm-diag-section-sub {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--diag-muted);
  line-height: 1.35;
}
.hlm-diag-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 0.32rem;
  margin: -0.15rem 0 0.45rem;
}
.hlm-diag-quick button {
  border: 1px solid var(--diag-line);
  background: #fff;
  color: var(--diag-ink-mid);
  border-radius: 999px;
  padding: 0.28rem 0.55rem;
  font-size: 0.66rem;
  font-weight: 800;
  cursor: pointer;
}
.hlm-diag-quick button[aria-pressed="true"] {
  background: linear-gradient(180deg, var(--diag-royal), var(--diag-brand));
  color: var(--diag-on-dark);
  border-color: color-mix(in srgb, var(--diag-gold) 35%, var(--diag-brand));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--diag-gold) 30%, transparent);
}
.hlm-diag-unavailable {
  display: grid;
  gap: 0.65rem;
  padding: 0.25rem 0.1rem 1rem;
  border-radius: 22px;
  background: var(--diag-page);
}
.hlm-diag-unavailable-card {
  border-radius: 20px;
  padding: 1.1rem 0.95rem;
  background: linear-gradient(160deg, #0a2a26 0%, var(--diag-brand) 100%);
  color: var(--diag-on-dark);
  display: grid;
  gap: 0.45rem;
  box-shadow: 0 16px 36px var(--diag-shadow);
  border: 1px solid color-mix(in srgb, var(--diag-gold) 25%, transparent);
}
.hlm-diag-unavailable-card h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 900;
  letter-spacing: -0.03em;
}
.hlm-diag-unavailable-card p {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.45;
  opacity: 0.94;
}
.hlm-diag-panel {
  border-radius: 14px;
  padding: 0.6rem 0.65rem;
  background: var(--diag-cream);
  border: 1px solid var(--diag-panel-edge);
  box-shadow: 0 2px 14px var(--diag-shadow-soft);
}
.hlm-diag-panel-head {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin-bottom: 0.4rem;
}
.hlm-diag-panel-head-side {
  margin-left: auto;
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--diag-muted);
  text-align: right;
  line-height: 1.3;
  flex-shrink: 0;
  padding-top: 0.1rem;
}
.hlm-diag-lab-rail {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 0.35rem;
}
.hlm-diag-lab-card {
  width: 100%;
  min-width: 0;
  border: 1.5px solid var(--diag-line);
  border-radius: 12px;
  padding: 0.38rem 0.45rem;
  background: #fff;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}
.hlm-diag-lab-card:active { transform: scale(0.98); }
.hlm-diag-lab-card--on {
  border-color: color-mix(in srgb, var(--diag-gold) 40%, var(--diag-brand));
  background: linear-gradient(90deg, var(--diag-gold-soft) 0%, var(--diag-cream) 70%);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--diag-gold) 22%, transparent);
}
.hlm-diag-lab-radio {
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 999px;
  border: 2px solid #cbd5e1;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: #fff;
}
.hlm-diag-lab-card--on .hlm-diag-lab-radio {
  border-color: var(--diag-brand);
}
.hlm-diag-lab-radio-dot {
  width: 0.48rem;
  height: 0.48rem;
  border-radius: 999px;
  background: var(--diag-brand);
}
.hlm-diag-lab-card-copy {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.05rem;
}
.hlm-diag-lab-avatar {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 0.72rem;
  font-weight: 900;
  color: var(--diag-accent);
  background: var(--diag-accent-soft);
}
.hlm-diag-lab-card--on .hlm-diag-lab-avatar {
  background: linear-gradient(165deg, var(--diag-royal), var(--diag-brand));
  color: var(--diag-on-dark);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--diag-gold) 40%, transparent);
}
.hlm-diag-lab-name {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--diag-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hlm-diag-lab-meta {
  font-size: 0.58rem;
  font-weight: 600;
  color: var(--diag-muted);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hlm-diag-segment {
  display: flex;
  padding: 0.2rem;
  border-radius: 12px;
  background: var(--diag-gold-soft);
  border: 1px solid var(--diag-line);
  margin-bottom: 0.55rem;
}
.hlm-diag-segment button {
  flex: 1;
  border: none;
  background: transparent;
  border-radius: 10px;
  padding: 0.45rem 0.35rem;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--diag-muted);
  cursor: pointer;
  line-height: 1.2;
}
.hlm-diag-segment button[aria-selected="true"] {
  background: var(--diag-cream);
  color: var(--diag-royal);
  box-shadow: 0 2px 8px var(--diag-shadow-soft);
  border: 1px solid var(--diag-gold-line);
}
.hlm-diag-search {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0 0.65rem;
  min-height: 42px;
  border-radius: 12px;
  border: 1px solid var(--diag-line);
  background: #faf7f2;
  margin-bottom: 0.55rem;
}
.hlm-diag-search input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--diag-ink);
  min-width: 0;
}
.hlm-diag-search input:focus { outline: none; }
.hlm-diag-search input::placeholder { color: var(--diag-muted); font-weight: 600; }
.hlm-diag-search-icon {
  color: var(--diag-muted);
  font-size: 0.9rem;
  flex-shrink: 0;
}
.hlm-diag-catalog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.32rem;
  align-items: stretch;
}
@media (min-width: 520px) {
  .hlm-diag-catalog-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 359px) {
  .hlm-diag-catalog-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.hlm-diag-catalog-list {
  display: grid;
  gap: 0.28rem;
}
.hlm-diag-test-icon {
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 10px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: var(--diag-accent-soft);
  border: 1px solid var(--diag-accent-tint);
  color: var(--diag-brand);
}
.hlm-diag-test-cell {
  display: grid;
  grid-template-rows: minmax(1.35rem, auto) 0.72rem 1.85rem;
  gap: 0.06rem;
  padding: 0.38rem 0.42rem 0.34rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
  min-width: 0;
  height: 100%;
  min-height: 5.2rem;
  box-sizing: border-box;
  transition: border-color 140ms ease, background 140ms ease;
}
.hlm-diag-test-cell--on {
  border-color: color-mix(in srgb, var(--diag-gold) 35%, var(--diag-brand));
  background: linear-gradient(180deg, var(--diag-gold-soft) 0%, var(--diag-cream) 100%);
}
.hlm-diag-test-head {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  min-height: 0;
  overflow: hidden;
}
.hlm-diag-test-head-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.2rem;
}
.hlm-diag-test-prep-slot {
  height: 0.72rem;
  min-height: 0.72rem;
  max-height: 0.72rem;
  overflow: hidden;
  display: flex;
  align-items: center;
}
.hlm-diag-test-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.62rem 0.65rem;
  border-bottom: 1px solid var(--diag-line);
  background: #fff;
  transition: background 160ms ease;
}
.hlm-diag-test-row:last-child { border-bottom: none; }
.hlm-diag-test-copy { flex: 1; min-width: 0; }
.hlm-diag-test-name {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--diag-ink);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.hlm-diag-test-meta {
  margin: 0;
  font-size: 0.52rem;
  font-weight: 600;
  color: var(--diag-muted);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
.hlm-diag-prep {
  display: block;
  margin: 0;
  padding: 0.06rem 0.32rem;
  border-radius: 999px;
  font-size: 0.52rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  color: var(--diag-brand);
  background: var(--diag-accent-tint);
  border: 1px solid color-mix(in srgb, var(--diag-brand) 16%, transparent);
  line-height: 1.2;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hlm-diag-test-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  flex-shrink: 0;
}
.hlm-diag-test-action--stack {
  flex-direction: column;
  align-items: stretch;
  gap: 0.2rem;
}
.hlm-diag-test-cell .hlm-diag-add {
  width: 100%;
  height: 1.85rem;
  min-height: 1.85rem;
  max-height: 1.85rem;
  margin: 0;
  padding: 0 0.3rem;
  text-align: center;
  box-sizing: border-box;
  align-self: end;
}
.hlm-diag-test-price {
  font-family: var(--font-display);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: var(--diag-ink-mid);
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1.25;
  padding-top: 0.02rem;
}
.hlm-diag-add {
  min-width: 2.75rem;
  min-height: 32px;
  border: 1.5px solid var(--diag-brand);
  border-radius: 8px;
  padding: 0.22rem 0.35rem;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--diag-brand);
  background: #fff;
  cursor: pointer;
}
.hlm-diag-add--on {
  background: linear-gradient(180deg, var(--diag-royal), var(--diag-brand));
  color: var(--diag-on-dark);
  border-color: color-mix(in srgb, var(--diag-gold) 35%, var(--diag-brand));
}
.hlm-diag-field {
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  padding: 0.45rem 0.65rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: var(--diag-ink);
  font-weight: 600;
  font-size: 0.82rem;
  appearance: none;
  -webkit-appearance: none;
}
.hlm-diag-field:focus {
  outline: none;
  border-color: var(--diag-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--diag-accent) 18%, transparent);
}
select.hlm-diag-field {
  padding-right: 1.85rem;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%230c2f2a' d='M3 4.5 6 7.5 9 4.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.55rem center;
}
input[type='number'].hlm-diag-field {
  min-width: 4.75rem;
  padding-right: 0.5rem;
  appearance: textfield;
  -moz-appearance: textfield;
}
input[type='number'].hlm-diag-field::-webkit-outer-spin-button,
input[type='number'].hlm-diag-field::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.hlm-diag-patient-line {
  display: grid;
  grid-template-columns: minmax(8rem, 1.6fr) minmax(6.25rem, 0.85fr) minmax(6.25rem, 0.8fr) 5rem;
  gap: 0.35rem;
  align-items: stretch;
}
.hlm-diag-patient-line .hlm-diag-field {
  min-width: 0;
}
@media (max-width: 420px) {
  .hlm-diag-patient-line {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 5rem;
  }
  .hlm-diag-patient-line .hlm-diag-patient-name {
    grid-column: 1 / -1;
  }
}
.hlm-diag-chip {
  border: 1px solid var(--diag-line);
  background: #fff;
  color: var(--diag-ink-mid);
  border-radius: 999px;
  padding: 0.38rem 0.72rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}
.hlm-diag-chip--on {
  border-color: color-mix(in srgb, var(--diag-gold) 40%, var(--diag-brand));
  background: linear-gradient(180deg, var(--diag-royal), var(--diag-brand));
  color: var(--diag-on-dark);
  font-weight: 800;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--diag-gold) 28%, transparent);
}
.hlm-diag-slot-scroll {
  max-height: 9.5rem;
  overflow-y: auto;
  padding-right: 0.15rem;
}
.hlm-diag-subhead {
  margin: 0.35rem 0 0.35rem;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--diag-muted);
}
.hlm-diag-fee-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
  font-size: 0.78rem;
}
.hlm-diag-fee-list li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  color: #475569;
}
.hlm-diag-fee-list li strong {
  color: var(--diag-ink);
  font-weight: 800;
}
.hlm-diag-fee-total {
  margin-top: 0.25rem;
  padding-top: 0.45rem;
  border-top: 1px dashed #e2e8f0;
  font-size: 0.88rem !important;
}
.hlm-diag-primary {
  margin-top: 0.65rem;
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 0.78rem 0.85rem;
  font-weight: 800;
  font-size: 0.86rem;
  cursor: pointer;
  background: linear-gradient(180deg, var(--diag-royal) 0%, var(--diag-brand) 100%);
  color: var(--diag-on-dark);
  box-shadow:
    0 8px 22px var(--diag-shadow),
    inset 0 1px 0 color-mix(in srgb, var(--diag-gold) 35%, transparent);
  letter-spacing: 0.01em;
}
.hlm-diag-primary:not(:disabled):active {
  background: linear-gradient(180deg, var(--diag-brand-hover), #0a2522);
}
.hlm-diag-summary-cta {
  margin-top: 0.1rem;
}
.hlm-diag-pay-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.hlm-diag-pay-opt {
  flex: 1 1 9rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.5rem 0.55rem;
  background: #fff;
  text-align: left;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--diag-ink-mid);
  line-height: 1.25;
}
.hlm-diag-pay-opt--on {
  border-color: color-mix(in srgb, var(--diag-gold) 45%, var(--diag-brand));
  background: var(--diag-gold-soft);
  color: var(--diag-royal);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--diag-gold) 25%, transparent);
}
.hlm-diag-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}
.hlm-diag-dock {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--tabbar-h, 60px) + env(safe-area-inset-bottom, 0px));
  width: 100%;
  max-width: var(--shell-max);
  z-index: 45;
  padding: 0.35rem var(--shell-pad) 0.45rem;
  box-sizing: border-box;
  pointer-events: none;
}
.hlm-diag-dock-inner {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.55rem 0.45rem 0.65rem;
  border-radius: 16px;
  background: var(--diag-cream);
  color: var(--diag-ink);
  box-shadow: 0 12px 32px var(--diag-shadow), 0 0 0 1px var(--diag-line);
}
.hlm-diag-dock-copy {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.05rem;
}
.hlm-diag-dock-copy strong {
  font-family: var(--font-display);
  font-size: 0.92rem;
  letter-spacing: -0.02em;
}
.hlm-diag-dock-copy span {
  font-size: 0.64rem;
  font-weight: 600;
  color: var(--diag-muted);
}
.hlm-diag-dock-btn {
  border: none;
  border-radius: 12px;
  padding: 0.55rem 0.85rem;
  font-size: 0.75rem;
  font-weight: 800;
  background: linear-gradient(180deg, var(--diag-royal), var(--diag-brand));
  color: var(--diag-on-dark);
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 6px 16px var(--diag-shadow);
}
.hlm-diag-date-wrap .hlm-picker-date-input {
  min-height: 44px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
  padding: 0.45rem 2.5rem 0.45rem 0.65rem;
  font-weight: 600;
}
.hlm-diag-date-wrap .hlm-picker-date-icon {
  background: var(--diag-accent-soft);
  border-radius: 10px;
  color: var(--diag-brand);
}
.hlm-diag-catalog-empty {
  margin: 0;
  padding: 0.75rem 0.25rem;
  font-size: 0.78rem;
  color: var(--diag-muted);
  line-height: 1.45;
  text-align: center;
}
.hlm-diag-error {
  margin: 0;
  padding: 0.55rem 0.65rem;
  border-radius: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 0.78rem;
  font-weight: 700;
}
`;

function money(value: number): string {
  return `₹${Number(value || 0).toFixed(0)}`;
}

function istDate(when: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(when);
}

function slotInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00+05:30`).toISOString();
}

/** Normalize template start to HH:mm for comparing API slots, fallbacks, and branch blocks. */
function slotStartTimeKey(slot: Pick<DiagnosticsSlot, 'start'>): string {
  const raw = slot.start?.trim() ?? '';
  if (!raw) return '';
  if (raw.includes('T')) {
    const afterT = raw.slice(raw.indexOf('T') + 1);
    return afterT.slice(0, 5);
  }
  return raw.slice(0, 5);
}

function slotEndTimeKey(slot: Pick<DiagnosticsSlot, 'end'>): string {
  const raw = slot.end?.trim() ?? '';
  if (!raw) return '';
  if (raw.includes('T')) {
    const afterT = raw.slice(raw.indexOf('T') + 1);
    return afterT.slice(0, 5);
  }
  return raw.slice(0, 5);
}

function clockMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

/** IST calendar date + delta days (for windows that cross midnight). */
function addDaysIst(ymd: string, delta: number): string {
  const t = new Date(`${ymd}T12:00:00+05:30`).getTime() + delta * 86_400_000;
  return istDate(new Date(t));
}

/** End instant of the collection window in ISO (for past-window check). */
function slotWindowEndIso(pickupDateYmd: string, slot: DiagnosticsSlot): string | null {
  const sk = slotStartTimeKey(slot);
  const ek = slotEndTimeKey(slot);
  if (!sk || !ek) return null;
  let endDay = pickupDateYmd;
  if (clockMinutes(ek) <= clockMinutes(sk)) {
    endDay = addDaysIst(pickupDateYmd, 1);
  }
  return slotInstant(endDay, ek);
}

/** Chip text: show staff label only when it adds info beyond the clock window. */
function displayDiagnosticsSlotChipLabel(slot: DiagnosticsSlot): string {
  const range = formatDiagnosticsSlotAmPmRange(slotStartTimeKey(slot), slotEndTimeKey(slot));
  const raw = slot.label?.trim() ?? '';
  if (!raw || raw === range) return range;
  return `${range} · ${raw}`;
}

function addressLabel(item: AddressDto): string {
  const label = item.label?.trim() || 'Address';
  const line = item.line1?.trim();
  return line ? `${label} · ${line}` : label;
}

type CatalogTab = 'tests' | 'packages';

function catalogTestKey(test: { id: string; code?: string | null; name: string }): string {
  const code = test.code?.trim();
  if (code) return code.toUpperCase();
  return `name:${test.name.trim().toLowerCase()}`;
}

function uniqueTests(tests: DiagnosticsLabDetail['tests'] | undefined) {
  const byKey = new Map<string, NonNullable<DiagnosticsLabDetail['tests']>[number]>();
  for (const row of tests ?? []) {
    const key = catalogTestKey(row);
    const prev = byKey.get(key);
    if (!prev || Number(row.price) > Number(prev.price)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

function labInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function DiagTestTubeIcon() {
  return (
    <span className="hlm-diag-test-icon" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 3h6v4l4 10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3l4-10V3Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path d="M9 7h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M10 13h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function DiagnosticsPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const {
    townId,
    townLabel,
    hasTown,
    diagnosticsEnabled,
    diagnosticsReady,
    diagnosticsPlatformFeeFlat,
    diagnosticsCodEnabled,
    diagnosticsCodSurchargeAmount,
    upiEnabled,
  } = useTown();

  const [labs, setLabs] = useState<DiagnosticsLab[]>([]);
  const [labId, setLabId] = useState('');
  const [detail, setDetail] = useState<DiagnosticsLabDetail | null>(null);
  const [addresses, setAddresses] = useState<AddressDto[]>([]);
  const [addressId, setAddressId] = useState('');
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [patientId, setPatientId] = useState('');
  const [patientFormOpen, setPatientFormOpen] = useState(false);
  const [patientSaving, setPatientSaving] = useState(false);
  const [patientForm, setPatientForm] = useState({
    displayName: '',
    relation: 'Self',
    gender: 'Male',
    ageYears: '',
  });
  const [referenceType, setReferenceType] = useState<'SELF' | 'DOCTOR'>('SELF');
  const [doctorName, setDoctorName] = useState('');
  const [pickupDate, setPickupDate] = useState(() => istDate(new Date()));
  const [slotKey, setSlotKey] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [packageCart, setPackageCart] = useState<Record<string, number>>({});
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('tests');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [bookingFocus, setBookingFocus] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI'>(upiEnabled ? 'UPI' : 'CASH');
  const { options: paymentGateways, gateway: paymentGateway, setGateway: setPaymentGateway } = usePaymentGateways(token);
  const [disclaimerOk, setDisclaimerOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Booking…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (paymentMethod !== 'UPI') return;
    preloadGatewayCheckout(paymentGateway);
  }, [paymentMethod, paymentGateway]);

  useEffect(() => {
    if (!token || !townId || !diagnosticsReady) return;
    if (!diagnosticsEnabled) {
      setLabs([]);
      return;
    }
    let cancelled = false;
    void Promise.allSettled([fetchDiagnosticsLabs(token, townId), listAddresses(token), fetchPatientProfiles(token)]).then(
      (results) => {
        if (cancelled) return;
        const [labR, addrR, patientR] = results;
        if (labR.status === 'fulfilled') {
          const labRows = labR.value ?? [];
          setLabs(labRows);
          setLabId((prev) => (labRows.some((l) => l.vendorId === prev) ? prev : labRows[0]?.vendorId ?? ''));
          setError(null);
        } else {
          const err = labR.reason;
          setLabs([]);
          setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load diagnostics labs');
        }
        if (addrR.status === 'fulfilled') {
          const townAddr = (addrR.value ?? []).filter((a) => a.townId === townId);
          setAddresses(townAddr);
          setAddressId((prev) => (townAddr.some((a) => a.id === prev) ? prev : townAddr[0]?.id ?? ''));
        } else {
          setAddresses([]);
          setAddressId('');
        }
        if (patientR.status === 'fulfilled') {
          const patientRows = patientR.value ?? [];
          setPatients(patientRows);
          const self = patientRows.find((p) => p.isSelf);
          setPatientId((prev) => (patientRows.some((p) => p.id === prev) ? prev : self?.id ?? patientRows[0]?.id ?? ''));
        } else {
          setPatients([]);
          setPatientId('');
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token, townId, diagnosticsEnabled, diagnosticsReady]);

  useEffect(() => {
    if (!token || !townId || !labId || !addressId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void fetchDiagnosticsLabDetail(token, labId, townId, addressId)
      .then((row) => {
        if (!cancelled) {
          setDetail(row);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load lab menu');
      });
    return () => {
      cancelled = true;
    };
  }, [token, townId, labId, addressId]);

  const catalogTests = useMemo(() => uniqueTests(detail?.tests), [detail?.tests]);
  const catalogPackages = useMemo(() => detail?.packages ?? [], [detail?.packages]);
  /** Use full lab menu for id→name: `uniqueTests` may drop duplicate codes with different ids. */
  const testNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of detail?.tests ?? []) {
      if (t.id) map.set(t.id, t.name);
    }
    return map;
  }, [detail?.tests]);
  const selectedTestCount = useMemo(
    () => Object.entries(cart).reduce((sum, [, qty]) => sum + (qty > 0 ? qty : 0), 0),
    [cart],
  );
  const selectedPackageCount = useMemo(
    () => Object.entries(packageCart).reduce((sum, [, qty]) => sum + (qty > 0 ? qty : 0), 0),
    [packageCart],
  );

  const cartLineItems = useMemo(() => {
    const rows: { key: string; kind: 'test' | 'package'; id: string; name: string; price: number }[] = [];
    for (const test of catalogTests) {
      const qty = cart[test.id] ?? 0;
      if (qty > 0) {
        rows.push({
          key: `t:${test.id}`,
          kind: 'test',
          id: test.id,
          name: test.name,
          price: Number(test.price || 0) * qty,
        });
      }
    }
    for (const pkg of catalogPackages) {
      const qty = packageCart[pkg.id] ?? 0;
      if (qty > 0) {
        rows.push({
          key: `p:${pkg.id}`,
          kind: 'package',
          id: pkg.id,
          name: pkg.name,
          price: Number(pkg.price || 0) * qty,
        });
      }
    }
    return rows;
  }, [cart, packageCart, catalogTests, catalogPackages]);

  const catalogQuery = catalogSearch.trim().toLowerCase();
  const filteredTests = useMemo(() => {
    if (!catalogQuery) return catalogTests;
    return catalogTests.filter(
      (t) =>
        t.name.toLowerCase().includes(catalogQuery) ||
        (t.code?.toLowerCase().includes(catalogQuery) ?? false) ||
        (t.fastingNote?.toLowerCase().includes(catalogQuery) ?? false),
    );
  }, [catalogTests, catalogQuery]);
  const filteredPackages = useMemo(() => {
    if (!catalogQuery) return catalogPackages;
    return catalogPackages.filter((p) => packageSearchHaystack(p, testNameById).includes(catalogQuery));
  }, [catalogPackages, catalogQuery, testNameById]);
  useEffect(() => {
    if (catalogTests.length === 0 && catalogPackages.length > 0) {
      setCatalogTab('packages');
    }
  }, [labId, catalogTests.length, catalogPackages.length]);

  const slotsForDay = useMemo((): DiagnosticsSlot[] => {
    const templateList = detail?.slots ?? [];
    // Branch templates use clock times (e.g. "07:00"), not instants — do not filter by pickupDate or everything drops out.
    const base: DiagnosticsSlot[] =
      templateList.length > 0 ? templateList : detail?.eligible !== false ? defaultCollectionSlotsForBuyer() : [];
    const blockedMap = parseBlockedSlotsByDate(detail?.blockedSlotsByDate);
    const blockedIds = new Set(
      (blockedMap[pickupDate] ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
    const blockedStartKeys = new Set<string>();
    for (const id of blockedIds) {
      const row = templateList.find((s) => s.slotId === id);
      if (row) {
        const key = slotStartTimeKey(row);
        if (key) blockedStartKeys.add(key);
      }
    }
    const todayIstStr = istDate(new Date());
    const nowMs = Date.now();
    return base.filter((s) => {
      if (blockedIds.has(s.slotId)) return false;
      const key = slotStartTimeKey(s);
      if (key && blockedStartKeys.has(key)) return false;
      if (pickupDate === todayIstStr) {
        const endIso = slotWindowEndIso(pickupDate, s);
        if (endIso) {
          const endMs = new Date(endIso).getTime();
          if (Number.isFinite(endMs) && endMs <= nowMs) return false;
        }
      }
      return true;
    });
  }, [detail, pickupDate]);

  useEffect(() => {
    setSlotKey((prev) => {
      if (slotsForDay.some((s) => s.slotId === prev)) return prev;
      return slotsForDay[0]?.slotId ?? '';
    });
  }, [slotsForDay]);

  /** Must match `slotsForDay` (includes buyer fallback IDs not in `detail.slots`). */
  const selectedSlot = useMemo(() => {
    return slotsForDay.find((s) => s.slotId === slotKey) ?? null;
  }, [slotsForDay, slotKey]);

  const testsSubtotal = useMemo(() => {
    let sum = 0;
    if (detail?.tests) {
      sum += detail.tests.reduce((acc, test) => {
        const qty = cart[test.id] ?? 0;
        return acc + qty * Number(test.price || 0);
      }, 0);
    }
    if (detail?.packages) {
      sum += detail.packages.reduce((acc, pkg) => {
        const qty = packageCart[pkg.id] ?? 0;
        return acc + qty * Number(pkg.price || 0);
      }, 0);
    }
    return sum;
  }, [cart, packageCart, detail]);

  const homeFee = Number(detail?.homeCollectionFee ?? labs.find((l) => l.vendorId === labId)?.homeCollectionFee ?? 0);
  const platformFee = testsSubtotal > 0 ? Number(diagnosticsPlatformFeeFlat || 0) : 0;
  const codFee =
    paymentMethod === 'CASH' && diagnosticsCodEnabled && testsSubtotal > 0
      ? Number(diagnosticsCodSurchargeAmount || 0)
      : 0;
  const checkoutTotal = testsSubtotal + homeFee + platformFee + codFee;
  const testCount =
    Object.values(cart).reduce((a, b) => a + b, 0) + Object.values(packageCart).reduce((a, b) => a + b, 0);

  async function savePatientProfile() {
    if (!token) return;
    const age = Number(patientForm.ageYears);
    if (!patientForm.displayName.trim() || !Number.isFinite(age) || age < 0) {
      setError('Enter patient name and age');
      return;
    }
    setPatientSaving(true);
    setError(null);
    try {
      const created = await createPatientProfile(token, {
        displayName: patientForm.displayName.trim(),
        relation: patientForm.relation.trim() || 'Self',
        gender: patientForm.gender,
        ageYears: age,
      });
      setPatients((prev) => [...prev, created]);
      setPatientId(created.id);
      setPatientFormOpen(false);
      setPatientForm({ displayName: '', relation: 'Self', gender: 'Male', ageYears: '' });
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save patient');
    } finally {
      setPatientSaving(false);
    }
  }

  function toggleTest(id: string) {
    setCart((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  }

  function togglePackage(id: string) {
    setPackageCart((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  }

  function bookingBlockReason(): string | null {
    if (!token) return 'Sign in to book home collection.';
    if (!townId || !labId) return 'Select a lab to continue.';
    if (!patientId) return 'Save or select who is giving the sample.';
    if (!addressId) return 'Add a collection address for this town.';
    if (testCount === 0) return 'Add at least one test or package.';
    if (!selectedSlot) return 'Pick a collection time for your date.';
    if (detail?.eligible === false) {
      return detail.ineligibleReason || 'Address is outside lab collection area.';
    }
    if (referenceType === 'DOCTOR' && !doctorName.trim()) return 'Enter referring doctor name.';
    if (!disclaimerOk) return 'Tick the confirmation box to book.';
    return null;
  }

  async function confirmBooking() {
    const block = bookingBlockReason();
    if (block) {
      setError(block);
      document.getElementById('hlm-diag-book-cta')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const testIds = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id]) => id);
    const packageIds = Object.entries(packageCart)
      .filter(([, qty]) => qty > 0)
      .map(([id]) => id);
    if (!selectedSlot) return;
    const slotStart =
      selectedSlot.start.includes('T') ? selectedSlot.start : slotInstant(pickupDate, selectedSlot.start.slice(0, 5));
    const slotEnd =
      selectedSlot.end.includes('T') ? selectedSlot.end : slotInstant(pickupDate, selectedSlot.end.slice(0, 5));

    setBusy(true);
    setBusyLabel('Booking…');
    setError(null);
    try {
      const order = await placeDiagnosticsOrder(token, {
        townId,
        vendorId: labId,
        addressId,
        patientProfileId: patientId,
        referenceType,
        referringDoctorName: referenceType === 'DOCTOR' ? doctorName.trim() : undefined,
        /** Backend maps UPI/ONLINE to online checkout; COD/CASH for pay at doorstep. */
        paymentMethod: paymentMethod === 'UPI' ? 'ONLINE' : 'COD',
        paymentGateway: paymentMethod === 'UPI' ? paymentGateway : undefined,
        contactPhone: tenDigitIndianPhone(session?.phone) ?? undefined,
        slotStart,
        slotEnd,
        slotTemplateId: isDiagnosticsSlotTemplateUuid(selectedSlot.slotId) ? selectedSlot.slotId : undefined,
        testIds,
        packageIds: packageIds.length ? packageIds : undefined,
        disclaimerAcknowledged: true,
      });
      if (paymentMethod === 'UPI') {
        setBusyLabel('Opening payment…');
        const poll = { intervalMs: 200, timeoutMs: 8_000 };
        let paymentRef: { paymentId?: string; checkout?: unknown } = {
          paymentId: order.payment?.paymentId,
          checkout: order.payment?.checkout,
        };
        if (!paymentRef.paymentId) {
          const r = await retryDiagnosticsPayment(token, order.id, paymentGateway);
          paymentRef = { paymentId: r.paymentId, checkout: r.checkout };
        }
        const checkout = await resolveOnlineCheckout({
          token,
          payment: paymentRef,
          paymentGateway,
          poll,
          retry: async () => {
            const r = await retryDiagnosticsPayment(token, order.id, paymentGateway);
            return { paymentId: r.paymentId, checkout: r.checkout };
          },
        });
        const paid = await openGatewayCheckout(checkout, { contact: session?.phone });
        await confirmOnlinePaymentResilient(token, paid);
      }
      navigate(`/diagnostics/orders/${order.id}`);
    } catch (err) {
      if (!(err instanceof CheckoutDismissedError)) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Booking failed');
      }
    } finally {
      setBusy(false);
    }
  }

  const showDock = testCount > 0;
  const bookBlock = bookingBlockReason();

  const bookingJourney = useMemo(() => {
    const labDone = Boolean(labId);
    const testsDone = testCount > 0;
    const visitDone = Boolean(patientId && addressId && selectedSlot && detail?.eligible !== false);
    const payDone = visitDone && disclaimerOk && testCount > 0;
    return [
      { id: 'lab', label: 'Choose lab', done: labDone, current: !labDone },
      { id: 'tests', label: 'Select tests', done: testsDone, current: labDone && !testsDone },
      { id: 'visit', label: 'Patient details', done: Boolean(patientId), current: testsDone && !patientId },
      {
        id: 'pay',
        label: 'Schedule & pay',
        done: payDone,
        current: Boolean(patientId) && !payDone,
      },
    ] as const;
  }, [labId, testCount, patientId, addressId, selectedSlot, detail?.eligible, disclaimerOk]);

  if (!hasTown) {
    return (
      <PortalShell title="Diagnostics" showStickyCart={false}>
        <p style={{ margin: 0 }}>Choose your town to book home sample collection.</p>
      </PortalShell>
    );
  }

  if (diagnosticsReady && !diagnosticsEnabled) {
    return (
      <PortalShell title="Diagnostics" showStickyCart={false}>
        <style>{SKIN}</style>
        <div className="hlm-diag-unavailable">
          <div className="hlm-diag-unavailable-card">
            <span className="hlm-diag-kicker" style={{ background: 'rgba(255,255,255,0.16)' }}>
              Koya Diagnostics
            </span>
            <h2>Not live in {townLabel} yet</h2>
            <p>
              Home blood &amp; lab sample collection will show here once a local lab partner is onboarded. You can still
              shop groceries and track other service orders.
            </p>
            <div className="hlm-diag-flow" aria-label="What diagnostics will offer">
              {HOME_COLLECTION_FLOW.map((row, i) => (
                <div key={row.title} className="hlm-diag-flow-card" style={{ background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)' }}>
                  <span className="hlm-diag-flow-num" style={{ background: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.35)', color: '#fff' }}>
                    {i + 1}
                  </span>
                  <strong style={{ color: '#fff' }}>{row.title}</strong>
                  <span style={{ color: 'rgba(255,255,255,0.9)' }}>{row.detail}</span>
                </div>
              ))}
            </div>
          </div>
          <Link to="/shop" style={styles.link}>
            Continue shopping →
          </Link>
        </div>
      </PortalShell>
    );
  }
  const bookingSectionId = 'hlm-diag-booking';

  function scrollToBooking() {
    setBookingFocus(true);
    document.getElementById(bookingSectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scrollToSchedule() {
    document.getElementById('hlm-diag-schedule')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <PortalShell hideTitle showDeliveryBanner={false} showStickyCart={false}>
      <div className="hlm-diag-scope">
      <style>{SKIN}</style>
      <div className={showDock ? 'hlm-diag-root hlm-diag-root--dock' : 'hlm-diag-root'}>
        <header className="hlm-diag-hero">
          <div className="hlm-diag-hero-grid">
            <div className="hlm-diag-hero-body">
              <span className="hlm-diag-kicker">
                {hasTown ? `${townLabel} · Koya Diagnostics` : 'Koya Diagnostics'}
              </span>
              <h1>Book lab tests from home</h1>
              <p>
                CBC, thyroid, diabetes panels &amp; more — book tests, sample pickup at home by a trained phlebotomist,
                and get your reports online.
              </p>
              <div className="hlm-diag-hero-links">
                <Link to="/orders">Lab orders &amp; reports →</Link>
              </div>
            </div>
            <div className="hlm-diag-hero-visual">
              <img
                src={DIAG_HERO_IMG}
                alt="Phlebotomist collecting a blood sample at home"
                width={520}
                height={390}
                decoding="async"
                fetchPriority="high"
                sizes="(min-width: 960px) 232px, (min-width: 640px) 212px, 100vw"
              />
            </div>
          </div>
        </header>

        <div className="hlm-diag-progress" aria-label="Booking progress">
          {bookingJourney.map((step, index) => (
            <span
              key={step.id}
              className={
                step.current
                  ? 'hlm-diag-progress--on'
                  : step.done
                    ? 'hlm-diag-progress--done'
                    : undefined
              }
            >
              <em aria-hidden>{step.done && !step.current ? '✓' : index + 1}</em>
              {step.label}
            </span>
          ))}
        </div>

        <div className="hlm-diag-flow-compact" aria-label="How home collection works">
          {HOME_COLLECTION_FLOW.map((row, index) => (
            <span key={row.title} className="hlm-diag-flow-pill" title={row.detail}>
              <em>{index + 1}</em> {row.title}
            </span>
          ))}
        </div>

        {error ? <p className="hlm-diag-error">{error}</p> : null}

        <div className="hlm-diag-layout">
          <div className="hlm-diag-main">
        <section className="hlm-diag-panel" aria-label="Select lab">
          <div className="hlm-diag-panel-head">
            <span className="hlm-diag-step" aria-hidden>
              1
            </span>
            <div className="hlm-diag-panel-head-text">
              <p className="hlm-diag-section-title">Select a lab</p>
              <p className="hlm-diag-section-sub">
                {labs.length
                  ? `${labs.length} partner lab${labs.length === 1 ? '' : 's'} in ${townLabel}`
                  : `Partner labs coming soon in ${townLabel}`}
              </p>
            </div>
            <span className="hlm-diag-panel-head-side">{labId ? 'Selected' : 'Pick one'}</span>
          </div>
          {labs.length > 0 ? (
            <div className="hlm-diag-lab-rail hlm-hide-scrollbar">
              {labs.map((lab) => (
                <button
                  key={lab.vendorId}
                  type="button"
                  className={lab.vendorId === labId ? 'hlm-diag-lab-card hlm-diag-lab-card--on' : 'hlm-diag-lab-card'}
                  onClick={() => {
                    setLabId(lab.vendorId);
                    setCart({});
                    setPackageCart({});
                    setSlotKey('');
                    setCatalogTab('tests');
                    setCatalogSearch('');
                  }}
                >
                  <span className="hlm-diag-lab-radio" aria-hidden>
                    {lab.vendorId === labId ? <span className="hlm-diag-lab-radio-dot" /> : null}
                  </span>
                  <span className="hlm-diag-lab-avatar">{labInitials(lab.businessName)}</span>
                  <span className="hlm-diag-lab-card-copy">
                    <span className="hlm-diag-lab-name">{lab.businessName}</span>
                    <span className="hlm-diag-lab-meta">
                      {lab.testCount ? `${lab.testCount}+ tests · ` : ''}
                      Home pickup {money(Number(lab.homeCollectionFee ?? 0))}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="hlm-diag-catalog-empty">No labs listed yet for {townLabel}.</p>
          )}
        </section>

        <section className="hlm-diag-panel" aria-label="Tests and packages">
          <div className="hlm-diag-panel-head">
            <span className="hlm-diag-step" aria-hidden>
              2
            </span>
            <div className="hlm-diag-panel-head-text">
              <p className="hlm-diag-section-title">Choose tests &amp; packages</p>
              <p className="hlm-diag-section-sub">Fasting &amp; prep notes appear on each test</p>
            </div>
            <span className="hlm-diag-panel-head-side">
              {selectedTestCount + selectedPackageCount > 0
                ? `${selectedTestCount + selectedPackageCount} selected`
                : 'Add tests'}
            </span>
          </div>

          {catalogTab === 'tests' && catalogTests.length > 0 ? (
            <div className="hlm-diag-quick" role="group" aria-label="Popular test searches">
              <button
                type="button"
                aria-pressed={!catalogSearch.trim()}
                onClick={() => setCatalogSearch('')}
              >
                All
              </button>
              {POPULAR_TEST_SEARCHES.map((term) => {
                const active = catalogSearch.trim().toLowerCase() === term.toLowerCase();
                return (
                  <button
                    key={term}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCatalogSearch(active ? '' : term)}
                  >
                    {term}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="hlm-diag-segment" role="tablist" aria-label="Tests or packages">
            <button
              type="button"
              role="tab"
              aria-selected={catalogTab === 'tests'}
              disabled={catalogTests.length === 0}
              onClick={() => setCatalogTab('tests')}
            >
              Tests ({catalogTests.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={catalogTab === 'packages'}
              disabled={catalogPackages.length === 0}
              onClick={() => setCatalogTab('packages')}
            >
              Packages ({catalogPackages.length})
            </button>
          </div>

          <label className="hlm-diag-search">
            <span aria-hidden className="hlm-diag-search-icon">
              ⌕
            </span>
            <input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder={catalogTab === 'tests' ? 'Search tests e.g. CBC, thyroid…' : 'Search health packages…'}
              aria-label="Search catalog"
            />
          </label>

          {catalogTab === 'tests' ? (
            filteredTests.length > 0 ? (
              <div
                className={filteredTests.length > 1 ? 'hlm-diag-catalog-grid' : 'hlm-diag-catalog-list'}
                role="tabpanel"
                aria-label="Individual tests"
              >
                {filteredTests.map((test) => {
                  const on = Boolean(cart[test.id]);
                  const prep = displayFastingPrepForTest(test);
                  return (
                    <div
                      key={test.id}
                      className={on ? 'hlm-diag-test-cell hlm-diag-test-cell--on' : 'hlm-diag-test-cell'}
                    >
                      <div className="hlm-diag-test-head">
                        <DiagTestTubeIcon />
                        <div className="hlm-diag-test-head-copy">
                          <p className="hlm-diag-test-name">{test.name}</p>
                          <span className="hlm-diag-test-price">{money(test.price)}</span>
                        </div>
                      </div>
                      <div className="hlm-diag-test-prep-slot" aria-hidden={!prep}>
                        {prep ? (
                          <span className="hlm-diag-prep" title="Sample collection preparation">
                            {prep}
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className={on ? 'hlm-diag-add hlm-diag-add--on' : 'hlm-diag-add'}
                        onClick={() => toggleTest(test.id)}
                      >
                        {on ? 'Added' : '+ Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="hlm-diag-catalog-empty">
                {catalogTests.length === 0
                  ? 'This lab has no individual tests listed. Try Packages.'
                  : 'No tests match your search.'}
              </p>
            )
          ) : filteredPackages.length > 0 ? (
            <div
              className={filteredPackages.length > 1 ? 'hlm-diag-catalog-grid' : 'hlm-diag-catalog-list'}
              role="tabpanel"
              aria-label="Health packages"
            >
              {filteredPackages.map((pkg) => {
                const on = Boolean(packageCart[pkg.id]);
                return (
                  <div
                    key={pkg.id}
                    className={on ? 'hlm-diag-test-cell hlm-diag-test-cell--on' : 'hlm-diag-test-cell'}
                  >
                    <div className="hlm-diag-test-head">
                      <DiagTestTubeIcon />
                      <div className="hlm-diag-test-head-copy">
                        <p className="hlm-diag-test-name">{pkg.name}</p>
                        <span className="hlm-diag-test-price">{money(pkg.price)}</span>
                      </div>
                    </div>
                    <div className="hlm-diag-test-prep-slot">
                      <p className="hlm-diag-test-meta">{packageSubtitleText(pkg, testNameById)}</p>
                    </div>
                    <button
                      type="button"
                      className={on ? 'hlm-diag-add hlm-diag-add--on' : 'hlm-diag-add'}
                      onClick={() => togglePackage(pkg.id)}
                    >
                      {on ? 'Added' : '+ Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="hlm-diag-catalog-empty">
              {catalogPackages.length === 0
                ? 'No health packages at this lab yet.'
                : 'No packages match your search.'}
            </p>
          )}

          {detail?.eligible === false ? (
            <p style={styles.warn}>{detail.ineligibleReason || 'This address is outside collection radius.'}</p>
          ) : null}
        </section>

        <section
          id={bookingSectionId}
          className="hlm-diag-panel"
          style={bookingFocus ? { boxShadow: '0 0 0 2px rgba(198, 167, 94, 0.55)' } : undefined}
          aria-label="Patient details"
        >
          <div className="hlm-diag-panel-head">
            <span className="hlm-diag-step" aria-hidden>
              3
            </span>
            <div className="hlm-diag-panel-head-text">
              <p className="hlm-diag-section-title">Patient details</p>
              <p className="hlm-diag-section-sub">Who is giving the sample? Add family members once &amp; reuse.</p>
            </div>
          </div>
          <label style={styles.field}>
            Patient
            <select
              className="hlm-diag-field"
              value={patientId}
              disabled={patients.length === 0}
              onChange={(e) => setPatientId(e.target.value)}
            >
              {patients.length === 0 ? (
                <option value="">Add a patient below</option>
              ) : (
                patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                    {p.relation ? ` · ${p.relation}` : ''}
                  </option>
                ))
              )}
            </select>
          </label>
          {patients.length > 0 && !patientFormOpen ? (
            <button
              type="button"
              className="hlm-diag-chip"
              style={{ marginTop: '0.35rem' }}
              onClick={() => setPatientFormOpen(true)}
            >
              + Add another
            </button>
          ) : null}
          {patientFormOpen || patients.length === 0 ? (
            <div style={styles.patientAddBox}>
              {patients.length > 0 ? (
                <button
                  type="button"
                  className="hlm-diag-chip"
                  style={{ justifySelf: 'start', marginBottom: '0.15rem' }}
                  onClick={() => setPatientFormOpen(false)}
                >
                  Cancel
                </button>
              ) : null}
              <div className="hlm-diag-patient-line">
                <input
                  className="hlm-diag-field hlm-diag-patient-name"
                  placeholder="Name"
                  aria-label="Patient name"
                  value={patientForm.displayName}
                  onChange={(e) => setPatientForm((f) => ({ ...f, displayName: e.target.value }))}
                />
                <select
                  className="hlm-diag-field"
                  aria-label="Relation"
                  value={patientForm.relation}
                  onChange={(e) => setPatientForm((f) => ({ ...f, relation: e.target.value }))}
                >
                  {PATIENT_RELATIONS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
                <select
                  className="hlm-diag-field"
                  aria-label="Gender"
                  value={patientForm.gender}
                  onChange={(e) => setPatientForm((f) => ({ ...f, gender: e.target.value }))}
                >
                  {PATIENT_GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <input
                  className="hlm-diag-field"
                  type="number"
                  min={0}
                  max={120}
                  inputMode="numeric"
                  aria-label="Age"
                  placeholder="Age"
                  value={patientForm.ageYears}
                  onChange={(e) => setPatientForm((f) => ({ ...f, ageYears: e.target.value }))}
                />
              </div>
              <button
                type="button"
                className="hlm-diag-primary"
                disabled={patientSaving}
                onClick={() => void savePatientProfile()}
              >
                {patientSaving ? 'Saving…' : 'Save patient'}
              </button>
            </div>
          ) : null}
          <p className="hlm-diag-subhead">Reference type</p>
          <div style={styles.chipRow}>
            <button
              type="button"
              className={referenceType === 'SELF' ? 'hlm-diag-chip hlm-diag-chip--on' : 'hlm-diag-chip'}
              onClick={() => setReferenceType('SELF')}
            >
              Self
            </button>
            <button
              type="button"
              className={referenceType === 'DOCTOR' ? 'hlm-diag-chip hlm-diag-chip--on' : 'hlm-diag-chip'}
              onClick={() => setReferenceType('DOCTOR')}
            >
              Doctor referral
            </button>
          </div>
          {referenceType === 'DOCTOR' ? (
            <label style={styles.field}>
              Doctor name
              <input
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="hlm-diag-field"
                placeholder="Dr. …"
              />
            </label>
          ) : null}
        </section>

        <section className="hlm-diag-panel" id="hlm-diag-schedule" aria-label="Collection slot and address">
          <div className="hlm-diag-panel-head">
            <span className="hlm-diag-step" aria-hidden>
              4
            </span>
            <div className="hlm-diag-panel-head-text">
              <p className="hlm-diag-section-title">Collection address &amp; schedule</p>
              <p className="hlm-diag-section-sub">1-hour windows · phlebotomist visits your address</p>
            </div>
            <span className="hlm-diag-panel-head-side">
              {selectedSlot ? displayDiagnosticsSlotChipLabel(selectedSlot) : 'Pick time'}
            </span>
          </div>
          <label style={styles.field}>
            Collection address
            <select
              className="hlm-diag-field"
              value={addressId}
              disabled={addresses.length === 0}
              onChange={(e) => setAddressId(e.target.value)}
            >
              {addresses.length === 0 ? (
                <option value="">Add a delivery address for {townLabel}</option>
              ) : (
                addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {addressLabel(a)}
                  </option>
                ))
              )}
            </select>
          </label>
          {addresses.length === 0 ? (
            <p style={styles.muted}>
              <Link to="/addresses" style={styles.link}>
                Add an address
              </Link>{' '}
              in {townLabel} to book home collection.
            </p>
          ) : null}
          <label style={styles.field}>
            Date
            <div className="hlm-diag-date-wrap">
              <PickerDateField
                value={pickupDate}
                min={istDate(new Date())}
                onChange={(next: string) => {
                  if (next && next < istDate(new Date())) return;
                  setPickupDate(next);
                }}
              />
            </div>
          </label>
          <p className="hlm-diag-subhead">Collection time (1-hour windows)</p>
          <div className="hlm-diag-slot-scroll" style={styles.chipRow}>
            {slotsForDay.map((slot) => (
              <button
                key={slot.slotId}
                type="button"
                className={slotKey === slot.slotId ? 'hlm-diag-chip hlm-diag-chip--on' : 'hlm-diag-chip'}
                onClick={() => setSlotKey(slot.slotId)}
              >
                {displayDiagnosticsSlotChipLabel(slot)}
              </button>
            ))}
          </div>
          {slotsForDay.length === 0 ? (
            <p style={styles.muted}>No open slots this day — try another date.</p>
          ) : (
            <p style={{ ...styles.muted, margin: '0.25rem 0 0' }}>
              Selected: {selectedSlot ? displayDiagnosticsSlotChipLabel(selectedSlot) : 'Pick a time'}
            </p>
          )}
        </section>

        <section className="hlm-diag-panel" aria-label="Payment method">
          <div className="hlm-diag-panel-head">
            <span className="hlm-diag-step" aria-hidden>
              5
            </span>
            <div className="hlm-diag-panel-head-text">
              <p className="hlm-diag-section-title">Payment method</p>
              <p className="hlm-diag-section-sub">Pay online or at doorstep when the phlebotomist visits</p>
            </div>
          </div>
          <div className="hlm-diag-pay-row">
            {diagnosticsCodEnabled ? (
              <button
                type="button"
                className={paymentMethod === 'CASH' ? 'hlm-diag-pay-opt hlm-diag-pay-opt--on' : 'hlm-diag-pay-opt'}
                onClick={() => setPaymentMethod('CASH')}
              >
                Pay at doorstep (COD)
              </button>
            ) : null}
            {upiEnabled ? (
              <button
                type="button"
                className={paymentMethod === 'UPI' ? 'hlm-diag-pay-opt hlm-diag-pay-opt--on' : 'hlm-diag-pay-opt'}
                onClick={() => setPaymentMethod('UPI')}
              >
                Pay online
              </button>
            ) : null}
          </div>
          {paymentMethod === 'UPI' ? (
            <PaymentGatewayChoices options={paymentGateways} value={paymentGateway} onChange={setPaymentGateway} />
          ) : null}
        </section>

        <section className="hlm-diag-panel" id="hlm-diag-book-cta" aria-label="Confirm booking">
          <label style={styles.checkRow}>
            <input type="checkbox" checked={disclaimerOk} onChange={(e) => setDisclaimerOk(e.target.checked)} />
            <span>
              KoyaKart facilitates booking and sample logistics only — not medical advice. Reports are issued by the
              lab. I confirm patient details and slot.
            </span>
          </label>
          {bookBlock && !busy ? <p className="hlm-diag-error">{bookBlock}</p> : null}
          {error && error !== bookBlock ? <p className="hlm-diag-error">{error}</p> : null}
          <button
            type="button"
            className="hlm-diag-primary"
            disabled={busy || Boolean(bookBlock)}
            onClick={() => void confirmBooking()}
          >
            {busy ? busyLabel : `Book home collection – ${money(checkoutTotal)}`}
          </button>
        </section>
          </div>

          <aside className="hlm-diag-aside" aria-label="Booking summary">
            <div className="hlm-diag-summary">
              <div className="hlm-diag-summary-banner">
                <span className="hlm-diag-summary-icon" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 5h6v3H9V5Zm-2 5h10l-1 9H8l-1-9Z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                Booking summary
              </div>
              <div className="hlm-diag-summary-body">
                {cartLineItems.length > 0 ? (
                  <ul className="hlm-diag-summary-items">
                    {cartLineItems.map((row) => (
                      <li key={row.key} className="hlm-diag-summary-item">
                        <div className="hlm-diag-summary-item-copy">
                          <strong title={row.name}>{row.name}</strong>
                          <span>{money(row.price)}</span>
                        </div>
                        <button
                          type="button"
                          className="hlm-diag-summary-remove"
                          aria-label={`Remove ${row.name}`}
                          onClick={() => (row.kind === 'test' ? toggleTest(row.id) : togglePackage(row.id))}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hlm-diag-summary-empty">Add tests or packages to see your booking summary.</p>
                )}
                <ul className="hlm-diag-fee-list" style={{ marginTop: cartLineItems.length ? 0 : undefined }}>
                  <li>
                    <span>Home collection</span>
                    <strong>{money(homeFee)}</strong>
                  </li>
                  <li>
                    <span>Platform fee</span>
                    <strong>{money(platformFee)}</strong>
                  </li>
                  {codFee > 0 ? (
                    <li>
                      <span>COD handling</span>
                      <strong>{money(codFee)}</strong>
                    </li>
                  ) : null}
                </ul>
                <p className="hlm-diag-summary-total">
                  <span>Total amount</span>
                  <strong>{money(checkoutTotal)}</strong>
                </p>
                <button
                  type="button"
                  className="hlm-diag-primary hlm-diag-summary-cta"
                  style={{ marginTop: 0 }}
                  disabled={testCount === 0}
                  onClick={() => (testCount > 0 ? scrollToSchedule() : undefined)}
                >
                  Continue to schedule →
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showDock ? (
        <div className="hlm-diag-dock" aria-live="polite">
          <div className="hlm-diag-dock-inner">
            <div className="hlm-diag-dock-copy">
              <strong>{money(checkoutTotal)}</strong>
              <span>
                {testCount} item{testCount === 1 ? '' : 's'} · incl. home collection &amp; platform fee
              </span>
            </div>
            <button type="button" className="hlm-diag-dock-btn" onClick={scrollToBooking}>
              Continue
            </button>
          </div>
        </div>
      ) : null}
      </div>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  warn: { color: '#b45309', fontSize: '0.78rem', margin: '0.5rem 0 0' },
  muted: { color: '#6d7e7a', fontSize: '0.78rem', lineHeight: 1.45, margin: '0 0 0.35rem' },
  link: { color: '#0f3d36', fontWeight: 700 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
  field: { display: 'grid', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 800, marginBottom: '0.45rem', color: '#2c403c' },
  patientAddBox: { marginTop: '0.4rem', display: 'grid', gap: '0.35rem' },
  checkRow: { display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.72rem', lineHeight: 1.45 },
};
