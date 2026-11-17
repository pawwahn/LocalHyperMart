import { PickerDateField } from '@hlm-dates';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  glamVenuePayEstimate,
  resolveHomeVisitCharge,
  type BeautyArtist,
  type BeautySlotAvailability,
  type BeautySlotId,
  type BeautySlotRow,
} from '../api/beautyApi';
import {
  BEAUTY_SERVICE_CATEGORIES,
  GLAM_HERO_IMAGE,
  GLAM_HERO_SIZES,
  GLAM_HERO_SRCSET,
  GLAM_OCCASION_FALLBACK_IMAGE,
  GLAM_REFERENCE_UPLOAD_BACKDROP,
  GLAM_SERVICE_FALLBACK_IMAGE,
  GLAM_VENUE_FALLBACK_IMAGE,
  artistCoverImage,
  beautyServicesInCategory,
  glamOccasionImage,
  glamServiceImage,
  glamVenueImage,
  type BeautyServiceCategoryId,
} from '@hlm-beauty';
import { normalizeServiceFor, serviceForLabel, vendorNameWithServiceFor } from '@hlm-vendor';
import type { VendorServiceFor } from '@hlm-vendor';

function artistServiceFor(artist: Pick<BeautyArtist, 'serviceFor'>): VendorServiceFor {
  return normalizeServiceFor(artist.serviceFor) ?? 'UNISEX';
}

