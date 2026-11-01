import { PickerDateField } from '@hlm-dates';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import { ApiError } from '@/shared/api/http';
import { listAddresses, type AddressDto } from '@/features/shop/api/shopApi';
import { CheckoutDismissedError, openGatewayCheckout } from '@/features/shop/lib/gatewayCheckout';
import { PaymentGatewayChoices, usePaymentGateways } from '@/features/shop/components/PaymentGatewayChoices';
import { confirmOnlinePaymentResilient } from '@/features/shop/api/shopApi';
import { resolveOnlineCheckout, tenDigitIndianPhone } from '@/features/shop/lib/loadOnlineCheckout';
import { GlamWorkGallerySheet } from '../components/GlamWorkGallerySheet';
import { GlamCustomerReviewsPanel } from '../components/GlamCustomerReviewsPanel';
import {
  BEAUTY_OCCASIONS,
  BEAUTY_SERVICES,
  BEAUTY_VENUES,
  beautyServiceLabel,
  BEAUTY_LEAD_MS,
  buildBeautySlots,
  scheduleFromArtist,
  fetchBeautyArtists,
  fetchBeautyAvailability,
  blockedSlotIdsForDate,
  placeBeautyOrder,
  retryBeautyPayment,
  uploadBeautyReferencePhoto,
  type BeautyArtist,
  type BeautySlotAvailability,
  type BeautySlotId,
  type BeautySlotRow,
} from '../api/beautyApi';
import { normalizeServiceFor, serviceForLabel, vendorNameWithServiceFor } from '@hlm-vendor';
import type { VendorServiceFor } from '@hlm-vendor';

function artistServiceFor(artist: Pick<BeautyArtist, 'serviceFor'>): VendorServiceFor {
  return normalizeServiceFor(artist.serviceFor) ?? 'UNISEX';
}

function artistDisplayName(artist: Pick<BeautyArtist, 'businessName' | 'serviceFor'>): string {
  return vendorNameWithServiceFor(artist.businessName, artistServiceFor(artist));
}

function artistCardName(artist: Pick<BeautyArtist, 'businessName'>): string {
  return artist.businessName?.trim() || 'Artist';
}

function slotInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00+05:30`).toISOString();
}

function slotEndFromDuration(date: string, slotId: BeautySlotId, totalMinutes: number, slots: readonly BeautySlotRow[]): string {
  const slot = slots.find((row) => row.id === slotId);
  if (!slot) return slotInstant(date, '18:00');
  const start = new Date(`${date}T${slot.start}:00+05:30`);
  return new Date(start.getTime() + totalMinutes * 60_000).toISOString();
}

function rateLabel(rate: { serviceType: string; label?: string | null }): string {
  return rate.label?.trim() || beautyServiceLabel(rate.serviceType);
}

function istDate(when: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(when);
}

function slotBookable(
  artist: BeautyArtist | null,
  date: string,
  slotId: BeautySlotId,
  now: Date,
  availability: Map<string, BeautySlotAvailability> | null,
  slots: readonly BeautySlotRow[],
): boolean {
  if (!date || date < istDate(now)) return false;
  const slot = slots.find((row) => row.id === slotId);
  if (!slot) return false;
  const row = availability?.get(slotId);
  if (row) {
    if (row.manuallyBlocked || row.booked >= row.capacity) return false;
  } else if (blockedSlotIdsForDate(date, artist, slots).includes(slotId)) {
    return false;
  }
  const startAt = new Date(`${date}T${slot.start}:00+05:30`).getTime();
  return startAt >= now.getTime() + BEAUTY_LEAD_MS;
}

function money(value: number): string {
  return `₹${Number(value || 0).toFixed(0)}`;
}

/** One line per saved address — always includes street so duplicate "Home" labels stay distinct. */
function glamAddressOptionLabel(item: AddressDto): string {
  const label = item.label?.trim() || 'Address';
  const line = item.line1?.trim();
  const name = item.recipientName?.trim();
  if (line) return `${label} · ${line}`;
  if (name) return `${label} · ${name}`;
  return label;
}

function isDefaultAddress(item: AddressDto): boolean {
  return Boolean(item.isDefault ?? item.default);
}

function addressesForTown(all: AddressDto[], townId: string): AddressDto[] {
  if (!townId) return [];
  return all.filter((row) => row.townId === townId);
}

function pickDefaultAddressId(rows: AddressDto[]): string {
  if (!rows.length) return '';
  const marked = rows.find((row) => isDefaultAddress(row));
  return marked?.id ?? rows[0].id;
}

function artistInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const SKIN = `
.hlm-glam-root {
  display: grid;
  gap: 0.75rem;
  padding: 0.35rem 0.15rem 0.5rem;
  color: #0f172a;
  background:
    radial-gradient(ellipse 130% 55% at 50% -8%, rgba(244, 114, 182, 0.14), transparent 52%),
    linear-gradient(180deg, #fff5f9 0%, #fafafa 38%, #f4f4f5 100%);
  border-radius: 22px;
}
.hlm-glam-hero {
  margin-bottom: 0.1rem;
  position: relative;
  border-radius: 22px;
  padding: 1.15rem 1rem 1rem;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(100% 90% at 100% 0%, rgba(255,255,255,0.22) 0%, transparent 50%),
    radial-gradient(80% 60% at 0% 100%, rgba(253, 186, 216, 0.35) 0%, transparent 55%),
    linear-gradient(128deg, #4c0519 0%, #9d174d 38%, #ec4899 72%, #fda4af 100%);
  box-shadow:
    0 20px 50px rgba(157, 23, 77, 0.35),
    0 1px 0 rgba(255,255,255,0.2) inset;
}
.hlm-glam-hero h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.42rem;
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 1.12;
  max-width: 15.5rem;
  text-wrap: balance;
}
.hlm-glam-hero p {
  margin: 0.45rem 0 0;
  font-size: 0.78rem;
  font-weight: 600;
  opacity: 0.92;
  line-height: 1.5;
  max-width: 17.5rem;
}
.hlm-glam-sparkles {
  position: absolute;
  right: 0.85rem;
  top: 0.75rem;
  font-size: 1.65rem;
  opacity: 0.95;
  pointer-events: none;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.15));
}
.hlm-glam-trust {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.75rem;
}
.hlm-glam-trust span {
  font-size: 0.64rem;
  font-weight: 800;
  padding: 0.28rem 0.55rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.16);
  border: 1px solid rgba(255,255,255,0.32);
  backdrop-filter: blur(8px);
  letter-spacing: 0.01em;
}
.hlm-glam-panel {
  position: relative;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(14px);
  padding: 0.8rem 0.78rem;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.95) inset,
    0 10px 36px rgba(15, 23, 42, 0.06);
  display: grid;
  gap: 0.55rem;
}
.hlm-glam-panel[aria-label='Artists'] {
  overflow: visible;
  padding-bottom: 1rem;
}
.hlm-glam-panel-priority {
  border-color: rgba(244, 114, 182, 0.35);
  background: linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(253, 242, 248, 0.78) 100%);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.9) inset,
    0 12px 40px rgba(190, 24, 93, 0.1);
  padding-left: 0.95rem;
}
.hlm-glam-panel-priority::before {
  content: '';
  position: absolute;
  left: 0;
  top: 14px;
  bottom: 14px;
  width: 3px;
  border-radius: 0 4px 4px 0;
  background: linear-gradient(180deg, #f9a8d4, #db2777, #9d174d);
}
.hlm-glam-when-where-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.55rem;
  align-items: stretch;
}
.hlm-glam-when-where-row > .hlm-glam-panel {
  min-width: 0;
  height: 100%;
}
.hlm-glam-when-where-row .hlm-glam-panel-head-text {
  gap: 0.1rem;
}
.hlm-glam-when-where-row .hlm-glam-section-sub {
  font-size: 0.64rem;
}
.hlm-glam-when-where-row .hlm-glam-schedule-meta span {
  font-size: 0.58rem;
  padding: 0.18rem 0.4rem;
}
.hlm-glam-when-where-row .hlm-glam-venues {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.4rem;
}
.hlm-glam-when-where-row .hlm-glam-venue {
  min-height: 76px;
  padding: 0.5rem 0.35rem;
  gap: 0.28rem;
}
.hlm-glam-when-where-row .hlm-glam-venue-emoji {
  width: 34px;
  height: 34px;
  font-size: 1rem;
  border-radius: 12px;
}
.hlm-glam-when-where-row .hlm-glam-venue-title { font-size: 0.68rem; }
.hlm-glam-when-where-row .hlm-glam-venue-hint { font-size: 0.58rem; }
.hlm-glam-when-where-row .hlm-glam-studio {
  font-size: 0.62rem;
  margin: 0;
  line-height: 1.35;
}
@media (max-width: 520px) {
  .hlm-glam-when-where-row {
    grid-template-columns: 1fr;
  }
}
.hlm-glam-panel-head {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
}
.hlm-glam-panel-head-text {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
}
.hlm-glam-step {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 11px;
  background: linear-gradient(145deg, #fce7f3 0%, #fbcfe8 100%);
  color: #831843;
  font-size: 0.74rem;
  font-weight: 900;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: 0 3px 10px rgba(190, 24, 93, 0.18);
  font-family: var(--font-display);
}
.hlm-glam-step-pin {
  font-size: 0.95rem;
  line-height: 1;
}
.hlm-glam-section-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.92rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #0f172a;
  line-height: 1.2;
}
.hlm-glam-section-sub {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 600;
  color: #64748b;
  line-height: 1.4;
}
.hlm-glam-schedule-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.hlm-glam-schedule-meta span {
  font-size: 0.62rem;
  font-weight: 800;
  padding: 0.22rem 0.5rem;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}
.hlm-glam-schedule-meta span.hlm-glam-meta-accent {
  background: linear-gradient(135deg, #fdf2f8, #fce7f3);
  color: #9d174d;
  border-color: #fbcfe8;
}
.hlm-glam-occasions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}
.hlm-glam-occasion {
  border: 1.5px solid #e2e8f0;
  border-radius: 16px;
  padding: 0.5rem 0.35rem;
  min-height: 68px;
  background: #fff;
  cursor: pointer;
  text-align: center;
  display: grid;
  gap: 0.2rem;
  align-content: center;
  color: #1a1c1a;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.12s;
}
.hlm-glam-occasion:active { transform: scale(0.98); }
.hlm-glam-occasion-on {
  border-color: #db2777;
  background: linear-gradient(165deg, #fdf2f8 0%, #fff 100%);
  box-shadow: 0 0 0 2px rgba(219, 39, 119, 0.15);
}
.hlm-glam-occasion-emoji { font-size: 1.15rem; line-height: 1; }
.hlm-glam-occasion-label { font-size: 0.65rem; font-weight: 800; color: #374151; }
.hlm-glam-artists-scroll {
  margin: 0 -0.35rem;
  padding: 0.1rem 0.35rem 0.05rem;
  overflow: visible;
}
.hlm-glam-artists {
  display: flex;
  align-items: stretch;
  gap: 0.45rem;
  overflow-x: auto;
  overflow-y: visible;
  padding: 0.15rem 0.35rem 1.1rem;
  scroll-snap-type: x proximity;
  scroll-padding-inline: 0.35rem;
  overscroll-behavior-x: contain;
  touch-action: pan-x pan-y;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.hlm-glam-artists::-webkit-scrollbar { display: none; }
.hlm-glam-artists-tail {
  flex: 0 0 0.5rem;
  scroll-snap-align: end;
}
.hlm-glam-artist {
  flex: 0 0 clamp(6.85rem, 42vw, 8.35rem);
  width: clamp(6.85rem, 42vw, 8.35rem);
  align-self: stretch;
  scroll-snap-align: start;
  scroll-snap-stop: normal;
  border-radius: 16px;
  border: 1.5px solid #e2e8f0;
  padding: 0.48rem 0.5rem 0.52rem;
  background: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  text-align: left;
  color: #0f172a;
  box-sizing: border-box;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.12s;
  box-shadow: 0 3px 12px rgba(15, 23, 42, 0.05);
}
.hlm-glam-artist:active { transform: scale(0.98); }
.hlm-glam-artist-on {
  border-color: #ec4899;
  background: linear-gradient(160deg, #fff 0%, #fdf2f8 55%, #fce7f3 100%);
  box-shadow:
    0 0 0 2px rgba(236, 72, 153, 0.2),
    0 10px 28px rgba(219, 39, 119, 0.22);
}
.hlm-glam-artist-top {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
}
.hlm-glam-artist-avatar {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: linear-gradient(135deg, #831843 0%, #db2777 50%, #f472b6 100%);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 900;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: 0 3px 10px rgba(190, 24, 93, 0.3);
}
.hlm-glam-artist-name {
  flex: 1;
  min-width: 0;
  font-size: 0.72rem;
  font-weight: 900;
  margin: 0;
  color: #111827;
  line-height: 1.22;
  overflow-wrap: anywhere;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.hlm-glam-artist-meta {
  font-size: 0.62rem;
  color: #6b7280;
  font-weight: 700;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
}
.hlm-glam-artist-tag {
  font-size: 0.58rem;
  color: #9d174d;
  font-weight: 700;
  margin: 0;
  line-height: 1.3;
  min-height: 0.75rem;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.hlm-glam-artist-tag--empty {
  visibility: hidden;
  min-height: 0.75rem;
}
.hlm-glam-artist-work-slot {
  flex: 0 0 auto;
  min-height: 0.95rem;
  margin-top: auto;
  display: flex;
  align-items: flex-end;
}
.hlm-glam-artist-work {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.58rem;
  font-weight: 800;
  color: #db2777;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  justify-self: start;
  -webkit-tap-highlight-color: transparent;
}
.hlm-glam-artist-work:disabled {
  opacity: 0.45;
  cursor: default;
  text-decoration: none;
}
.hlm-glam-artist-work--placeholder {
  visibility: hidden;
  pointer-events: none;
  text-decoration: none;
}
.hlm-glam-rating {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.1rem 0.35rem;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
  font-weight: 900;
}
.hlm-glam-artist-audience {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.38rem;
  border-radius: 999px;
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  line-height: 1.2;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  white-space: nowrap;
}
.hlm-glam-artist-audience--male {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}
.hlm-glam-artist-audience--female {
  background: #fdf2f8;
  border-color: #fbcfe8;
  color: #be185d;
}
.hlm-glam-artist-audience--unisex {
  background: #f5f3ff;
  border-color: #ddd6fe;
  color: #6d28d9;
}
.hlm-glam-reviews-panel {
  margin-top: 0.55rem;
  padding: 0.65rem 0.75rem;
  border-radius: 14px;
  border: 1px solid #f9a8d4;
  background: linear-gradient(180deg, #fff 0%, #fff7fb 100%);
  box-shadow: 0 8px 24px rgba(190, 24, 93, 0.06);
}
.hlm-glam-reviews-panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
  margin-bottom: 0.5rem;
}
.hlm-glam-reviews-title {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 900;
  color: #831843;
  letter-spacing: -0.01em;
}
.hlm-glam-reviews-sub {
  margin: 0;
  font-size: 0.62rem;
  font-weight: 600;
  color: #9d174d;
  opacity: 0.85;
}
.hlm-glam-reviews-summary {
  display: grid;
  grid-template-columns: minmax(5.5rem, auto) 1fr;
  gap: 0.65rem 0.85rem;
  align-items: start;
  margin-bottom: 0.55rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid #fce7f3;
}
@media (max-width: 420px) {
  .hlm-glam-reviews-summary {
    grid-template-columns: 1fr;
  }
}
.hlm-glam-reviews-score-block {
  display: grid;
  gap: 0.1rem;
}
.hlm-glam-reviews-score {
  font-size: 1.65rem;
  font-weight: 900;
  line-height: 1;
  color: #9a3412;
}
.hlm-glam-reviews-score-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: #4b5563;
}
.hlm-glam-reviews-comment-count {
  font-size: 0.62rem;
  font-weight: 600;
  color: #be185d;
}
.hlm-glam-reviews-bars {
  display: grid;
  gap: 0.22rem;
  min-width: 0;
}
.hlm-glam-reviews-bar-row {
  display: grid;
  grid-template-columns: 1.65rem 1fr 2rem;
  align-items: center;
  gap: 0.35rem;
}
.hlm-glam-reviews-bar-label {
  font-size: 0.62rem;
  font-weight: 800;
  color: #c2410c;
  text-align: right;
}
.hlm-glam-reviews-bar-track {
  height: 0.35rem;
  border-radius: 999px;
  background: #fce7f3;
  overflow: hidden;
}
.hlm-glam-reviews-bar-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #fb923c, #ea580c);
}
.hlm-glam-reviews-bar-pct {
  font-size: 0.58rem;
  font-weight: 700;
  color: #6b7280;
  text-align: right;
}
.hlm-glam-reviews-list {
  display: grid;
  gap: 0.45rem;
  max-height: none;
}
.hlm-glam-reviews-list--sheet {
  max-height: min(52vh, 420px);
  overflow-y: auto;
  padding-right: 0.15rem;
  -webkit-overflow-scrolling: touch;
}
.hlm-glam-review-card {
  margin: 0;
  padding: 0.5rem 0.55rem;
  border-radius: 10px;
  border: 1px solid #f3f4f6;
  background: #fff;
}
.hlm-glam-review-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}
.hlm-glam-review-card-stars {
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: #ea580c;
  font-weight: 900;
}
.hlm-glam-review-card-stars-dim {
  color: #e5e7eb;
  font-weight: 700;
}
.hlm-glam-review-card-date {
  font-size: 0.6rem;
  font-weight: 600;
  color: #9ca3af;
  white-space: nowrap;
}
.hlm-glam-review-card-text {
  margin: 0;
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.45;
  color: #111827;
}
.hlm-glam-reviews-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.65rem;
  margin-top: 0.5rem;
}
.hlm-glam-reviews-link-btn,
.hlm-glam-reviews-load {
  border: none;
  border-radius: 999px;
  padding: 0.4rem 0.85rem;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
}
.hlm-glam-reviews-link-btn {
  background: #fdf2f8;
  color: #be185d;
  border: 1px solid #f9a8d4;
}
.hlm-glam-reviews-load {
  background: linear-gradient(135deg, #be185d, #db2777);
  color: #fff;
}
.hlm-glam-reviews-load:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.hlm-glam-reviews-end,
.hlm-glam-reviews-muted,
.hlm-glam-reviews-error {
  margin: 0;
  font-size: 0.65rem;
  font-weight: 600;
}
.hlm-glam-reviews-muted { color: #6b7280; }
.hlm-glam-reviews-error { color: #b91c1c; }
.hlm-glam-reviews-end { color: #6b7280; }
.hlm-glam-reviews-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0.75rem;
}
.hlm-glam-reviews-sheet {
  width: min(100%, 32rem);
  max-height: min(92vh, 640px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: 18px 18px 14px 14px;
  background: #fff;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
  padding: 0.75rem 0.85rem 0.85rem;
}
.hlm-glam-reviews-sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
  flex-shrink: 0;
}
.hlm-glam-reviews-sheet-close {
  border: none;
  background: #f3f4f6;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  font-size: 0.85rem;
  cursor: pointer;
  flex-shrink: 0;
}
.hlm-glam-service-table-wrap {
  overflow-x: auto;
  overflow-y: auto;
  max-height: min(42vh, 17.5rem);
  -webkit-overflow-scrolling: touch;
  margin: 0 -0.1rem;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  color-scheme: light;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
  background: #fff;
}
@media (max-width: 420px) {
  .hlm-glam-service-table th:nth-child(3),
  .hlm-glam-service-table td.hlm-glam-service-detail {
    display: none;
  }
  .hlm-glam-service-table th.hlm-glam-th-price,
  .hlm-glam-service-table td.hlm-glam-service-price {
    padding-right: 0.45rem;
  }
}
.hlm-glam-service-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72rem;
}
.hlm-glam-service-table thead th {
  padding: 0.45rem 0.5rem;
  text-align: left;
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
}
.hlm-glam-service-table th.hlm-glam-th-check { width: 2rem; padding-left: 0.5rem; }
.hlm-glam-service-table th.hlm-glam-th-price { text-align: right; white-space: nowrap; }
.hlm-glam-service-table tbody tr {
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
}
.hlm-glam-service-table tbody tr:last-child { border-bottom: none; }
.hlm-glam-service-table tbody tr:hover { background: #fafafa; }
.hlm-glam-service-table tbody tr.hlm-glam-service-row-on { background: #fdf2f8; }
.hlm-glam-service-table td {
  padding: 0.4rem 0.45rem;
  vertical-align: middle;
}
.hlm-glam-service-table td.hlm-glam-td-check {
  width: 2rem;
  padding-left: 0.5rem;
}
.hlm-glam-service-table input[type='checkbox'] {
  appearance: none;
  -webkit-appearance: none;
  width: 1rem;
  height: 1rem;
  margin: 0;
  cursor: pointer;
  border: 1.5px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  display: inline-grid;
  place-content: center;
  vertical-align: middle;
  flex-shrink: 0;
}
.hlm-glam-service-table input[type='checkbox']:checked {
  background: #be185d;
  border-color: #be185d;
}
.hlm-glam-service-table input[type='checkbox']:checked::after {
  content: '';
  width: 0.28rem;
  height: 0.55rem;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) translate(-0.5px, -1px);
}
.hlm-glam-service-table input[type='checkbox']:focus-visible {
  outline: 2px solid #f9a8d4;
  outline-offset: 1px;
}
.hlm-glam-service-name {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  font-weight: 800;
  color: #111827;
  line-height: 1.25;
}
.hlm-glam-service-emoji {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 6px;
  background: #fdf2f8;
  display: grid;
  place-items: center;
  font-size: 0.75rem;
  flex-shrink: 0;
}
.hlm-glam-service-detail {
  color: #6b7280;
  font-weight: 600;
  font-size: 0.65rem;
  line-height: 1.3;
  max-width: 9rem;
}
.hlm-glam-service-price {
  text-align: right;
  font-weight: 900;
  color: #be185d;
  white-space: nowrap;
  font-size: 0.78rem;
}
.hlm-glam-venues {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}
.hlm-glam-venue {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 16px;
  padding: 0.65rem 0.45rem;
  background: #fff;
  cursor: pointer;
  text-align: center;
  color: #0f172a;
  min-height: 88px;
  justify-content: center;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.12s;
}
.hlm-glam-venue:active { transform: scale(0.98); }
.hlm-glam-venue-on {
  border-color: #ec4899;
  background: linear-gradient(165deg, #fff 0%, #fdf2f8 100%);
  box-shadow: 0 0 0 2px rgba(236, 72, 153, 0.18), 0 8px 24px rgba(219, 39, 119, 0.12);
}
.hlm-glam-venue-emoji {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: linear-gradient(145deg, #fdf2f8, #fff);
  border: 1px solid #fce7f3;
  display: grid;
  place-items: center;
  font-size: 1.15rem;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(190, 24, 93, 0.08);
}
.hlm-glam-venue-title { font-size: 0.76rem; font-weight: 900; display: block; color: #111827; line-height: 1.25; }
.hlm-glam-venue-hint { font-size: 0.62rem; font-weight: 600; color: #64748b; display: block; margin-top: 0.15rem; line-height: 1.3; }
.hlm-glam-field {
  width: 100%;
  min-height: 46px;
  border-radius: 14px;
  border: 1.5px solid #e2e8f0;
  padding: 0 0.7rem;
  font-weight: 700;
  font-size: 0.82rem;
  background: #fff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) inset;
}
.hlm-glam-field:focus {
  outline: none;
  border-color: #ec4899;
  box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.18);
}
.hlm-glam-date-wrap .hlm-picker-date-icon {
  background: #fdf2f8;
  border-radius: 10px;
  color: #be185d;
  pointer-events: none;
}
.hlm-glam-date-wrap:focus-within .hlm-picker-date-icon {
  background: #fce7f3;
  color: #9d174d;
}
.hlm-glam-textarea {
  width: 100%;
  min-height: 72px;
  border-radius: 12px;
  border: 1.5px solid #e5e7eb;
  padding: 0.55rem 0.65rem;
  font-weight: 600;
  font-size: 0.78rem;
  background: #fff;
  color: #1a1c1a;
  resize: vertical;
  font-family: inherit;
}
.hlm-glam-slots {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.45rem;
  overflow-x: auto;
  padding: 0.15rem 0 0.35rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
.hlm-glam-slot {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 0 0.65rem;
  border-radius: 999px;
  border: 1.5px solid #cbd5e1;
  background-color: #ffffff;
  font-size: 0.72rem;
  font-weight: 800;
  color: #111827;
  -webkit-text-fill-color: #111827;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.hlm-glam-slot:not([disabled]):hover {
  border-color: #db2777;
  background-color: #fdf2f8;
}
.hlm-glam-slot.hlm-glam-slot-on {
  border-color: #9d174d;
  background-color: #be185d;
  background-image: linear-gradient(135deg, #be185d 0%, #db2777 100%);
  color: #ffffff;
  -webkit-text-fill-color: #ffffff;
  box-shadow: 0 4px 12px rgba(190, 24, 93, 0.35);
}
.hlm-glam-slot[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
  background-color: #f3f4f6;
  background-image: none;
  color: #9ca3af;
  -webkit-text-fill-color: #9ca3af;
}
.hlm-glam-slot[disabled].hlm-glam-slot-on {
  background-color: #fce7f3;
  border-color: #f9a8d4;
  color: #831843;
  -webkit-text-fill-color: #831843;
  opacity: 1;
}
.hlm-glam-slots-empty {
  margin: 0.15rem 0 0;
  padding: 0.55rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #9a3412;
  line-height: 1.45;
  border-radius: 12px;
  background: linear-gradient(135deg, #fff7ed, #ffedd5);
  border: 1px solid #fed7aa;
}
.hlm-glam-extras-grid {
  display: grid;
  gap: 0.55rem;
  scroll-margin-bottom: calc(var(--tabbar-h) + var(--glam-dock-h, 9.25rem) + 1rem);
}
@media (min-width: 640px) {
  .hlm-glam-extras-grid { grid-template-columns: 1fr 1fr; align-items: start; }
}
.hlm-glam-panel[aria-label='Services'],
.hlm-glam-panel[aria-label='Occasion'] {
  scroll-margin-bottom: calc(var(--tabbar-h) + var(--glam-dock-h, 9.25rem) + 1rem);
}
.hlm-glam-photo {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  border-radius: 14px;
  border: 2px dashed #f9a8d4;
  background: #fdf2f8;
  color: #9d174d;
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
  text-align: center;
  padding: 0.45rem;
}
.hlm-glam-photo-on {
  border-style: solid;
  border-color: #db2777;
  background: #fff;
}
.hlm-glam-studio {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  color: #374151;
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}
.hlm-glam-studio-warn {
  color: #b91c1c;
  background: #fef2f2;
  border-color: #fecaca;
}
@media (max-width: 360px) {
  .hlm-glam-occasions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 520px) {
  .hlm-glam-artist {
    flex-basis: clamp(6.5rem, 40vw, 7.75rem);
    width: clamp(6.5rem, 40vw, 7.75rem);
  }
  .hlm-glam-artists {
    padding-bottom: 1.25rem;
    scroll-snap-type: x mandatory;
  }
  .hlm-glam-artist-on {
    box-shadow:
      0 0 0 2px rgba(236, 72, 153, 0.2),
      0 6px 18px rgba(219, 39, 119, 0.18);
  }
}
@media (min-width: 521px) {
  .hlm-glam-artist {
    flex-basis: clamp(7.25rem, 28vw, 9rem);
    width: clamp(7.25rem, 28vw, 9rem);
  }
}
.hlm-glam-dock-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px));
  padding: 0.35rem 0.55rem 0.45rem;
  z-index: 40;
  pointer-events: none;
}
.hlm-glam-dock-wrap > * { pointer-events: auto; }
.hlm-glam-dock-card {
  display: flex;
  align-items: stretch;
  gap: 0.55rem;
  padding: 0.55rem 0.55rem 0.55rem 0.6rem;
  border-radius: 22px;
  background: linear-gradient(145deg, rgba(255,255,255,0.92) 0%, rgba(253,242,248,0.88) 100%);
  backdrop-filter: blur(16px) saturate(1.2);
  border: 1px solid rgba(255,255,255,0.75);
  box-shadow:
    0 0 0 1px rgba(244, 114, 182, 0.22),
    0 20px 50px rgba(157, 23, 77, 0.18),
    0 1px 0 rgba(255,255,255,0.95) inset;
}
.hlm-glam-dock-receipt {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.35rem;
}
.hlm-glam-dock-lines {
  display: grid;
  gap: 0.2rem;
  padding: 0.45rem 0.5rem;
  border-radius: 14px;
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(252, 231, 243, 0.9);
  box-shadow: 0 1px 0 rgba(255,255,255,0.8) inset;
}
.hlm-glam-price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.64rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.01em;
}
.hlm-glam-price-row span:last-child {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  color: #334155;
  flex-shrink: 0;
}
.hlm-glam-price-row--fee span:first-child {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.hlm-glam-price-row--fee span:first-child::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f472b6, #db2777);
  box-shadow: 0 0 0 2px rgba(244, 114, 182, 0.25);
}
.hlm-glam-price-total-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 0.25rem;
  padding-top: 0.35rem;
  border-top: 1px dashed rgba(244, 114, 182, 0.45);
}
.hlm-glam-price-total-label {
  font-size: 0.68rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9d174d;
}
.hlm-glam-price-total-value {
  font-size: 1.12rem;
  font-weight: 900;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(135deg, #831843 0%, #db2777 55%, #be185d 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hlm-glam-dock-meta-chip {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  font-size: 0.58rem;
  font-weight: 800;
  color: #831843;
  background: linear-gradient(135deg, #fce7f3 0%, #fff 100%);
  border: 1px solid rgba(251, 207, 232, 0.9);
}
.hlm-glam-dock-cta {
  flex-shrink: 0;
  align-self: center;
  min-height: 52px;
  min-width: 5.5rem;
  padding: 0 1rem;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  display: grid;
  place-content: center;
  gap: 0.05rem;
  background: linear-gradient(145deg, #9d174d 0%, #db2777 42%, #ec4899 100%);
  color: #fff;
  font-weight: 900;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  box-shadow:
    0 10px 28px rgba(190, 24, 93, 0.38),
    0 1px 0 rgba(255,255,255, 0.35) inset;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.hlm-glam-dock-cta:active:not(:disabled) {
  transform: scale(0.97);
  box-shadow: 0 6px 18px rgba(190, 24, 93, 0.32);
}
.hlm-glam-dock-cta:disabled { opacity: 0.65; cursor: not-allowed; }
.hlm-glam-dock-cta-sub {
  font-size: 0.52rem;
  font-weight: 700;
  opacity: 0.88;
  letter-spacing: 0.04em;
}
.hlm-glam-sheet-receipt {
  padding: 0.55rem 0.6rem;
  border-radius: 16px;
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(252, 231, 243, 0.95);
  box-shadow: 0 4px 18px rgba(190, 24, 93, 0.06);
}
.hlm-glam-sheet-receipt .hlm-glam-price-row { font-size: 0.72rem; }
.hlm-glam-sheet-receipt .hlm-glam-price-total-value { font-size: 1.05rem; }
.hlm-glam-pay-tile {
  flex: 1;
  min-height: 52px;
  border-radius: 12px;
  cursor: pointer;
  display: grid;
  gap: 0.2rem;
  padding: 0.5rem 0.45rem;
  text-align: left;
  font-family: inherit;
  color: #0f172a;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  -webkit-tap-highlight-color: transparent;
}
.hlm-glam-pay-tile-off:hover:not(:disabled) {
  border-color: #fbcfe8;
  background: #fffafb;
}
.hlm-glam-pay-tile-on {
  color: #831843;
  background: linear-gradient(180deg, #fff 0%, #fdf2f8 100%);
  border: 2px solid #db2777;
  box-shadow: 0 0 0 3px rgba(219, 39, 119, 0.14);
}
.hlm-glam-pay-title {
  font-size: 0.74rem;
  font-weight: 900;
  line-height: 1.3;
  color: inherit;
}
.hlm-glam-pay-hint {
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1.35;
  color: #64748b;
}
.hlm-glam-pay-tile-on .hlm-glam-pay-hint {
  color: #9d174d;
  opacity: 0.92;
}
.hlm-glam-pay-scratch {
  color: #047857;
  font-weight: 800;
}
.hlm-glam-pay-tile-on .hlm-glam-pay-scratch {
  color: #047857;
}
`;

export function BeautyPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const navigate = useNavigate();
  const {
    townId,
    townLabel,
    hasTown,
    beautyEnabled,
    beautyReady,
    platformFee: townPlatformFee,
    upiEnabled,
    beautyMinPrepayAmount: townMinPrepay,
    beautyParlourPaymentFee: townParlourFee,
    beautyScratchEnabled,
    beautyScratchPrepayFilter,
    beautyScratchRewardMax,
    beautyScratchRewardDisplayMax,
    beautyScratchMinOrderAmount,
    beautyScratchPartialEnabled,
    beautyScratchPartialRewardMax,
    beautyScratchPartialRewardDisplayMax,
    beautyScratchPartialMinPrepayAmount,
  } = useTown();
  const { options: paymentGateways, gateway: paymentGateway, setGateway: setPaymentGateway } = usePaymentGateways(token);

  const [artists, setArtists] = useState<BeautyArtist[]>([]);
  const [allAddresses, setAllAddresses] = useState<AddressDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [occasion, setOccasion] = useState('PARTY');
  const [artistId, setArtistId] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [venue, setVenue] = useState<'AT_HOME' | 'AT_STUDIO'>('AT_HOME');
  const [slotDate, setSlotDate] = useState(() => istDate(new Date()));
  const [slotId, setSlotId] = useState<BeautySlotId>('');
  const [slotAvailability, setSlotAvailability] = useState<Map<string, BeautySlotAvailability>>(new Map());
  const [availLoading, setAvailLoading] = useState(false);
  const [liveSchedule, setLiveSchedule] = useState<{
    vendorId: string;
    schedule: ReturnType<typeof scheduleFromArtist>;
    slots: ReturnType<typeof buildBeautySlots>;
  } | null>(null);
  const [addressId, setAddressId] = useState('');
  const [note, setNote] = useState('');
  const [referencePhotoMediaId, setReferencePhotoMediaId] = useState<string | undefined>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [prepayMode, setPrepayMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [confirming, setConfirming] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'idle' | 'booking' | 'checkout' | 'paying'>('idle');
  const [workGalleryArtistId, setWorkGalleryArtistId] = useState<string | null>(null);
  const now = useMemo(() => new Date(), [slotDate, slotId]);
  const artist = artists.find((row) => row.vendorId === artistId) ?? null;
  const workGalleryArtist = artists.find((row) => row.vendorId === workGalleryArtistId) ?? null;
  const bookingSchedule = useMemo(() => {
    if (liveSchedule?.vendorId === artistId) return liveSchedule.schedule;
    return scheduleFromArtist(artist);
  }, [artist, artistId, liveSchedule]);
  const visibleSlots = useMemo(() => {
    if (liveSchedule?.vendorId === artistId) return liveSchedule.slots;
    return buildBeautySlots(bookingSchedule);
  }, [artistId, bookingSchedule, liveSchedule]);

  const bookableSlots = useMemo(() => {
    return visibleSlots.filter((row) =>
      slotBookable(artist, slotDate, row.id, now, slotAvailability, visibleSlots),
    );
  }, [artist, slotDate, visibleSlots, slotAvailability, now]);

  const townAddresses = useMemo(
    () => addressesForTown(allAddresses, townId ?? ''),
    [allAddresses, townId],
  );

  useEffect(() => {
    setSlotId((prev) => {
      if (prev && bookableSlots.some((s) => s.id === prev)) return prev;
      return bookableSlots[0]?.id ?? '';
    });
  }, [artistId, slotDate, bookableSlots]);

  function selectArtist(nextId: string) {
    if (nextId === artistId) return;
    setArtistId(nextId);
    setLiveSchedule(null);
    setSlotAvailability(new Map());
  }

  useEffect(() => {
    if (!token || !townId || !beautyReady) return;
    if (!beautyEnabled) {
      setArtists([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchBeautyArtists(token, townId),
      listAddresses(token).catch(() => [] as AddressDto[]),
    ])
      .then(([shopList, addrList]) => {
        if (cancelled) return;
        setArtists(shopList);
        setAllAddresses(addrList);
        if (!artistId && shopList[0]) setArtistId(shopList[0].vendorId);
        const forTown = addressesForTown(addrList, townId ?? '');
        setAddressId((prev) => (prev && forTown.some((row) => row.id === prev) ? prev : pickDefaultAddressId(forTown)));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load artists');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, townId, beautyEnabled, beautyReady]);

  useEffect(() => {
    if (!townId) return;
    setAddressId((prev) =>
      prev && townAddresses.some((row) => row.id === prev) ? prev : pickDefaultAddressId(townAddresses),
    );
  }, [townId, townAddresses]);

  useEffect(() => {
    if (!token || !artistId || !slotDate) {
      setSlotAvailability(new Map());
      setLiveSchedule(null);
      setAvailLoading(false);
      return;
    }
    const activeArtistId = artistId;
    let cancelled = false;
    setAvailLoading(true);
    setLiveSchedule(null);
    setSlotAvailability(new Map());
    void fetchBeautyAvailability(token, activeArtistId, slotDate)
      .then((payload) => {
        if (cancelled) return;
        if (String(payload.vendorId) !== activeArtistId) return;
        const schedule = scheduleFromArtist({
          slotDayOpen: payload.slotDayOpen,
          slotDayClose: payload.slotDayClose,
          slotIntervalMinutes: payload.slotIntervalMinutes,
        });
        const grid = buildBeautySlots(schedule);
        const allowed = new Set((payload.slots ?? []).map((row) => row.slotId));
        const slots = allowed.size ? grid.filter((row) => allowed.has(row.id)) : grid;
        setLiveSchedule({ vendorId: activeArtistId, schedule, slots });
        const map = new Map<string, BeautySlotAvailability>();
        for (const row of payload.slots ?? []) map.set(row.slotId, row);
        setSlotAvailability(map);
        setArtists((prev) =>
          prev.map((row) =>
            row.vendorId === activeArtistId
              ? {
                  ...row,
                  slotDayOpen: schedule.dayOpen,
                  slotDayClose: schedule.dayClose,
                  slotIntervalMinutes: schedule.intervalMinutes,
                }
              : row,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSlotAvailability(new Map());
          setLiveSchedule(null);
        }
      })
      .finally(() => {
        if (!cancelled) setAvailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, artistId, slotDate]);

  const offeredRates = useMemo(() => {
    if (!artist) return [];
    return (artist.rates ?? []).filter((r) => r.unitPrice > 0 && !r.paused);
  }, [artist]);

  useEffect(() => {
    if (!offeredRates.length) {
      setSelectedServices([]);
      return;
    }
    setSelectedServices((prev) => prev.filter((id) => offeredRates.some((r) => r.serviceType === id)));
  }, [artistId, offeredRates]);

  const chosenRates = offeredRates.filter((row) => selectedServices.includes(row.serviceType));
  const travel = venue === 'AT_HOME' ? Number(artist?.homeVisitCharge || 0) : 0;
  const servicePrice = chosenRates.reduce((sum, row) => sum + Number(row.unitPrice || 0), 0);
  const totalMinutes = chosenRates.reduce((sum, row) => sum + Number(row.durationMinutes || 60), 0);
  const platformFee = servicePrice > 0 ? Number(townPlatformFee || 0) : 0;
  const baseTotal = servicePrice + travel + platformFee;
  const minPrepay = Math.max(
    0,
    townMinPrepay > 0 ? townMinPrepay : Number(artist?.bookingMinPrepayAmount ?? 0),
  );
  const parlourFee =
    prepayMode === 'PARTIAL' && venue === 'AT_STUDIO' ? Math.max(0, townParlourFee) : 0;
  const total = baseTotal + parlourFee;
  const partialAllowed = minPrepay > 0 && minPrepay < total;
  const payNow = prepayMode === 'PARTIAL' && partialAllowed ? minPrepay : total;
  const balanceAfterPrepay = Math.max(0, total - payNow);

  const scratchPromoEligible =
    beautyScratchEnabled &&
    servicePrice > beautyScratchMinOrderAmount &&
    beautyScratchRewardMax > 0;
  const scratchFullPromo =
    scratchPromoEligible &&
    (beautyScratchPrepayFilter === 'BOTH' || beautyScratchPrepayFilter === 'FULL');
  const scratchPartialPromo =
    beautyScratchEnabled &&
    partialAllowed &&
    beautyScratchPartialEnabled &&
    payNow > beautyScratchPartialMinPrepayAmount &&
    beautyScratchPartialRewardMax > 0 &&
    (beautyScratchPrepayFilter === 'BOTH' || beautyScratchPrepayFilter === 'PARTIAL');
  const scratchFullUpto =
    beautyScratchRewardDisplayMax > 0 ? Math.round(beautyScratchRewardDisplayMax) : Math.round(beautyScratchRewardMax);
  const scratchPartialUpto =
    beautyScratchPartialRewardDisplayMax > 0
      ? Math.round(beautyScratchPartialRewardDisplayMax)
      : Math.round(beautyScratchPartialRewardMax);

  const slotOk = slotBookable(artist, slotDate, slotId, now, slotAvailability, visibleSlots);
  const needsAddress = venue === 'AT_HOME';
  const studioOk = venue !== 'AT_STUDIO' || Boolean(artist?.studioAddress?.trim());
  const canBook =
    Boolean(
      artist &&
        chosenRates.length > 0 &&
        servicePrice > 0 &&
        slotOk &&
        upiEnabled &&
        studioOk &&
        (!needsAddress || addressId),
    );

  useEffect(() => {
    if (!partialAllowed && prepayMode === 'PARTIAL') setPrepayMode('FULL');
  }, [partialAllowed, prepayMode]);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setConfirming(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming, busy]);

  function closeConfirmSheet() {
    if (busy) return;
    setConfirming(false);
    setCheckoutStep('idle');
    setError(null);
  }

  function toggleService(serviceId: string) {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId],
    );
  }

  function PriceBreakdown({ sheet }: { sheet?: boolean }) {
    const wrapClass = sheet ? 'hlm-glam-sheet-receipt' : 'hlm-glam-dock-lines';
    return (
      <div className={wrapClass} aria-label="Price breakdown">
        <div className="hlm-glam-price-row">
          <span>Services</span>
          <span>{money(servicePrice)}</span>
        </div>
        {platformFee > 0 ? (
          <div className="hlm-glam-price-row hlm-glam-price-row--fee">
            <span>Platform fee</span>
            <span>{money(platformFee)}</span>
          </div>
        ) : null}
        {travel > 0 ? (
          <div className="hlm-glam-price-row">
            <span>Home visit</span>
            <span>{money(travel)}</span>
          </div>
        ) : null}
        {parlourFee > 0 ? (
          <div className="hlm-glam-price-row">
            <span>Pay-at-parlour</span>
            <span>{money(parlourFee)}</span>
          </div>
        ) : null}
        <div className="hlm-glam-price-total-row">
          <span className="hlm-glam-price-total-label">Total</span>
          <span className="hlm-glam-price-total-value">{money(total)}</span>
        </div>
      </div>
    );
  }

  async function submit() {
    if (!token || !townId || !artist || !canBook || chosenRates.length === 0) return;
    const slot = visibleSlots.find((row) => row.id === slotId);
    if (!slot) return;
    setBusy(true);
    setCheckoutStep('booking');
    setError(null);
    const contactPhone = tenDigitIndianPhone(session?.phone);
    try {
      sessionStorage.setItem('hlm:lastPaymentGateway', paymentGateway);
      const placed = await placeBeautyOrder(token, {
        townId,
        vendorId: artist.vendorId,
        serviceTypes: selectedServices,
        occasion,
        venue,
        paymentMethod: 'UPI',
        prepayMode: partialAllowed && prepayMode === 'PARTIAL' ? 'PARTIAL' : 'FULL',
        paymentGateway,
        contactPhone: contactPhone ?? undefined,
        specialInstructions: note.trim() || undefined,
        referencePhotoMediaId,
        addressId: needsAddress ? addressId : undefined,
        slotStart: slotInstant(slotDate, slot.start),
        slotEnd: slotEndFromDuration(slotDate, slotId, totalMinutes, visibleSlots),
      });
      let payError: string | null = null;
      try {
        setCheckoutStep('checkout');
        const checkout = await resolveOnlineCheckout({
          token,
          payment: placed.payment,
          paymentGateway,
          retry: () => retryBeautyPayment(token, placed.id, paymentGateway),
        });
        setConfirming(false);
        setCheckoutStep('paying');
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        const paid = await openGatewayCheckout(checkout, { contact: session?.phone ?? contactPhone ?? undefined });
        await confirmOnlinePaymentResilient(token, paid);
      } catch (err) {
        setConfirming(false);
        setCheckoutStep('idle');
        if (err instanceof CheckoutDismissedError) {
          navigate(`/beauty/orders/${placed.id}`, {
            state: { payNotice: 'Booking saved — complete UPI payment on the next screen.' },
          });
          return;
        }
        payError = err instanceof ApiError || err instanceof Error ? err.message : 'Payment failed';
      }
      navigate(`/beauty/orders/${placed.id}`, payError ? { state: { payError } } : undefined);
    } catch (err) {
      setCheckoutStep('idle');
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not book');
    } finally {
      setBusy(false);
      setCheckoutStep('idle');
    }
  }

  const payButtonLabel =
    checkoutStep === 'booking'
      ? 'Saving booking…'
      : checkoutStep === 'checkout'
        ? paymentGateway === 'CASHFREE'
          ? 'Opening Cashfree…'
          : 'Preparing checkout…'
        : checkoutStep === 'paying'
          ? 'Complete payment in the window…'
          : `Pay ${money(payNow)} & book`;

  return (
    <PortalShell
      title="Koya Glam"
      subtitle={hasTown ? `${townLabel} · makeup & styling` : 'Choose your town'}
      showDeliveryBanner={false}
      showStickyCart={false}
      footerSlot={
        canBook ? (
          <div className="hlm-glam-dock-wrap">
            <div className="hlm-glam-dock-card">
              <div className="hlm-glam-dock-receipt">
                <PriceBreakdown />
                <span className="hlm-glam-dock-meta-chip">
                  {chosenRates.length} service{chosenRates.length === 1 ? '' : 's'} · {totalMinutes} min
                </span>
              </div>
              <button
                type="button"
                className="hlm-glam-dock-cta"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setConfirming(true);
                }}
              >
                <span>Book now</span>
                <span className="hlm-glam-dock-cta-sub">UPI · secure</span>
              </button>
            </div>
          </div>
        ) : null
      }
    >
      <style>{SKIN}</style>
      {!session ? (
        <p style={styles.muted}>
          <Link to="/login" style={styles.link}>
            Sign in
          </Link>{' '}
          to book an artist in your town.
        </p>
      ) : null}
      {!beautyReady || loading ? <p style={styles.muted}>Loading artists…</p> : null}
      {beautyReady && !beautyEnabled ? (
        <p style={styles.muted}>Makeup & beauty is not live in this town yet.</p>
      ) : null}
      {error ? <p style={styles.error}>{error}</p> : null}

      {session && beautyReady && beautyEnabled && !loading ? (
        <div className="hlm-glam-root">
          <div className="hlm-glam-hero">
            <span className="hlm-glam-sparkles" aria-hidden>
              ✨💄
            </span>
            <h2>Look your best, close to home</h2>
            <p>Book trusted local makeup artists — at home or at their studio — with the same app you use for groceries.</p>
            <div className="hlm-glam-trust">
              <span>Verified artists</span>
              <span>Home or studio</span>
              <span>UPI &amp; cash</span>
            </div>
          </div>

          <div className="hlm-glam-panel" aria-label="Artists">
            <div className="hlm-glam-panel-head">
              <span className="hlm-glam-step" aria-hidden>
                1
              </span>
              <div className="hlm-glam-panel-head-text">
                <p className="hlm-glam-section-title">Pick your artist</p>
                <p className="hlm-glam-section-sub">
                  {artists.length > 1
                    ? `${artists.length} pros in ${townLabel} — swipe to compare`
                    : `Artists in ${townLabel}`}
                </p>
              </div>
            </div>
            {artists.length === 0 ? (
              <p style={styles.muted}>No artists are listed yet. Check back soon.</p>
            ) : (
              <div className="hlm-glam-artists-scroll">
                <div
                  className="hlm-glam-artists"
                  role="group"
                  aria-label="Artists — swipe left or right to compare"
                >
                  {artists.map((row) => (
                    <div
                      key={row.vendorId}
                      role="button"
                      tabIndex={0}
                      className={`hlm-glam-artist${artistId === row.vendorId ? ' hlm-glam-artist-on' : ''}`}
                      onClick={() => selectArtist(row.vendorId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectArtist(row.vendorId);
                        }
                      }}
                    >
                      <div className="hlm-glam-artist-top">
                        <span className="hlm-glam-artist-avatar" aria-hidden>
                          {artistInitials(row.businessName)}
                        </span>
                        <p className="hlm-glam-artist-name">{artistCardName(row)}</p>
                      </div>
                      <p className="hlm-glam-artist-meta">
                        <span
                          className={`hlm-glam-artist-audience hlm-glam-artist-audience--${artistServiceFor(row).toLowerCase()}`}
                        >
                          For {serviceForLabel(artistServiceFor(row))}
                        </span>
                        <span className="hlm-glam-rating">★ {Number(row.ratingScore ?? 4.8).toFixed(1)}</span>
                        {row.yearsExperience ? <span>{row.yearsExperience}+ yrs exp.</span> : null}
                      </p>
                      <p className={`hlm-glam-artist-tag${row.tagline ? '' : ' hlm-glam-artist-tag--empty'}`}>
                        {row.tagline || 'Tagline'}
                      </p>
                      <div className="hlm-glam-artist-work-slot">
                        {(row.workPhotos?.length ?? 0) > 0 ? (
                          <button
                            type="button"
                            className="hlm-glam-artist-work"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWorkGalleryArtistId(row.vendorId);
                            }}
                          >
                            Our work ({row.workPhotos!.length})
                          </button>
                        ) : (
                          <span className="hlm-glam-artist-work hlm-glam-artist-work--placeholder">Our work</span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="hlm-glam-artists-tail" aria-hidden />
                </div>
              </div>
            )}
          </div>

          {artist ? (
            <>
              {token ? (
                <GlamCustomerReviewsPanel
                  token={token}
                  vendorId={artist.vendorId}
                  artistName={artistDisplayName(artist)}
                  preview={artist.customerReviews}
                />
              ) : null}
              <div className="hlm-glam-when-where-row">
                <div className="hlm-glam-panel hlm-glam-panel-priority" aria-label="When">
                  <div className="hlm-glam-panel-head">
                    <span className="hlm-glam-step" aria-hidden>
                      2
                    </span>
                    <div className="hlm-glam-panel-head-text">
                      <p className="hlm-glam-section-title">Date &amp; time</p>
                      <div className="hlm-glam-schedule-meta" aria-label="Slot rules">
                        <span className="hlm-glam-meta-accent">{bookingSchedule.intervalMinutes} min slots</span>
                        <span>
                          {bookingSchedule.dayOpen}–{bookingSchedule.dayClose}
                        </span>
                        <span>1 hr notice</span>
                      </div>
                    </div>
                  </div>
                  <PickerDateField
                    wrapClassName="hlm-glam-date-wrap"
                    className="hlm-glam-field"
                    aria-label="Appointment date"
                    value={slotDate}
                    min={istDate(new Date())}
                    onChange={setSlotDate}
                    style={{
                      padding: '0.55rem 2.75rem 0.55rem 0.65rem',
                      borderRadius: 12,
                      border: '1.5px solid #e5e7eb',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                    }}
                  />
                  {availLoading ? <p className="hlm-glam-section-sub">Loading times…</p> : null}
                  {!availLoading && visibleSlots.length > 0 && bookableSlots.length === 0 ? (
                    <p className="hlm-glam-slots-empty">
                      No open times (1 hr notice). Try another day.
                    </p>
                  ) : null}
                  <div className="hlm-glam-slots" style={{ colorScheme: 'light' }}>
                    {!availLoading &&
                      bookableSlots.map((row) => {
                      const cap = slotAvailability.get(row.id);
                      const full = cap ? cap.booked >= cap.capacity : false;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          title={full ? 'Fully booked' : undefined}
                          className={`hlm-glam-slot${slotId === row.id ? ' hlm-glam-slot-on' : ''}`}
                          onClick={() => setSlotId(row.id)}
                        >
                          {row.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="hlm-glam-panel hlm-glam-panel-priority" aria-label="Where">
                  <div className="hlm-glam-panel-head">
                    <span className="hlm-glam-step" aria-hidden>
                      3
                    </span>
                    <div className="hlm-glam-panel-head-text">
                      <p className="hlm-glam-section-title">Where should we meet?</p>
                      <p className="hlm-glam-section-sub">Home or studio</p>
                    </div>
                  </div>
                  <div className="hlm-glam-venues">
                    {BEAUTY_VENUES.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className={`hlm-glam-venue${venue === row.id ? ' hlm-glam-venue-on' : ''}`}
                        onClick={() => setVenue(row.id)}
                      >
                        <span className="hlm-glam-venue-emoji" aria-hidden>
                          {row.emoji}
                        </span>
                        <span>
                          <span className="hlm-glam-venue-title">{row.label}</span>
                          <span className="hlm-glam-venue-hint">
                            {row.hint}
                            {row.id === 'AT_HOME' && Number(artist.homeVisitCharge) > 0
                              ? ` · +${money(Number(artist.homeVisitCharge))}`
                              : ''}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {venue === 'AT_STUDIO' ? (
                    artist.studioAddress ? (
                      <p className="hlm-glam-studio">Studio: {artist.studioAddress}</p>
                    ) : (
                      <p className="hlm-glam-studio hlm-glam-studio-warn">
                        This artist has not shared a studio address yet. Choose home visit or pick another artist.
                      </p>
                    )
                  ) : null}
                </div>
              </div>

              {venue === 'AT_HOME' ? (
                <div className="hlm-glam-panel hlm-glam-panel-priority" aria-label="Address">
                  <div className="hlm-glam-panel-head">
                    <span className="hlm-glam-step hlm-glam-step-pin" aria-hidden>
                      📍
                    </span>
                    <div className="hlm-glam-panel-head-text">
                      <p className="hlm-glam-section-title">Your address</p>
                      <p className="hlm-glam-section-sub">
                        {townAddresses.length
                          ? `${townAddresses.length} saved in ${townLabel} — same as checkout`
                          : `Add an address in ${townLabel}`}
                      </p>
                    </div>
                  </div>
                  <select
                    className="hlm-glam-field"
                    value={addressId}
                    onChange={(e) => setAddressId(e.target.value)}
                  >
                    {townAddresses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {glamAddressOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                  {!townAddresses.length ? (
                    <Link to="/addresses" style={styles.link}>
                      Add a delivery address
                    </Link>
                  ) : null}
                </div>
              ) : null}

              <div className="hlm-glam-panel" aria-label="Services">
                <div className="hlm-glam-panel-head">
                  <span className="hlm-glam-step" aria-hidden>
                    {venue === 'AT_HOME' ? 5 : 4}
                  </span>
                  <div className="hlm-glam-panel-head-text">
                    <p className="hlm-glam-section-title">Choose a service</p>
                    <p className="hlm-glam-section-sub">Tap rows to select · {artistDisplayName(artist)}</p>
                  </div>
                </div>
                {offeredRates.length === 0 ? (
                  <p style={styles.muted}>This artist has not listed prices yet. Try another artist.</p>
                ) : (
                  <div className="hlm-glam-service-table-wrap">
                    <table className="hlm-glam-service-table">
                      <thead>
                        <tr>
                          <th scope="col" className="hlm-glam-th-check" aria-label="Select" />
                          <th scope="col">Service</th>
                          <th scope="col">Details</th>
                          <th scope="col" className="hlm-glam-th-price">
                            Price
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {offeredRates.map((row) => {
                          const on = selectedServices.includes(row.serviceType);
                          const catalog = BEAUTY_SERVICES.find((s) => s.id === row.serviceType);
                          const label = rateLabel(row);
                          const detail = row.hint || catalog?.hint || `${row.durationMinutes} min`;
                          return (
                            <tr
                              key={row.serviceType}
                              className={on ? 'hlm-glam-service-row-on' : undefined}
                              onClick={() => toggleService(row.serviceType)}
                            >
                              <td className="hlm-glam-td-check">
                                <input
                                  type="checkbox"
                                  checked={on}
                                  aria-label={`${label}, ${money(row.unitPrice)}`}
                                  onChange={() => toggleService(row.serviceType)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td>
                                <span className="hlm-glam-service-name">
                                  <span className="hlm-glam-service-emoji" aria-hidden>
                                    {row.emoji || catalog?.emoji || '✨'}
                                  </span>
                                  {label}
                                </span>
                              </td>
                              <td className="hlm-glam-service-detail">{detail}</td>
                              <td className="hlm-glam-service-price">{money(row.unitPrice)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="hlm-glam-panel" aria-label="Occasion">
                <div className="hlm-glam-panel-head">
                  <span className="hlm-glam-step" aria-hidden>
                    {venue === 'AT_HOME' ? 6 : 5}
                  </span>
                  <div className="hlm-glam-panel-head-text">
                    <p className="hlm-glam-section-title">What&apos;s the occasion?</p>
                    <p className="hlm-glam-section-sub">So your artist can prep the right look</p>
                  </div>
                </div>
                <div className="hlm-glam-occasions">
                  {BEAUTY_OCCASIONS.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className={`hlm-glam-occasion${occasion === row.id ? ' hlm-glam-occasion-on' : ''}`}
                      style={occasion === row.id ? { backgroundColor: row.tint } : undefined}
                      onClick={() => setOccasion(row.id)}
                    >
                      <span className="hlm-glam-occasion-emoji">{row.emoji}</span>
                      <span className="hlm-glam-occasion-label">{row.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="hlm-glam-extras-grid">
                <div className="hlm-glam-panel">
                  <p className="hlm-glam-section-title">Notes (optional)</p>
                  <p className="hlm-glam-section-sub">Allergies, skin tone, outfit colour…</p>
                  <textarea
                    className="hlm-glam-textarea"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Tell your artist what matters to you"
                    maxLength={400}
                  />
                </div>

                <div className="hlm-glam-panel">
                  <p className="hlm-glam-section-title">Reference look</p>
                  <p className="hlm-glam-section-sub">Optional inspiration photo</p>
                  <label className={referencePhotoMediaId ? 'hlm-glam-photo hlm-glam-photo-on' : 'hlm-glam-photo'}>
                    {photoBusy ? 'Uploading…' : referencePhotoMediaId ? 'Photo added · tap to replace' : '📷 Add inspiration photo'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={photoBusy || !token}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file || !token) return;
                        setPhotoBusy(true);
                        setError(null);
                        void uploadBeautyReferencePhoto(token, file)
                          .then((mediaId) => setReferencePhotoMediaId(mediaId))
                          .catch((err) => setError(err instanceof Error ? err.message : 'Photo upload failed'))
                          .finally(() => setPhotoBusy(false));
                      }}
                    />
                  </label>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <GlamWorkGallerySheet
        open={workGalleryArtistId != null}
        artistName={workGalleryArtist ? artistDisplayName(workGalleryArtist) : 'Artist'}
        photos={workGalleryArtist?.workPhotos ?? []}
        onClose={() => setWorkGalleryArtistId(null)}
      />

      {confirming ? (
        <div style={styles.sheetBackdrop} role="presentation" onClick={() => closeConfirmSheet()}>
          <div style={styles.sheet} role="dialog" aria-modal="true" aria-label="Confirm booking" onClick={(e) => e.stopPropagation()}>
            <div style={styles.sheetTopBar}>
              <div style={styles.sheetHandle} aria-hidden />
              <button type="button" style={styles.sheetCloseBtn} onClick={() => closeConfirmSheet()} disabled={busy} aria-label="Close and edit services">
                ×
              </button>
            </div>
            <h3 style={styles.sheetTitle}>Pay to confirm booking</h3>
            <div style={styles.sheetScroll} className="hlm-hide-scrollbar">
              <p style={styles.sheetLine}>
                {artist ? artistDisplayName(artist) : 'Artist'} · {chosenRates.map((row) => rateLabel(row)).join(' + ')}
              </p>
              <p style={styles.sheetLine}>{venue === 'AT_HOME' ? 'At your home' : 'At studio'}</p>
              <PriceBreakdown sheet />
              <p style={styles.sheetMuted}>Choose how much to pay online now — both options use UPI.</p>
              <div style={styles.payRow}>
                <button
                  type="button"
                  className={`hlm-glam-pay-tile${prepayMode === 'FULL' ? ' hlm-glam-pay-tile-on' : ' hlm-glam-pay-tile-off'}`}
                  onClick={() => setPrepayMode('FULL')}
                >
                  <span className="hlm-glam-pay-title">Pay full · {money(baseTotal)}</span>
                  <span className="hlm-glam-pay-hint">Slot adjustments if available</span>
                  {scratchFullPromo ? (
                    <span className="hlm-glam-pay-hint hlm-glam-pay-scratch">
                      Win a scratch card up to ₹{scratchFullUpto}
                    </span>
                  ) : null}
                </button>
                {partialAllowed ? (
                  <button
                    type="button"
                    className={`hlm-glam-pay-tile${prepayMode === 'PARTIAL' ? ' hlm-glam-pay-tile-on' : ' hlm-glam-pay-tile-off'}`}
                    onClick={() => setPrepayMode('PARTIAL')}
                  >
                    <span className="hlm-glam-pay-title">Pay {money(minPrepay)} and book</span>
                    <span className="hlm-glam-pay-hint">Not refunded · balance at parlour</span>
                    {scratchPartialPromo ? (
                      <span className="hlm-glam-pay-hint hlm-glam-pay-scratch">
                        Scratch card up to ₹{scratchPartialUpto}
                      </span>
                    ) : null}
                  </button>
                ) : null}
              </div>
              {prepayMode === 'PARTIAL' && partialAllowed ? (
                <p style={styles.sheetMuted}>
                  Pay {money(minPrepay)} now · {money(balanceAfterPrepay)} due at the parlour before your slot
                </p>
              ) : null}
              {!upiEnabled ? (
                <p style={{ ...styles.sheetMuted, color: '#b91c1c', fontWeight: 700 }}>UPI is not enabled in this town.</p>
              ) : (
                <PaymentGatewayChoices
                  options={paymentGateways}
                  value={paymentGateway}
                  onChange={setPaymentGateway}
                  disabled={busy}
                />
              )}
              {error ? <p style={styles.sheetError}>{error}</p> : null}
            </div>
            <div style={styles.sheetFooter}>
              <div style={styles.sheetFooterActions}>
                <button type="button" style={styles.sheetBackBtn} disabled={busy} onClick={() => closeConfirmSheet()}>
                  Edit services
                </button>
                <button type="button" style={styles.confirmBtn} disabled={busy || !upiEnabled} onClick={() => void submit()}>
                  {busy ? payButtonLabel : `Pay ${money(payNow)} & book`}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  muted: { color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.82rem', margin: 0 },
  error: { color: '#b91c1c', fontWeight: 700, fontSize: '0.82rem', margin: 0 },
  link: { color: '#be185d', fontWeight: 800 },
  hint: { margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 },
  select: {
    width: '100%',
    minHeight: 42,
    borderRadius: 10,
    border: '1px solid var(--border)',
    padding: '0 0.55rem',
    fontWeight: 700,
    fontSize: '0.78rem',
    background: 'var(--bg-elevated)',
  },
  date: {
    width: '100%',
    minHeight: 40,
    borderRadius: 10,
    border: '1px solid var(--border)',
    padding: '0 0.55rem',
    fontWeight: 700,
    marginBottom: '0.35rem',
  },
  input: {
    width: '100%',
    minHeight: 40,
    borderRadius: 10,
    border: '1px solid var(--border)',
    padding: '0 0.55rem',
    fontSize: '0.78rem',
    fontWeight: 600,
  },
  sheetBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    zIndex: 60,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  sheet: {
    background: 'linear-gradient(180deg, #fff 0%, #fdf2f8 100%)',
    borderRadius: '22px 22px 0 0',
    padding: '0.85rem 0.9rem 0',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'min(92dvh, 100%)',
    minHeight: 0,
    width: '100%',
    maxWidth: 'var(--shell-max)',
    margin: '0 auto',
    borderTop: '1px solid rgba(244, 114, 182, 0.35)',
    boxSizing: 'border-box',
  },
  sheetTopBar: {
    position: 'relative',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    padding: '0.35rem 0.75rem 0.15rem',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    background: 'rgba(190, 24, 93, 0.28)',
  },
  sheetCloseBtn: {
    position: 'absolute',
    right: '0.65rem',
    top: '0.15rem',
    width: 36,
    height: 36,
    border: '1px solid rgba(244, 114, 182, 0.45)',
    borderRadius: 999,
    background: '#fff',
    color: '#831843',
    fontSize: '1.35rem',
    lineHeight: 1,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
  },
  sheetScroll: {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    display: 'grid',
    gap: '0.5rem',
    padding: '0 0.9rem 0.35rem',
  },
  sheetFooter: {
    flexShrink: 0,
    padding: '0.45rem 0.9rem calc(0.85rem + env(safe-area-inset-bottom, 0px))',
    borderTop: '1px solid rgba(244, 114, 182, 0.22)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, #fdf2f8 100%)',
  },
  sheetFooterActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.25fr',
    gap: '0.45rem',
    alignItems: 'stretch',
  },
  sheetBackBtn: {
    minHeight: 46,
    borderRadius: 12,
    border: '1.5px solid rgba(244, 114, 182, 0.55)',
    background: '#fff',
    color: '#831843',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
  sheetTitle: {
    margin: 0,
    padding: '0 0.9rem 0.35rem',
    fontSize: '1rem',
    fontWeight: 900,
    minWidth: 0,
    paddingRight: '3rem',
  },
  sheetLine: { margin: 0, fontSize: '0.78rem', fontWeight: 700 },
  sheetMuted: { margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 },
  sheetError: { margin: '0.35rem 0 0', fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700, lineHeight: 1.4 },
  payRow: { display: 'flex', gap: '0.35rem', alignItems: 'stretch' },
  confirmBtn: {
    minHeight: 46,
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #831843, #db2777)',
    color: '#fff',
    fontWeight: 900,
    cursor: 'pointer',
  },
  photo: { fontSize: '0.72rem', fontWeight: 700, color: '#9d174d', cursor: 'pointer', display: 'inline-block' },
  photoOn: { fontSize: '0.72rem', fontWeight: 800, color: '#831843', cursor: 'pointer', display: 'inline-block' },
};