function artistDisplayName(artist: Pick<BeautyArtist, 'businessName' | 'serviceFor'>): string {
  return vendorNameWithServiceFor(artist.businessName, artistServiceFor(artist), 'Makeup & Beauty');
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
@keyframes hlm-glam-sparkle-float {
  0%, 100% { transform: translateY(0) rotate(-4deg); opacity: 0.92; }
  50% { transform: translateY(-4px) rotate(3deg); opacity: 1; }
}
.hlm-glam-root {
  display: grid;
  gap: 0.55rem;
  padding: 0.2rem 0.05rem 0.4rem;
  color: #1c1917;
  background:
    radial-gradient(circle at 8% 4%, rgba(212, 165, 116, 0.14), transparent 38%),
    radial-gradient(circle at 92% 12%, rgba(190, 24, 93, 0.07), transparent 36%),
    linear-gradient(180deg, #faf6f1 0%, #f3ebe3 42%, #efe6dc 100%);
  border-radius: 20px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
.hlm-glam-hero {
  margin-bottom: 0.05rem;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  border-radius: 20px;
  min-height: 9.35rem;
  padding: 0.9rem 0 0.85rem 1rem;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.08) 0%, transparent 45%),
    linear-gradient(118deg, #3b0412 0%, #5c0a24 38%, #831843 72%, #6b1235 100%);
  box-shadow:
    0 18px 48px rgba(76, 5, 25, 0.32),
    0 1px 0 rgba(255,255,255,0.2) inset;
  isolation: isolate;
}
.hlm-glam-hero-photo-wrap {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(44%, 10.5rem);
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  border-radius: 0 20px 20px 0;
}
.hlm-glam-hero-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 12%;
  display: block;
}
.hlm-glam-hero-photo-fade {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #5c0a24 0%, rgba(92, 10, 36, 0.85) 12%, transparent 38%);
  pointer-events: none;
}
.hlm-glam-hero-scrim {
  display: none;
}
.hlm-glam-hero-deco {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  background:
    radial-gradient(circle at 92% 18%, rgba(255,255,255,0.12) 0%, transparent 36%),
    radial-gradient(circle at 6% 92%, rgba(212, 165, 116, 0.12) 0%, transparent 40%);
  opacity: 0.75;
}
.hlm-glam-hero-body {
  position: relative;
  z-index: 3;
  display: grid;
  gap: 0.32rem;
  padding-right: min(46%, 11rem);
  max-width: 100%;
}
.hlm-glam-hero-kicker {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.95);
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.28);
  backdrop-filter: blur(10px);
}
.hlm-glam-hero h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 4.8vw, 1.55rem);
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 1.1;
  max-width: 16rem;
  text-wrap: balance;
  text-shadow: 0 2px 18px rgba(76, 5, 25, 0.35);
}
.hlm-glam-hero p {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 600;
  opacity: 0.94;
  line-height: 1.45;
  max-width: 17rem;
}
.hlm-glam-sparkles {
  position: absolute;
  right: 0.65rem;
  top: 0.55rem;
  z-index: 3;
  font-size: clamp(1.35rem, 4.5vw, 1.65rem);
  opacity: 0.92;
  pointer-events: none;
  filter: drop-shadow(0 6px 16px rgba(0,0,0,0.25));
}
@media (prefers-reduced-motion: no-preference) {
  .hlm-glam-sparkles { animation: hlm-glam-sparkle-float 4.5s ease-in-out infinite; }
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
  border: 1px solid rgba(255, 255, 255, 0.92);
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.82) 100%);
  backdrop-filter: blur(14px);
  padding: 0.72rem 0.75rem;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.98) inset,
    0 12px 40px rgba(15, 23, 42, 0.07),
    0 0 0 1px rgba(15, 23, 42, 0.02);
  display: grid;
  gap: 0.5rem;
}
.hlm-glam-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 38%);
  opacity: 0.65;
}
.hlm-glam-panel > * { position: relative; z-index: 1; }
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
  z-index: 2;
}
.hlm-glam-panel-priority::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 40%);
  opacity: 0.55;
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
@media (max-width: 720px) {
  .hlm-glam-when-where-row {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) {
  .hlm-glam-hero {
    min-height: 6.85rem;
    padding: 0.6rem 0 0.5rem 0.72rem;
  }
  .hlm-glam-hero-body {
    padding-right: min(40%, 9rem);
    gap: 0.25rem;
  }
  .hlm-glam-hero h2 {
    font-size: clamp(1.12rem, 5vw, 1.32rem);
    max-width: 13.5rem;
  }
  .hlm-glam-hero p {
    font-size: 0.7rem;
    max-width: 14.5rem;
  }
  .hlm-glam-trust {
    margin-top: 0.4rem;
    gap: 0.28rem;
  }
  .hlm-glam-trust span {
    font-size: 0.58rem;
    padding: 0.22rem 0.45rem;
  }
  .hlm-glam-root {
    padding: 0.1rem 0 0.35rem;
    gap: 0.45rem;
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
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 999px;
  background: linear-gradient(145deg, #5c0a24 0%, #831843 55%, #9d174d 100%);
  border: 1px solid rgba(255,255,255,0.28);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 900;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(76, 5, 25, 0.28);
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
  gap: 0.28rem;
}
@media (min-width: 380px) {
  .hlm-glam-occasions {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
.hlm-glam-occasion {
  position: relative;
  border: 1.5px solid rgba(120, 53, 15, 0.12);
  border-radius: 11px;
  padding: 0;
  min-height: 0;
  aspect-ratio: 5 / 3;
  background: #fdf2f8;
  cursor: pointer;
  text-align: left;
  display: grid;
  align-content: end;
  color: #1a1c1a;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.12s;
}
.hlm-glam-occasion:active { transform: scale(0.98); }
.hlm-glam-occasion-on {
  border-color: #831843;
  box-shadow: 0 0 0 2px rgba(131, 24, 67, 0.22), 0 8px 22px rgba(76, 5, 25, 0.14);
}
.hlm-glam-occasion-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 22%;
  z-index: 0;
  display: block;
}
.hlm-glam-occasion-scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.02) 0%, rgba(76, 5, 25, 0.35) 45%, rgba(76, 5, 25, 0.78) 100%);
  pointer-events: none;
}
.hlm-glam-occasion-on .hlm-glam-occasion-scrim {
  background: linear-gradient(180deg, rgba(131, 24, 67, 0.06) 0%, rgba(76, 5, 25, 0.4) 48%, rgba(76, 5, 25, 0.85) 100%);
}
.hlm-glam-occasion-copy {
  position: relative;
  z-index: 2;
  padding: 0.22rem 0.28rem 0.28rem;
  display: grid;
  gap: 0.02rem;
}
.hlm-glam-occasion-emoji { font-size: 0.68rem; line-height: 1; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35)); }
.hlm-glam-occasion-label { font-size: 0.54rem; font-weight: 900; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.45); letter-spacing: 0.01em; line-height: 1.15; }
@media (min-width: 380px) {
  .hlm-glam-occasion { aspect-ratio: 4 / 5; }
}
.hlm-glam-artists-scroll {
  margin: 0 -0.35rem;
  padding: 0.1rem 0.35rem 0.05rem;
  overflow: visible;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 0.65rem, #000 calc(100% - 0.65rem), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 0.65rem, #000 calc(100% - 0.65rem), transparent 100%);
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
  position: relative;
  flex: 0 0 clamp(7.85rem, 46vw, 9.75rem);
  width: clamp(7.85rem, 46vw, 9.75rem);
  align-self: stretch;
  scroll-snap-align: start;
  scroll-snap-stop: normal;
  border-radius: 16px;
  border: 1.5px solid rgba(120, 53, 15, 0.14);
  padding: 0;
  background: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0;
  text-align: left;
  color: #0f172a;
  box-sizing: border-box;
  overflow: hidden;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.12s;
  box-shadow: 0 6px 20px rgba(76, 5, 25, 0.08);
}
.hlm-glam-artist:active { transform: scale(0.98); }
.hlm-glam-artist-on {
  border-color: #831843;
  box-shadow:
    0 0 0 2px rgba(131, 24, 67, 0.28),
    0 14px 36px rgba(76, 5, 25, 0.2);
}
.hlm-glam-artist-cover {
  position: relative;
  height: 4.65rem;
  flex-shrink: 0;
  background: #f5ebe0;
}
.hlm-glam-artist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.hlm-glam-artist-cover-badge {
  position: absolute;
  left: 0.35rem;
  bottom: 0.35rem;
  padding: 0.12rem 0.38rem;
  border-radius: 999px;
  font-size: 0.52rem;
  font-weight: 900;
  letter-spacing: 0.02em;
  color: #fff;
  background: rgba(76, 5, 25, 0.72);
  border: 1px solid rgba(255,255,255,0.28);
  backdrop-filter: blur(6px);
}
.hlm-glam-artist-body {
  display: grid;
  gap: 0.22rem;
  padding: 0.42rem 0.45rem 0.48rem;
  flex: 1;
}
.hlm-glam-artist-on::after {
  content: '✓';
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 0.58rem;
  font-weight: 900;
  color: #fff;
  background: linear-gradient(145deg, #db2777, #9d174d);
  box-shadow: 0 3px 10px rgba(157, 23, 77, 0.35);
}
.hlm-glam-artist-top {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.hlm-glam-artist-avatar {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: linear-gradient(135deg, #4c0519 0%, #831843 100%);
  color: #fff;
  font-size: 0.58rem;
  font-weight: 900;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(76, 5, 25, 0.25);
}
.hlm-glam-artist-name {
  flex: 1;
  min-width: 0;
  font-size: 0.7rem;
  font-weight: 900;
  margin: 0;
  color: #1c1917;
  line-height: 1.2;
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
.hlm-glam-reviews-compact {
  margin-top: 0.45rem;
  display: flex;
  align-items: stretch;
  gap: 0.35rem;
  min-width: 0;
}
.hlm-glam-reviews-compact-main {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  gap: 0.1rem 0.5rem;
  align-items: center;
  padding: 0.42rem 0.55rem;
  border-radius: 12px;
  border: 1px solid #fbcfe8;
  background: linear-gradient(135deg, #fff 0%, #fff1f2 55%, #fff7ed 100%);
  box-shadow: 0 4px 14px rgba(190, 24, 93, 0.07);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}
.hlm-glam-reviews-compact-main:active {
  transform: scale(0.99);
}
.hlm-glam-reviews-compact-score {
  grid-row: 1 / span 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 2.35rem;
  padding: 0.15rem 0.25rem;
  border-radius: 10px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  font-size: 0.92rem;
  font-weight: 900;
  line-height: 1.05;
  color: #c2410c;
}
.hlm-glam-reviews-compact-star {
  font-size: 0.55rem;
  line-height: 1;
  color: #ea580c;
}
.hlm-glam-reviews-compact-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.45rem;
  min-width: 0;
}
.hlm-glam-reviews-compact-label {
  font-size: 0.68rem;
  font-weight: 900;
  color: #9d174d;
  letter-spacing: -0.01em;
}
.hlm-glam-reviews-compact-count {
  font-size: 0.6rem;
  font-weight: 700;
  color: #6b7280;
}
.hlm-glam-reviews-compact-quote {
  grid-column: 2;
  margin: 0;
  font-size: 0.62rem;
  font-weight: 600;
  line-height: 1.35;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hlm-glam-reviews-compact-quote--muted {
  color: #9ca3af;
  font-style: italic;
}
.hlm-glam-reviews-compact-cta {
  flex-shrink: 0;
  align-self: stretch;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.05rem;
  min-width: 3.1rem;
  padding: 0.35rem 0.5rem;
  border-radius: 12px;
  border: none;
  background: linear-gradient(160deg, #be185d, #db2777);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 900;
  line-height: 1.15;
  cursor: pointer;
  font-family: inherit;
  box-shadow: 0 6px 16px rgba(190, 24, 93, 0.28);
  -webkit-tap-highlight-color: transparent;
}
.hlm-glam-reviews-compact-cta span {
  font-size: 0.72rem;
  opacity: 0.95;
}
.hlm-glam-reviews-compact-cta:active {
  transform: scale(0.98);
}
.hlm-glam-reviews-error--compact {
  flex: 1 1 100%;
  margin-top: 0.15rem;
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
  padding: 0.35rem 0.4rem 0.4rem;
  border: 1px solid #f1f5f9;
  border-radius: 16px;
  color-scheme: light;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 24px rgba(15, 23, 42, 0.05);
  background: linear-gradient(180deg, #f8fafc 0%, #fff 28%);
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
  border-collapse: separate;
  border-spacing: 0 0.32rem;
  font-size: 0.72rem;
}
.hlm-glam-service-table thead th {
  padding: 0.35rem 0.5rem 0.45rem;
  text-align: left;
  font-size: 0.58rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
  background: transparent;
  border-bottom: none;
}
.hlm-glam-service-table th.hlm-glam-th-check { width: 2rem; padding-left: 0.5rem; }
.hlm-glam-service-table th.hlm-glam-th-price { text-align: right; white-space: nowrap; }
.hlm-glam-service-table tbody tr {
  cursor: pointer;
  background: #fff;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.15s ease, transform 0.12s ease;
}
.hlm-glam-service-table tbody tr:active { transform: scale(0.995); }
.hlm-glam-service-table tbody tr:hover { box-shadow: 0 4px 16px rgba(15, 23, 42, 0.07); }
.hlm-glam-service-table tbody tr.hlm-glam-service-row-on {
  background: linear-gradient(90deg, #fdf2f8 0%, #fff 72%);
  box-shadow:
    0 0 0 1.5px rgba(236, 72, 153, 0.35),
    0 6px 20px rgba(219, 39, 119, 0.14);
}
.hlm-glam-service-table tbody tr td {
  border-top: 1px solid #eef2f7;
  border-bottom: 1px solid #eef2f7;
}
.hlm-glam-service-table tbody tr td:first-child {
  border-left: 1px solid #eef2f7;
  border-radius: 12px 0 0 12px;
}
.hlm-glam-service-table tbody tr td:last-child {
  border-right: 1px solid #eef2f7;
  border-radius: 0 12px 12px 0;
}
.hlm-glam-service-table tbody tr.hlm-glam-service-row-on td {
  border-color: rgba(249, 168, 212, 0.65);
}
.hlm-glam-service-table td {
  padding: 0.48rem 0.45rem;
  vertical-align: middle;
}
.hlm-glam-service-table td.hlm-glam-td-check {
  width: 2rem;
  padding-left: 0.5rem;
}
.hlm-glam-service-table input[type='checkbox'] {
  appearance: none;
  -webkit-appearance: none;
  width: 1.05rem;
  height: 1.05rem;
  margin: 0;
  cursor: pointer;
  border: 2px solid #cbd5e1;
  border-radius: 999px;
  background: #fff;
  display: inline-grid;
  place-content: center;
  vertical-align: middle;
  flex-shrink: 0;
  transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
}
.hlm-glam-service-table input[type='checkbox']:checked {
  background: linear-gradient(145deg, #db2777, #9d174d);
  border-color: #be185d;
  box-shadow: 0 2px 8px rgba(190, 24, 93, 0.35);
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
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 10px;
  background: linear-gradient(145deg, #fdf2f8, #fff);
  border: 1px solid #fce7f3;
  display: grid;
  place-items: center;
  font-size: 0.82rem;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(190, 24, 93, 0.08);
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
  gap: 0.45rem;
}
.hlm-glam-venue {
  position: relative;
  display: grid;
  align-content: end;
  border: 1.5px solid rgba(120, 53, 15, 0.12);
  border-radius: 14px;
  padding: 0;
  background: #fff;
  cursor: pointer;
  text-align: left;
  color: #0f172a;
  min-height: 5.65rem;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.12s;
}
.hlm-glam-venue:active { transform: scale(0.98); }
.hlm-glam-venue-on {
  border-color: #831843;
  box-shadow: 0 0 0 2px rgba(131, 24, 67, 0.22), 0 10px 28px rgba(76, 5, 25, 0.14);
}
.hlm-glam-venue-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}
.hlm-glam-venue-scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.08) 0%, rgba(76, 5, 25, 0.78) 100%);
}
.hlm-glam-venue-on .hlm-glam-venue-scrim {
  background: linear-gradient(180deg, rgba(131, 24, 67, 0.1) 0%, rgba(76, 5, 25, 0.86) 100%);
}
.hlm-glam-venue-copy {
  position: relative;
  z-index: 2;
  padding: 0.42rem 0.45rem 0.48rem;
  display: grid;
  gap: 0.12rem;
}
.hlm-glam-venue-emoji {
  font-size: 0.95rem;
  line-height: 1;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
}
.hlm-glam-venue-title { font-size: 0.72rem; font-weight: 900; display: block; color: #fff; line-height: 1.22; text-shadow: 0 2px 8px rgba(0,0,0,0.4); }
.hlm-glam-venue-hint { font-size: 0.58rem; font-weight: 700; color: rgba(255,255,255,0.92); display: block; line-height: 1.3; }
.hlm-glam-venue-est {
  display: inline-flex;
  align-items: center;
  margin-top: 0.2rem;
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #fff;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.35);
  width: fit-content;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
.hlm-glam-venue-on .hlm-glam-venue-est {
  background: rgba(255, 255, 255, 0.28);
  border-color: rgba(255, 255, 255, 0.5);
}
.hlm-glam-service-picker {
  display: grid;
  grid-template-columns: minmax(4.35rem, 5rem) minmax(0, 1fr);
  gap: 0.5rem;
  align-items: stretch;
  min-height: 0;
}
.hlm-glam-service-cats {
  display: grid;
  gap: 0.35rem;
  align-content: start;
  padding: 0.15rem 0;
}
.hlm-glam-service-cat {
  border: 1px solid #ece5dd;
  border-radius: 12px;
  padding: 0.42rem 0.3rem;
  min-height: 3rem;
  display: grid;
  place-items: center;
  gap: 0.08rem;
  background: #fff;
  cursor: pointer;
  font-family: inherit;
  color: #57534e;
  transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
}
.hlm-glam-service-cat-on {
  border-color: #831843;
  background: linear-gradient(165deg, #fff7fb 0%, #fff 100%);
  box-shadow: 0 0 0 1px rgba(131, 24, 67, 0.18);
  color: #831843;
}
.hlm-glam-service-cat-emoji { font-size: 1.02rem; line-height: 1; }
.hlm-glam-service-cat-label {
  font-size: 0.52rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: center;
  line-height: 1.15;
}
.hlm-glam-service-list {
  display: grid;
  gap: 0.4rem;
  overflow-y: auto;
  max-height: min(46vh, 19.5rem);
  padding: 0.15rem 0.1rem 0.2rem 0;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.hlm-glam-service-list::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.hlm-glam-service-cats {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.hlm-glam-service-cats::-webkit-scrollbar {
  display: none;
}
.hlm-glam-service-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.48rem 0.52rem;
  border-radius: 14px;
  border: 1px solid #ece5dd;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.12s, box-shadow 0.12s, transform 0.1s;
}
.hlm-glam-service-card:active { transform: scale(0.995); }
.hlm-glam-service-card-on {
  border-color: #831843;
  background: linear-gradient(90deg, #fff7fb 0%, #fff 80%);
  box-shadow: 0 0 0 1px rgba(131, 24, 67, 0.2), 0 6px 18px rgba(76, 5, 25, 0.08);
}
.hlm-glam-service-thumb {
  width: 3.05rem;
  height: 3.05rem;
  border-radius: 12px;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(76, 5, 25, 0.12);
}
.hlm-glam-service-card-copy {
  min-width: 0;
  display: grid;
  gap: 0.08rem;
}
.hlm-glam-service-card-title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 900;
  color: #1c1917;
  line-height: 1.2;
}
.hlm-glam-service-card-detail {
  margin: 0;
  font-size: 0.64rem;
  font-weight: 600;
  color: #78716c;
  line-height: 1.3;
}
.hlm-glam-service-card-end {
  display: grid;
  justify-items: end;
  gap: 0.22rem;
}
.hlm-glam-service-card-price {
  font-size: 0.82rem;
  font-weight: 900;
  color: #9d174d;
  white-space: nowrap;
}
.hlm-glam-service-card input[type='checkbox'] {
  appearance: none;
  -webkit-appearance: none;
  width: 1.12rem;
  height: 1.12rem;
  margin: 0;
  cursor: pointer;
  border: 2px solid #cbd5e1;
  border-radius: 999px;
  background: #fff;
  display: inline-grid;
  place-content: center;
}
.hlm-glam-service-card input[type='checkbox']:checked {
  background: linear-gradient(145deg, #831843, #4c0519);
  border-color: #831843;
}
.hlm-glam-service-card input[type='checkbox']:checked::after {
  content: '';
  width: 0.28rem;
  height: 0.55rem;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) translate(-0.5px, -1px);
}
@media (max-width: 720px) {
  .hlm-glam-service-picker {
    grid-template-columns: 1fr;
    min-height: 0;
    gap: 0.5rem;
  }
  .hlm-glam-service-cats {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 0.4rem;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
    padding: 0.05rem 0 0.15rem;
  }
  .hlm-glam-service-cat {
    flex: 0 0 auto;
    min-width: 4.85rem;
    min-height: 2.85rem;
    scroll-snap-align: start;
  }
  .hlm-glam-service-list {
    max-height: none;
    overflow: visible;
  }
}
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
select.hlm-glam-field {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 2.35rem;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23be185d' d='M3 4.5 6 7.5 9 4.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-color: #fff;
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
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.hlm-glam-slots::-webkit-scrollbar {
  display: none;
}
.hlm-glam-slot {
  flex: 0 0 auto;
  min-height: 38px;
  padding: 0 0.75rem;
  border-radius: 999px;
  border: 1.5px solid #e2e8f0;
  background-color: #ffffff;
  font-size: 0.72rem;
  font-weight: 800;
  color: #111827;
  -webkit-text-fill-color: #111827;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06);
  transition: border-color 0.12s, box-shadow 0.12s, transform 0.1s;
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
  scroll-margin-bottom: calc(var(--tabbar-h) + var(--glam-dock-h, 12.5rem) + 1rem);
}
.hlm-glam-scroll-end {
  height: calc(var(--glam-dock-h, 12.5rem) * 0.35);
  flex-shrink: 0;
  pointer-events: none;
}
@media (min-width: 640px) {
  .hlm-glam-extras-grid { grid-template-columns: 1fr 1fr; align-items: start; }
}
.hlm-glam-panel[aria-label='Services'],
.hlm-glam-panel[aria-label='Occasion'] {
  scroll-margin-bottom: calc(var(--tabbar-h) + var(--glam-dock-h, 12.5rem) + 1rem);
}
.hlm-glam-photo {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 4.75rem;
  border-radius: 14px;
  border: 2px dashed rgba(131, 24, 67, 0.42);
  background-image:
    linear-gradient(135deg, rgba(76, 5, 25, 0.42) 0%, rgba(76, 5, 25, 0.28) 100%),
    var(--glam-ref-upload-bg);
  background-size: cover;
  background-position: center;
  color: #fff;
  font-size: 0.74rem;
  font-weight: 900;
  cursor: pointer;
  text-align: center;
  padding: 0.45rem;
  text-shadow: 0 2px 10px rgba(76, 5, 25, 0.65);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.25);
}
.hlm-glam-photo-on {
  position: relative;
  border-style: solid;
  border-color: #db2777;
  background: #1a0510;
  padding: 0;
  overflow: hidden;
  color: #fff;
}
.hlm-glam-photo-preview {
  display: block;
  width: 100%;
  min-height: 5.25rem;
  max-height: 9rem;
  object-fit: cover;
  object-position: center;
}
.hlm-glam-photo-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0.35rem 0.5rem;
  font-size: 0.68rem;
  font-weight: 800;
  text-align: center;
  background: linear-gradient(180deg, transparent 0%, rgba(76, 5, 25, 0.88) 68%);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
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
@media (max-width: 379px) {
  .hlm-glam-occasions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hlm-glam-occasion { aspect-ratio: 5 / 3; }
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
  padding: 0.35rem var(--shell-pad) 0.45rem;
  z-index: 40;
  pointer-events: none;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}
.hlm-glam-dock-wrap > * { pointer-events: auto; }
.hlm-glam-dock-card {
  width: 100%;
  max-width: var(--shell-max);
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  gap: 0.55rem;
  padding: 0.55rem 0.55rem 0.55rem 0.6rem;
  border-radius: 22px;
  overflow: hidden;
  min-width: 0;
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
.hlm-glam-dock-fee-hint {
  margin: 0.15rem 0 0;
  font-size: 0.58rem;
  font-weight: 600;
  color: #9d174d;
  line-height: 1.3;
}
.hlm-glam-price-waived {
  font-weight: 800;
  color: #047857;
}
.hlm-glam-venue-price-note {
  margin: 0.1rem 0 0;
  padding: 0.4rem 0.55rem;
  border-radius: 10px;
  font-size: 0.66rem;
  font-weight: 700;
  line-height: 1.35;
  color: #831843;
  background: linear-gradient(135deg, #fdf2f8 0%, #fff 100%);
  border: 1px solid rgba(251, 207, 232, 0.85);
}
.hlm-glam-dock-lines {
  display: grid;
  gap: 0.2rem;
  padding: 0.45rem 0.5rem;
  border-radius: 14px;
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(252, 231, 243, 0.9);
  box-shadow: 0 1px 0 rgba(255,255,255,0.8) inset;
  min-width: 0;
  overflow: hidden;
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
.hlm-glam-dock-lines .hlm-glam-dock-meta-chip {
  margin-top: 0.12rem;
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
@media (max-width: 380px) {
  .hlm-glam-dock-card {
    gap: 0.4rem;
    padding: 0.5rem 0.45rem 0.5rem 0.5rem;
  }
  .hlm-glam-dock-cta {
    min-width: 4.85rem;
    padding: 0 0.75rem;
    font-size: 0.72rem;
  }
  .hlm-glam-price-total-value { font-size: 1rem; }
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
  const [referencePhotoPreviewUrl, setReferencePhotoPreviewUrl] = useState<string | null>(null);
  const referencePreviewObjectUrlRef = useRef<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [prepayMode, setPrepayMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [confirming, setConfirming] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'idle' | 'booking' | 'checkout' | 'paying'>('idle');
  const [workGalleryArtistId, setWorkGalleryArtistId] = useState<string | null>(null);
  const [serviceCategory, setServiceCategory] = useState<'POPULAR' | BeautyServiceCategoryId>('POPULAR');
  const bookingDockRef = useRef<HTMLDivElement | null>(null);
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
    if (!beautyEnabled || !beautyReady) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = GLAM_HERO_IMAGE;
    link.fetchPriority = 'high';
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [beautyEnabled, beautyReady]);

  useEffect(() => {
    setServiceCategory('POPULAR');
  }, [artistId]);

  useEffect(() => {
    return () => {
      if (referencePreviewObjectUrlRef.current) {
        URL.revokeObjectURL(referencePreviewObjectUrlRef.current);
        referencePreviewObjectUrlRef.current = null;
      }
    };
  }, []);

  const filteredServiceRates = useMemo(() => {
    if (!offeredRates.length) return [];
    if (serviceCategory === 'POPULAR') return offeredRates;
    const allowed = new Set<string>(beautyServicesInCategory(serviceCategory).map((row) => row.id));
    return offeredRates.filter((row) => allowed.has(row.serviceType));
  }, [offeredRates, serviceCategory]);

  useEffect(() => {
    if (!offeredRates.length) {
      setSelectedServices([]);
      return;
    }
    setSelectedServices((prev) => prev.filter((id) => offeredRates.some((r) => r.serviceType === id)));
  }, [artistId, offeredRates]);

  const chosenRates = offeredRates.filter((row) => selectedServices.includes(row.serviceType));
  const homeVisitFee = resolveHomeVisitCharge(artist);
  const servicePrice = chosenRates.reduce((sum, row) => sum + Number(row.unitPrice || 0), 0);
  const totalMinutes = chosenRates.reduce((sum, row) => sum + Number(row.durationMinutes || 60), 0);
  const platformFee = servicePrice > 0 ? Number(townPlatformFee || 0) : 0;
  const travel = venue === 'AT_HOME' ? homeVisitFee : 0;
  const baseTotal = servicePrice + travel + platformFee;
  const minPrepay = Math.max(
    0,
    townMinPrepay > 0 ? townMinPrepay : Number(artist?.bookingMinPrepayAmount ?? 0),
  );
  const parlourFee =
    prepayMode === 'PARTIAL' && venue === 'AT_STUDIO' ? Math.max(0, townParlourFee) : 0;
  const total = baseTotal + parlourFee;
  const parlourForVenueCompare = prepayMode === 'PARTIAL' ? parlourFee : 0;
  const homeVenueTotal = glamVenuePayEstimate('AT_HOME', {
    servicePrice,
    homeVisitFee,
    platformFee,
    parlourFee: parlourForVenueCompare,
  });
  const studioVenueTotal = glamVenuePayEstimate('AT_STUDIO', {
    servicePrice,
    homeVisitFee,
    platformFee,
    parlourFee: parlourForVenueCompare,
  });
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
  const showBookingDock = Boolean(artist && chosenRates.length > 0 && servicePrice > 0);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!showBookingDock) {
      root.style.removeProperty('--glam-dock-h');
      return;
    }
    const node = bookingDockRef.current;
    if (!node) return;
    const syncDockHeight = () => {
      const height = Math.ceil(node.getBoundingClientRect().height);
      if (height > 0) root.style.setProperty('--glam-dock-h', `${height}px`);
    };
    syncDockHeight();
    const observer = new ResizeObserver(syncDockHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [showBookingDock, venue, homeVisitFee, travel, platformFee, chosenRates.length, totalMinutes, parlourFee, prepayMode]);

  useEffect(() => {
    return () => document.documentElement.style.removeProperty('--glam-dock-h');
  }, []);

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

  function PriceBreakdown({ sheet, dockMeta }: { sheet?: boolean; dockMeta?: string }) {
    const wrapClass = sheet ? 'hlm-glam-sheet-receipt' : 'hlm-glam-dock-lines';
    const dockTotal = total;
    return (
      <div className={wrapClass} aria-label="Price breakdown">
        {sheet || (!sheet && servicePrice > 0) ? (
          <div className="hlm-glam-price-row">
            <span>Services</span>
            <span>{money(servicePrice)}</span>
          </div>
        ) : null}
        {platformFee > 0 ? (
          <div className="hlm-glam-price-row hlm-glam-price-row--fee">
            <span>Platform fee</span>
            <span>{money(platformFee)}</span>
          </div>
        ) : null}
        {sheet && travel > 0 ? (
          <div className="hlm-glam-price-row">
            <span>Home visit</span>
            <span>{money(travel)}</span>
          </div>
        ) : null}
        {!sheet && homeVisitFee > 0 ? (
          <div className="hlm-glam-price-row">
            <span>{venue === 'AT_HOME' ? 'Home visit' : 'Travel at studio'}</span>
            <span className={venue === 'AT_STUDIO' ? 'hlm-glam-price-waived' : undefined}>
              {venue === 'AT_STUDIO' ? '₹0' : money(homeVisitFee)}
            </span>
          </div>
        ) : null}
        {parlourFee > 0 ? (
          <div className="hlm-glam-price-row">
            <span>Pay-at-parlour</span>
            <span>{money(parlourFee)}</span>
          </div>
        ) : null}
        <div className="hlm-glam-price-total-row">
          <span className="hlm-glam-price-total-label">{sheet ? 'Total' : 'Est. total'}</span>
          <span className="hlm-glam-price-total-value" key={`${venue}-${travel}-${dockTotal}`}>
            {money(sheet ? total : dockTotal)}
          </span>
        </div>
        {!sheet && dockMeta ? <span className="hlm-glam-dock-meta-chip">{dockMeta}</span> : null}
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

  const glamBookingUi = Boolean(session && beautyReady && beautyEnabled && !loading);

  return (
    <PortalShell
      title="Koya Glam"
      subtitle={hasTown ? `${townLabel} · makeup & styling` : 'Choose your town'}
      hideTitle={glamBookingUi}
      showDeliveryBanner={false}
      showStickyCart={false}
      footerSlot={
        showBookingDock ? (
          <div ref={bookingDockRef} className="hlm-glam-dock-wrap" key={`glam-dock-${venue}-${total}`}>
            <div className="hlm-glam-dock-card">
              <div className="hlm-glam-dock-receipt">
                <PriceBreakdown
                  dockMeta={`${chosenRates.length} service${chosenRates.length === 1 ? '' : 's'} · ${totalMinutes} min · ${venue === 'AT_HOME' ? 'At home' : 'At studio'}`}
                />
              </div>
              <button
                type="button"
                className="hlm-glam-dock-cta"
                disabled={busy || !canBook}
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

      {glamBookingUi ? (
        <div
          className="hlm-glam-root"
          style={{ ['--glam-ref-upload-bg' as string]: `url("${GLAM_REFERENCE_UPLOAD_BACKDROP}")` }}
        >
          <div className="hlm-glam-hero">
            <div className="hlm-glam-hero-photo-wrap" aria-hidden>
              <img
                className="hlm-glam-hero-photo"
                src={GLAM_HERO_IMAGE}
                srcSet={GLAM_HERO_SRCSET}
                sizes={GLAM_HERO_SIZES}
                alt=""
                width={480}
                height={640}
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
              <div className="hlm-glam-hero-photo-fade" />
            </div>
            <div className="hlm-glam-hero-deco" aria-hidden />
            <div className="hlm-glam-hero-body">
              <span className="hlm-glam-hero-kicker">
                {hasTown ? `${townLabel} · Koya Glam` : 'Koya Glam'}
              </span>
              <h2>Look your best, close to home</h2>
              <p>Book trusted local makeup artists — at home or at their studio — with the same app you use for groceries.</p>
              <div className="hlm-glam-trust">
                <span>Verified artists</span>
                <span>Home or studio</span>
                <span>UPI &amp; cash</span>
              </div>
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
                  {artists.map((row) => {
                    const coverSrc = artistCoverImage(row.workPhotos?.[0]?.url, 520);
                    const livePortfolio = (row.workPhotos?.length ?? 0) > 0;
                    return (
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
                        <div className="hlm-glam-artist-cover">
                          <img src={coverSrc} alt="" width={520} height={340} loading="lazy" decoding="async" />
                          {livePortfolio ? (
                            <span className="hlm-glam-artist-cover-badge">Live portfolio</span>
                          ) : null}
                        </div>
                        <div className="hlm-glam-artist-body">
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
                            {row.yearsExperience ? <span>{row.yearsExperience}+ yrs</span> : null}
                          </p>
                          <p className={`hlm-glam-artist-tag${row.tagline ? '' : ' hlm-glam-artist-tag--empty'}`}>
                            {row.tagline || 'Tagline'}
                          </p>
                          <div className="hlm-glam-artist-work-slot">
                            {livePortfolio ? (
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
                      </div>
                    );
                  })}
                  <div className="hlm-glam-artists-tail" aria-hidden />
                </div>
              </div>
            )}
            {artist && token ? (
              <GlamCustomerReviewsPanel
                token={token}
                vendorId={artist.vendorId}
                artistName={artistDisplayName(artist)}
                preview={artist.customerReviews}
              />
            ) : null}
          </div>

          {artist ? (
            <>
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
                        <img
                          className="hlm-glam-venue-photo"
                          src={glamVenueImage(row.id, 520)}
                          alt=""
                          width={520}
                          height={322}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (img.dataset.fallback === '1') return;
                            img.dataset.fallback = '1';
                            img.src = GLAM_VENUE_FALLBACK_IMAGE;
                          }}
                        />
                        <span className="hlm-glam-venue-scrim" aria-hidden />
                        <span className="hlm-glam-venue-copy">
                          <span className="hlm-glam-venue-emoji" aria-hidden>
                            {row.emoji}
                          </span>
                          <span className="hlm-glam-venue-title">{row.label}</span>
                          <span className="hlm-glam-venue-hint">
                            {row.hint}
                            {row.id === 'AT_HOME' && homeVisitFee > 0
                              ? ` · +${money(homeVisitFee)} travel`
                              : ''}
                            {row.id === 'AT_STUDIO' && homeVisitFee > 0
                              ? ` · Save ${money(homeVisitFee)} vs home`
                              : ''}
                          </span>
                          {servicePrice > 0 ? (
                            <span className="hlm-glam-venue-est">
                              Est.{' '}
                              {money(
                                row.id === 'AT_HOME'
                                  ? homeVenueTotal
                                  : studioVenueTotal,
                              )}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>
                  {servicePrice > 0 && homeVisitFee > 0 ? (
                    <p className="hlm-glam-venue-price-note" role="status">
                      {venue === 'AT_HOME'
                        ? `At home est. ${money(homeVenueTotal)} (incl. ${money(homeVisitFee)} travel). Studio est. ${money(studioVenueTotal)}.`
                        : `At studio est. ${money(studioVenueTotal)}. At home would be ${money(homeVenueTotal)} (${money(homeVisitFee)} travel).`}
                    </p>
                  ) : null}
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
                  <div className="hlm-glam-service-picker">
                    <div className="hlm-glam-service-cats hlm-hide-scrollbar" role="tablist" aria-label="Service categories">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={serviceCategory === 'POPULAR'}
                        className={`hlm-glam-service-cat${serviceCategory === 'POPULAR' ? ' hlm-glam-service-cat-on' : ''}`}
                        onClick={() => setServiceCategory('POPULAR')}
                      >
                        <span className="hlm-glam-service-cat-emoji" aria-hidden>
                          ⭐
                        </span>
                        <span className="hlm-glam-service-cat-label">Popular</span>
                      </button>
                      {BEAUTY_SERVICE_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          role="tab"
                          aria-selected={serviceCategory === cat.id}
                          className={`hlm-glam-service-cat${serviceCategory === cat.id ? ' hlm-glam-service-cat-on' : ''}`}
                          onClick={() => setServiceCategory(cat.id)}
                        >
                          <span className="hlm-glam-service-cat-emoji" aria-hidden>
                            {cat.emoji}
                          </span>
                          <span className="hlm-glam-service-cat-label">{cat.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="hlm-glam-service-list hlm-hide-scrollbar" role="tabpanel">
                      {filteredServiceRates.length === 0 ? (
                        <p className="hlm-glam-section-sub" style={{ margin: 0 }}>
                          No services in this category for this artist. Try another tab.
                        </p>
                      ) : (
                        filteredServiceRates.map((row) => {
                          const on = selectedServices.includes(row.serviceType);
                          const catalog = BEAUTY_SERVICES.find((s) => s.id === row.serviceType);
                          const label = rateLabel(row);
                          const detail = row.hint || catalog?.hint || `${row.durationMinutes} min`;
                          return (
                            <div
                              key={row.serviceType}
                              className={`hlm-glam-service-card${on ? ' hlm-glam-service-card-on' : ''}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleService(row.serviceType)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleService(row.serviceType);
                                }
                              }}
                            >
                              <img
                                className="hlm-glam-service-thumb"
                                src={glamServiceImage(row.serviceType, 120)}
                                alt=""
                                width={120}
                                height={120}
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  if (img.dataset.fallback === '1') return;
                                  img.dataset.fallback = '1';
                                  img.src = GLAM_SERVICE_FALLBACK_IMAGE;
                                }}
                              />
                              <div className="hlm-glam-service-card-copy">
                                <p className="hlm-glam-service-card-title">{label}</p>
                                <p className="hlm-glam-service-card-detail">{detail}</p>
                              </div>
                              <div className="hlm-glam-service-card-end">
                                <span className="hlm-glam-service-card-price">{money(row.unitPrice)}</span>
                                <input
                                  type="checkbox"
                                  checked={on}
                                  aria-label={`${label}, ${money(row.unitPrice)}`}
                                  onChange={() => toggleService(row.serviceType)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
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
                      style={{ backgroundColor: row.tint }}
                      onClick={() => setOccasion(row.id)}
                    >
                      <img
                        className="hlm-glam-occasion-photo"
                        src={glamOccasionImage(row.id, 360)}
                        alt=""
                        width={360}
                        height={238}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.dataset.fallback === '1') return;
                          img.dataset.fallback = '1';
                          img.src = GLAM_OCCASION_FALLBACK_IMAGE;
                        }}
                      />
                      <span className="hlm-glam-occasion-scrim" aria-hidden />
                      <span className="hlm-glam-occasion-copy">
                        <span className="hlm-glam-occasion-emoji" aria-hidden>
                          {row.emoji}
                        </span>
                        <span className="hlm-glam-occasion-label">{row.label}</span>
                      </span>
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
                  <label
                    className={
                      referencePhotoPreviewUrl ? 'hlm-glam-photo hlm-glam-photo-on' : 'hlm-glam-photo'
                    }
                  >
                    {referencePhotoPreviewUrl ? (
                      <>
                        <img
                          className="hlm-glam-photo-preview"
                          src={referencePhotoPreviewUrl}
                          alt="Your reference look"
                        />
                        <span className="hlm-glam-photo-caption">
                          {photoBusy ? 'Uploading…' : 'Tap to replace photo'}
                        </span>
                      </>
                    ) : photoBusy ? (
                      'Uploading…'
                    ) : (
                      '📷 Add inspiration photo'
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={photoBusy || !token}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file || !token) return;
                        if (referencePreviewObjectUrlRef.current) {
                          URL.revokeObjectURL(referencePreviewObjectUrlRef.current);
                        }
                        const blobUrl = URL.createObjectURL(file);
                        referencePreviewObjectUrlRef.current = blobUrl;
                        setReferencePhotoPreviewUrl(blobUrl);
                        setPhotoBusy(true);
                        setError(null);
                        void uploadBeautyReferencePhoto(token, file)
                          .then(({ mediaId, url }) => {
                            setReferencePhotoMediaId(mediaId);
                            const nextUrl = url?.trim() || blobUrl;
                            if (url?.trim() && referencePreviewObjectUrlRef.current === blobUrl) {
                              URL.revokeObjectURL(blobUrl);
                              referencePreviewObjectUrlRef.current = null;
                            }
                            setReferencePhotoPreviewUrl(nextUrl);
                          })
                          .catch((err) => {
                            setReferencePhotoPreviewUrl(null);
                            setReferencePhotoMediaId(undefined);
                            if (referencePreviewObjectUrlRef.current) {
                              URL.revokeObjectURL(referencePreviewObjectUrlRef.current);
                              referencePreviewObjectUrlRef.current = null;
                            }
                            setError(err instanceof Error ? err.message : 'Photo upload failed');
                          })
                          .finally(() => setPhotoBusy(false));
                      }}
                    />
                  </label>
                </div>
              </div>
              {showBookingDock ? <div className="hlm-glam-scroll-end" aria-hidden /> : null}
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
