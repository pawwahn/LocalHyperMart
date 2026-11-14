import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ConfirmDialog } from '@/shared/ui';
import {
  diagnosticsSamplePhotos,
  MAX_DIAGNOSTICS_SAMPLE_PHOTOS,
  type DiagnosticsPortalProfile,
  type DiagnosticsStaffRow,
  type DiagnosticsVendorOrder,
} from '../api/diagnosticsApi';
import { DiagnosticsVisitMap } from './DiagnosticsVisitMap';
import { DiagnosticsVisitTimeline } from './DiagnosticsVisitTimeline';
import { DiagnosticsOrderSettlementPanel } from './DiagnosticsOrderSettlementPanel';
import type { DiagnosticsBillingTerms } from '../lib/diagnosticsVendorFees';
import { parseHandoffNameFromNote, timelineEvents } from '../lib/diagnosticsVisitEventLog';

export function money(n: number): string {
  return `₹${Number(n || 0).toFixed(0)}`;
}

/** Strip literal "null" and tidy spacing from API-assembled address strings. */
export function cleanDisplayText(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  return raw
    .replace(/\bnull\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*·\s*·+/g, ' · ')
    .replace(/^\s*·\s*/, '')
    .replace(/\s*·\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function formatSlotRange(
  slotStart: string | null | undefined,
  slotEnd: string | null | undefined,
): string | null {
  if (!slotStart?.trim() && !slotEnd?.trim()) return null;
  try {
    const s = slotStart ? new Date(slotStart) : null;
    const e = slotEnd ? new Date(slotEnd) : null;
    if (s && !Number.isNaN(s.getTime())) {
      const datePart = s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      if (e && !Number.isNaN(e.getTime())) {
        return `${datePart} · ${time(s)} – ${time(e)}`;
      }
      return `${datePart} · ${time(s)}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function vendorOrderPayable(o: DiagnosticsVendorOrder): number {
  if (o.totalAmount != null && Number.isFinite(Number(o.totalAmount))) {
    return Number(o.totalAmount);
  }
  return (
    Number(o.testsSubtotal || 0) +
    Number(o.homeCollectionFee || 0) +
    Number(o.platformFeeAmount || 0) +
    Number(o.codFee || 0)
  );
}

/** Anyone flagged for home visits (incl. collection-capable managers). Lab bench hand-off stays on RECEIVED_AT_LAB. */
function isHomeVisitAssignable(member: DiagnosticsStaffRow): boolean {
  return member.active && member.collectionCapable;
}

function homeVisitAssignOptionLabel(member: DiagnosticsStaffRow): string {
  const title = String(member.title ?? '').toUpperCase();
  if (!title || title === 'COLLECTION_AGENT') return member.displayName;
  if (title === 'MANAGER') return `${member.displayName} (Manager)`;
  if (title === 'LAB_TECHNICIAN') return `${member.displayName} (Lab tech)`;
  return member.displayName;
}

function collectorDisplayName(
  order: DiagnosticsVendorOrder,
  staffList: DiagnosticsPortalProfile['staff'] | undefined,
  selfStaffId?: string | null,
  selfDisplayName?: string | null,
): string | null {
  if (!order.assignedStaffId) return null;
  if (selfStaffId && order.assignedStaffId === selfStaffId) {
    return selfDisplayName?.trim() || 'You';
  }
  const fromOrder = order.assignedStaffName?.trim();
  if (fromOrder) return fromOrder;
  const fromStaff = (staffList ?? []).find((s) => s.id === order.assignedStaffId)?.displayName?.trim();
  if (fromStaff) return fromStaff;
  return `Staff ${String(order.assignedStaffId).slice(0, 8)}…`;
}

/** Who received the sample bag (order fields, staff list, or hand-off event note). */
function labHandoffRecipientName(
  order: DiagnosticsVendorOrder,
  staff?: DiagnosticsStaffRow[],
): string | null {
  const direct = order.receivedByStaffName?.trim();
  if (direct) return direct;
  const id = order.receivedByStaffId;
  if (id && staff?.length) {
    const hit = staff.find((s) => s.id === id);
    if (hit?.displayName?.trim()) return hit.displayName.trim();
  }
  for (const ev of order.events ?? []) {
    if (String(ev.eventType ?? '').toUpperCase() !== 'RECEIVED_AT_LAB') continue;
    const fromNote = parseHandoffNameFromNote(ev.note);
    if (fromNote) return fromNote;
  }
  return null;
}

function orderPastLabHandoff(status: string): boolean {
  const s = status.toUpperCase();
  return (
    s === 'RECEIVED_AT_LAB' ||
    s === 'REPORT_ETA_SET' ||
    s === 'REPORT_IN_PROGRESS' ||
    s === 'REPORT_FINALIZED' ||
    s === 'COMPLETED'
  );
}

function paymentMethodKind(raw: string | null | undefined): 'online' | 'cod' | 'other' {
  const u = String(raw ?? '').toUpperCase();
  if (/^(UPI|ONLINE)$/.test(u)) return 'online';
  if (/^(COD|CASH)$/.test(u)) return 'cod';
  return 'other';
}

/** Same as settlement registry: payout once samples are received at the lab. */
function diagnosticsPayoutEligible(status: string | null | undefined): boolean {
  const u = String(status ?? '').toUpperCase();
  return (
    u === 'RECEIVED_AT_LAB' ||
    u === 'REPORT_ETA_SET' ||
    u === 'REPORT_IN_PROGRESS' ||
    u === 'REPORT_FINALIZED' ||
    u === 'COMPLETED'
  );
}

export type LabBenchFooterContext = {
  /** Lab tech opened every sample photo thumbnail (cross-check). */
  allSamplePhotosViewed: boolean;
};

function paymentHint(order: DiagnosticsVendorOrder): { short: string; line: string; tone: 'cash' | 'paid' | 'hold' } {
  const kind = paymentMethodKind(order.paymentMethod);
  const pay = String(order.paymentStatus ?? '').toUpperCase();
  const amount = money(vendorOrderPayable(order));
  if (kind === 'cod') {
    if (pay === 'COLLECTED' || pay === 'PAID') {
      const billNote = diagnosticsPayoutEligible(order.status)
        ? ' Fee bill to KoyaKart is ready — see Payouts.'
        : ' Fee bill to KoyaKart after samples are received at the lab bench.';
      return {
        short: `Cash collected ${amount}`,
        line: `Cash collected · ${amount}. Do not take more money.${billNote}`,
        tone: 'paid',
      };
    }
    return { short: `Collect cash ${amount}`, line: `Collect cash ${amount} at this visit (COD).`, tone: 'cash' };
  }
  if (kind === 'online') {
    if (pay === 'PAID' || pay === 'COLLECTED') {
      const payoutNote = diagnosticsPayoutEligible(order.status)
        ? ' KoyaKart payout is ready — see Payouts.'
        : ' Do not collect cash. KoyaKart pays your lab after samples are received at the lab bench.';
      return {
        short: `Already paid ${amount}`,
        line: `Buyer paid KoyaKart online · ${amount}.${payoutNote}`,
        tone: 'paid',
      };
    }
    if (pay === 'FAILED') {
      return { short: 'Online payment failed', line: 'Online payment failed. Do not collect cash until the buyer pays.', tone: 'hold' };
    }
    return { short: 'Online payment pending', line: `Online payment pending · ${amount}. Do not collect cash.`, tone: 'hold' };
  }
  return { short: amount, line: `Amount ${amount}.`, tone: 'paid' };
}

type Props = {
  orders: DiagnosticsVendorOrder[];
  staff?: DiagnosticsPortalProfile['staff'];
  onAssign?: (orderId: string, assignedStaffId: string, assignedStaffName: string) => void;
  /** When false, no row shows the assign control (e.g. lab overview). When true, each row uses {@link DiagnosticsVendorOrder.allowedActions} to allow ASSIGN. */
  canDispatch: boolean;
  /** Prefix for assign &lt;select&gt; ids (avoid duplicate ids if two lists mount). */
  idPrefix?: string;
  /** Extra actions under the card (lab desk, visits, etc.). */
  renderFooter?: (order: DiagnosticsVendorOrder, ctx: LabBenchFooterContext) => ReactNode;
  selfStaffId?: string | null;
  selfDisplayName?: string | null;
  onRemovePhoto?: (orderId: string, mediaId: string) => Promise<boolean | void>;
  /** One expanded card at a time; all start minimized (My visits). */
  singleExpanded?: boolean;
  expandedOrderId?: string | null;
  onExpandedOrderIdChange?: (orderId: string | null) => void;
  /** History / archive cards — no map controls. */
  hideMaps?: boolean;
  /** Vendor billing terms — shows GMV / commission like grocery Payouts. */
  billing?: DiagnosticsBillingTerms | null;
};

/**
 * Shared dispatch UI for booked home collections — Seller home and Diagnostics → Dispatch.
 */
export function DiagnosticsDispatchOrderCards({
  orders,
  staff,
  onAssign,
  canDispatch,
  idPrefix = 'dispatch',
  renderFooter,
  selfStaffId,
  selfDisplayName,
  onRemovePhoto,
  singleExpanded = false,
  expandedOrderId: expandedOrderIdProp,
  onExpandedOrderIdChange,
  hideMaps = false,
  billing = null,
}: Props) {
  const [internalExpandedOrderId, setInternalExpandedOrderId] = useState<string | null>(null);
  const expansionControlled = singleExpanded && onExpandedOrderIdChange != null;
  const expandedOrderId = expansionControlled ? (expandedOrderIdProp ?? null) : internalExpandedOrderId;
  const setExpandedOrderId = expansionControlled ? onExpandedOrderIdChange : setInternalExpandedOrderId;

  useEffect(() => {
    if (!expansionControlled) {
      setInternalExpandedOrderId(null);
    }
  }, [idPrefix, expansionControlled]);

  return (
    <ul style={styles.orderList} className="hlm-row-stripe-list">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          staff={staff}
          onAssign={onAssign}
          canDispatch={canDispatch}
          idPrefix={idPrefix}
          renderFooter={renderFooter}
          selfStaffId={selfStaffId}
          selfDisplayName={selfDisplayName}
          onRemovePhoto={onRemovePhoto}
          singleExpanded={singleExpanded}
          isExpanded={singleExpanded ? expandedOrderId === order.id : undefined}
          onExpandChange={
            singleExpanded
              ? (next) => setExpandedOrderId(next ? order.id : null)
              : undefined
          }
          hideMaps={hideMaps}
          billing={billing}
        />
      ))}
    </ul>
  );
}

function OrderCard({
  order,
  staff,
  onAssign,
  canDispatch,
  idPrefix,
  renderFooter,
  selfStaffId,
  selfDisplayName,
  onRemovePhoto,
  singleExpanded = false,
  isExpanded,
  onExpandChange,
  hideMaps = false,
  billing = null,
}: Omit<Props, 'orders'> & {
  order: DiagnosticsVendorOrder;
  idPrefix: string;
  isExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}) {
  const [localMinimized, setLocalMinimized] = useState(false);
  const minimized = singleExpanded ? !isExpanded : localMinimized;
  const [showMap, setShowMap] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ mediaId: string; url: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [viewedPhotoIds, setViewedPhotoIds] = useState<Set<string>>(() => new Set());
  const payable = money(vendorOrderPayable(order));
  const address = cleanDisplayText(order.addressText);
  const slotLabel = formatSlotRange(order.slotStart, order.slotEnd);
  const statusUpper = String(order.status ?? '').toUpperCase();
  const payUpper = String(order.paymentStatus ?? '').toUpperCase();
  const methodKind = paymentMethodKind(order.paymentMethod);
  const payHint = paymentHint(order);
  const paymentAwaitingOnline =
    statusUpper === 'AWAITING_PAYMENT' && methodKind === 'online' && payUpper !== 'PAID';
  const onlinePaymentFailed =
    statusUpper === 'AWAITING_PAYMENT' && methodKind === 'online' && payUpper === 'FAILED';
  const showPaymentHoldPill = paymentAwaitingOnline || onlinePaymentFailed;
  const showAssignRow = Boolean(canDispatch && onAssign && (order.allowedActions ?? []).includes('ASSIGN'));
  const phone = order.contactPhone?.trim();
  const collectorName = collectorDisplayName(order, staff, selfStaffId, selfDisplayName);
  const hasRoute = Boolean(slotLabel || address);
  const selectId = `${idPrefix}-assign-${order.id}`;
  const statusPillStyle = showPaymentHoldPill ? styles.pillHold : styles.pill;
  const tests = (order.lines ?? []).map((l) => l.testName?.trim()).filter(Boolean);
  const photos = diagnosticsSamplePhotos(order);
  const photoIdsKey = photos.map((p) => p.mediaId).join('|');
  useEffect(() => {
    setViewedPhotoIds(new Set());
  }, [order.id, photoIdsKey]);
  const needsSamplePhotoCrossCheck =
    (order.allowedActions ?? []).includes('CONFIRM_SAMPLES_RECEIVED') && photos.length > 0;
  const allSamplePhotosViewed =
    !needsSamplePhotoCrossCheck || photos.every((p) => viewedPhotoIds.has(p.mediaId));
  const eventRows = timelineEvents(order.events);
  const handoffName = labHandoffRecipientName(order, staff);
  const showHandoff = Boolean(handoffName) && orderPastLabHandoff(statusUpper);
  const canRemovePhoto =
    Boolean(onRemovePhoto) && (order.allowedActions ?? []).includes('REMOVE_SAMPLE_PHOTO');

  return (
          <li style={styles.orderCard} className="hlm-row-stripe">
            <div style={styles.orderHead}>
              <span style={styles.orderId}>{order.orderNumber}</span>
              <div style={styles.headActions}>
                {!hideMaps ? (
                  <button
                    type="button"
                    style={styles.headBtn}
                    onClick={() => setShowMap((v) => !v)}
                    disabled={!address}
                  >
                    {showMap ? 'Hide maps' : 'Show maps'}
                  </button>
                ) : null}
                <button
                  type="button"
                  style={styles.headBtn}
                  onClick={() => {
                    if (singleExpanded && onExpandChange) {
                      onExpandChange(minimized);
                    } else {
                      setLocalMinimized((v) => !v);
                    }
                  }}
                >
                  {minimized ? 'Expand' : 'Minimize'}
                </button>
                <span style={statusPillStyle}>{order.statusLabel}</span>
              </div>
            </div>
            {minimized ? (
              <p style={styles.miniLine}>
                <strong>{order.patientName || 'Patient'}</strong>
                {phone ? ` · ${phone}` : ''}
                {slotLabel ? ` · ${slotLabel}` : ''}
                {` · ${payHint.short}`}
                {showHandoff ? (
                  <>
                    {' · '}
                    Handed over to <strong>{handoffName}</strong>
                  </>
                ) : null}
              </p>
            ) : hasRoute ? (
              <div style={styles.orderBody}>
                <div style={styles.orderColPrimary}>
                  <div style={styles.metaInlineRow}>
                    <div style={styles.metaItem}>
                      <span style={styles.metaLabel}>Patient</span>
                      <span style={styles.metaValue}>{order.patientName || '—'}</span>
                    </div>
                    <div style={styles.metaItem}>
                      <span style={styles.metaLabel}>Amount</span>
                      <span style={{ ...styles.metaValue, fontVariantNumeric: 'tabular-nums' }}>{payable}</span>
                    </div>
                    <div style={styles.metaItem}>
                      <span style={styles.metaLabel}>Payment</span>
                      <span style={styles.metaValue}>{payHint.short}</span>
                    </div>
                    {phone ? (
                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Phone</span>
                        <a href={`tel:${phone.replace(/\s/g, '')}`} style={styles.metaLink}>
                          {phone}
                        </a>
                      </div>
                    ) : null}
                    {collectorName ? (
                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Collection agent</span>
                        <span style={styles.metaValue}>{collectorName}</span>
                      </div>
                    ) : null}
                    {showHandoff ? (
                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Handed over to</span>
                        <span style={styles.metaValue}>{handoffName}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div style={styles.orderColSecondary}>
                  {slotLabel ? (
                    <div style={styles.metaFullRow}>
                      <span style={styles.metaLabel}>Slot</span>
                      <span style={styles.metaValue}>{slotLabel}</span>
                    </div>
                  ) : null}
                  {address ? (
                    <div style={styles.metaFullRow}>
                      <span style={styles.metaLabel}>Address</span>
                      <span style={styles.metaValueMuted}>{address}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div style={styles.metaBlockSingle}>
                <div style={styles.metaInlineRow}>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Patient</span>
                    <span style={styles.metaValue}>{order.patientName || '—'}</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Amount</span>
                    <span style={{ ...styles.metaValue, fontVariantNumeric: 'tabular-nums' }}>{payable}</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Payment</span>
                    <span style={styles.metaValue}>{payHint.short}</span>
                  </div>
                  {phone ? (
                    <div style={styles.metaItem}>
                      <span style={styles.metaLabel}>Phone</span>
                      <a href={`tel:${phone.replace(/\s/g, '')}`} style={styles.metaLink}>
                        {phone}
                      </a>
                    </div>
                  ) : null}
                  {collectorName ? (
                    <div style={styles.metaItem}>
                      <span style={styles.metaLabel}>Collection agent</span>
                      <span style={styles.metaValue}>{collectorName}</span>
                    </div>
                  ) : null}
                  {showHandoff ? (
                    <div style={styles.metaItem}>
                      <span style={styles.metaLabel}>Handed over to</span>
                      <span style={styles.metaValue}>{handoffName}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            {!minimized ? (
              <>
                <p
                  style={
                    payHint.tone === 'cash'
                      ? styles.paymentNoteCod
                      : payHint.tone === 'hold'
                        ? styles.paymentNote
                        : styles.paymentNotePaid
                  }
                >
                  {payHint.line}
                </p>
                <DiagnosticsOrderSettlementPanel
                  order={order}
                  billing={billing}
                  payoutEligible={diagnosticsPayoutEligible(order.status)}
                />
                {tests.length > 0 ? (
                  <div style={styles.samplesBlock}>
                    <span style={styles.samplesLabel}>Samples</span>
                    <div style={styles.sampleChips}>
                      {tests.map((name, i) => (
                        <span key={`${name}-${i}`} style={styles.sampleChip}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {eventRows.length > 0 ? (
                  <DiagnosticsVisitTimeline
                    events={eventRows}
                    handoffName={handoffName}
                    denseDefault={eventRows.length > 7}
                  />
                ) : null}
                {!hideMaps && showMap && address ? <DiagnosticsVisitMap address={address} compact /> : null}
                {photos.length > 0 ? (
                  <div style={needsSamplePhotoCrossCheck ? styles.photoReviewPanel : styles.photoGallery}>
                    {needsSamplePhotoCrossCheck ? (
                      <div style={styles.photoReviewHead}>
                        <span style={styles.photoStepBadge} aria-hidden>
                          1
                        </span>
                        <div style={styles.photoReviewCopy}>
                          <span style={styles.photoReviewTitle}>Sample verification</span>
                          <span style={styles.photoReviewHint}>
                            Open each vial photo to cross-check labels before confirming at the bench.
                          </span>
                        </div>
                        <span
                          style={allSamplePhotosViewed ? styles.reviewProgressDone : styles.reviewProgress}
                          aria-label={`${viewedPhotoIds.size} of ${photos.length} photos reviewed`}
                        >
                          {viewedPhotoIds.size}/{photos.length}
                        </span>
                      </div>
                    ) : (
                      <div style={styles.photoGalleryHead}>
                        <span style={styles.photoGalleryLabel}>Sample photos</span>
                        <span style={styles.photoCount}>
                          {photos.length}/{MAX_DIAGNOSTICS_SAMPLE_PHOTOS}
                        </span>
                      </div>
                    )}
                    <div style={styles.photoStrip}>
                      {photos.map((photo) => {
                        const viewed = viewedPhotoIds.has(photo.mediaId);
                        return (
                          <div key={photo.mediaId} style={styles.photoWrap}>
                            <a
                              href={photo.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                ...styles.photoLink,
                                ...(needsSamplePhotoCrossCheck
                                  ? viewed
                                    ? styles.photoLinkViewed
                                    : styles.photoLinkPending
                                  : {}),
                              }}
                              title={needsSamplePhotoCrossCheck ? (viewed ? 'Reviewed' : 'Open to cross-check') : undefined}
                              onClick={() => {
                                if (!needsSamplePhotoCrossCheck) return;
                                setViewedPhotoIds((prev) => {
                                  if (prev.has(photo.mediaId)) return prev;
                                  const next = new Set(prev);
                                  next.add(photo.mediaId);
                                  return next;
                                });
                              }}
                            >
                              <img src={photo.url} alt="Sample vial" style={styles.photoThumb} />
                              {needsSamplePhotoCrossCheck && viewed ? (
                                <span style={styles.photoCheck} aria-hidden>
                                  ✓
                                </span>
                              ) : null}
                            </a>
                            {canRemovePhoto ? (
                              <button
                                type="button"
                                style={styles.photoDelete}
                                aria-label="Delete photo"
                                title="Delete photo"
                                onClick={() => setPendingDelete(photo)}
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
            <ConfirmDialog
              open={Boolean(pendingDelete)}
              title="Delete this sample photo?"
              confirmLabel="Yes, delete"
              danger
              busy={deleteBusy}
              description="Remove this photo if it is blurry or the wrong sample. You can upload a replacement after."
              onClose={() => !deleteBusy && setPendingDelete(null)}
              onConfirm={() => {
                if (!pendingDelete || !onRemovePhoto) return;
                setDeleteBusy(true);
                void onRemovePhoto(order.id, pendingDelete.mediaId).finally(() => {
                  setDeleteBusy(false);
                  setPendingDelete(null);
                });
              }}
            />
            {!minimized && showAssignRow ? (
              <div style={styles.assignRow}>
                <label style={styles.assignLabel} htmlFor={selectId}>
                  {order.assignedStaffId ? 'Reassign collection agent' : 'Collection agent'}
                </label>
                <select
                  key={`${order.id}-${order.assignedStaffId ?? ''}`}
                  id={selectId}
                  style={styles.select}
                  defaultValue={order.assignedStaffId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id || !onAssign) return;
                    const staffMember = (staff ?? []).find((s) => s.id === id);
                    onAssign(order.id, id, staffMember?.displayName?.trim() ?? '');
                  }}
                >
                  <option value="">Select collection agent…</option>
                  {(staff ?? []).filter(isHomeVisitAssignable).map((s) => (
                    <option key={s.id} value={s.id}>
                      {homeVisitAssignOptionLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {!minimized && renderFooter ? (
              <div style={styles.cardFooter}>
                {renderFooter(order, { allSamplePhotosViewed })}
              </div>
            ) : null}
          </li>
  );
}

/** Card chrome — clear hierarchy, calm slate + teal accents. */
const RECORD_OUTLINE = '1px solid color-mix(in srgb, var(--border) 70%, #0f766e 30%)';
const RECORD_INNER_OUTLINE = '1px solid color-mix(in srgb, var(--border) 82%, transparent)';

const styles: Record<string, CSSProperties> = {
  orderList: { listStyle: 'none', margin: 0, padding: '0.1rem 0 0.15rem', display: 'grid', gap: '0.75rem' },
  orderCard: {
    border: RECORD_OUTLINE,
    borderRadius: 14,
    padding: '0.5rem 0.58rem 0.55rem',
    background: 'linear-gradient(180deg, #fff 0%, color-mix(in srgb, var(--bg-elevated) 96%, #f0fdfa) 100%)',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)',
    margin: 0,
  },
  orderHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem', flexWrap: 'wrap' },
  headActions: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.28rem', marginLeft: 'auto' },
  headBtn: {
    border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
    background: 'color-mix(in srgb, #fff 92%, var(--bg-muted))',
    color: 'var(--text)',
    borderRadius: 999,
    minHeight: 32,
    padding: '0.22rem 0.55rem',
    fontSize: '0.68rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset',
  },
  miniLine: { margin: '0 0 0.12rem', fontSize: '0.74rem', color: 'var(--text-muted)' },
  samplesBlock: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.28rem 0.35rem',
    margin: '0.08rem 0 0.12rem',
    padding: '0.28rem 0.38rem',
    borderRadius: 9,
    border: RECORD_INNER_OUTLINE,
    background: 'color-mix(in srgb, var(--bg-muted) 22%, var(--bg-elevated))',
  },
  samplesLabel: {
    fontSize: '0.62rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-muted)',
  },
  sampleChips: { display: 'flex', flexWrap: 'wrap', gap: '0.22rem', flex: '1 1 auto' },
  sampleChip: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text)',
    padding: '0.12rem 0.38rem',
    borderRadius: 999,
    background: '#fff',
    border: '1px solid color-mix(in srgb, var(--border) 75%, var(--accent) 25%)',
  },
  photoReviewPanel: {
    margin: '0.14rem 0 0.18rem',
    padding: '0.42rem 0.48rem 0.46rem',
    borderRadius: 12,
    border: '1px solid color-mix(in srgb, #0f766e 22%, var(--border))',
    background: 'linear-gradient(145deg, #f0fdfa 0%, #fff 55%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
    display: 'grid',
    gap: '0.38rem',
  },
  photoGallery: {
    margin: '0.12rem 0 0.16rem',
    padding: '0.35rem 0.42rem',
    borderRadius: 11,
    border: RECORD_INNER_OUTLINE,
    background: 'color-mix(in srgb, var(--bg-muted) 12%, #fff)',
    display: 'grid',
    gap: '0.32rem',
  },
  photoReviewHead: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.42rem',
  },
  photoGalleryHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.35rem',
  },
  photoGalleryLabel: {
    fontSize: '0.66rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
  },
  photoStepBadge: {
    flex: '0 0 auto',
    width: 26,
    height: 26,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.72rem',
    fontWeight: 800,
    color: '#ecfdf5',
    background: 'linear-gradient(135deg, #0f766e, #065f46)',
    boxShadow: '0 2px 6px rgba(6, 95, 70, 0.35)',
  },
  photoReviewCopy: { flex: '1 1 8rem', minWidth: 0, display: 'grid', gap: '0.1rem' },
  photoReviewTitle: { fontSize: '0.76rem', fontWeight: 800, color: '#064e3b', letterSpacing: '-0.01em' },
  photoReviewHint: { fontSize: '0.68rem', fontWeight: 500, color: 'color-mix(in srgb, var(--text-muted) 88%, #065f46)', lineHeight: 1.35 },
  reviewProgress: {
    flex: '0 0 auto',
    fontSize: '0.72rem',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    padding: '0.22rem 0.5rem',
    borderRadius: 999,
    background: '#fff7ed',
    color: '#c2410c',
    border: '1px solid #fed7aa',
  },
  reviewProgressDone: {
    flex: '0 0 auto',
    fontSize: '0.72rem',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    padding: '0.22rem 0.5rem',
    borderRadius: 999,
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #99f6e4',
  },
  photoStrip: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.38rem' },
  photoLinkPending: {
    border: '2px solid #f97316',
    boxShadow: '0 0 0 3px rgba(249, 115, 22, 0.18)',
  },
  photoLinkViewed: {
    border: '2px solid #0f766e',
    boxShadow: '0 0 0 3px rgba(15, 118, 110, 0.15)',
  },
  photoWrap: { position: 'relative', width: 62, height: 62, flex: '0 0 auto' },
  photoLink: {
    position: 'relative',
    display: 'block',
    width: 62,
    height: 62,
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid var(--border)',
    transition: 'transform 120ms ease, box-shadow 120ms ease',
  },
  photoThumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  photoCheck: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.62rem',
    fontWeight: 900,
    color: '#fff',
    background: '#0f766e',
    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
  },
  photoDelete: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    minHeight: 22,
    border: 'none',
    borderRadius: 999,
    background: '#991b1b',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 800,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    padding: 0,
    boxShadow: '0 0 0 2px #fff',
  },
  photoCount: {
    fontSize: '0.68rem',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--text-muted)',
    padding: '0.14rem 0.38rem',
    borderRadius: 999,
    background: 'color-mix(in srgb, var(--bg-muted) 40%, #fff)',
  },
  orderBody: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: '0.28rem 0.65rem',
    marginBottom: '0.16rem',
  },
  orderColPrimary: {
    flex: '1 1 9.5rem',
    minWidth: 0,
  },
  orderColSecondary: {
    flex: '1.2 1 11rem',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.22rem',
  },
  metaBlockSingle: {
    marginBottom: '0.16rem',
  },
  orderId: {
    fontSize: '0.82rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--text)',
  },
  pill: {
    fontSize: '0.62rem',
    fontWeight: 800,
    background: 'color-mix(in srgb, var(--success-soft) 92%, #fff)',
    color: 'color-mix(in srgb, var(--success) 88%, #000)',
    padding: '0.16rem 0.42rem',
    borderRadius: 999,
    border: '1px solid color-mix(in srgb, var(--success) 22%, var(--border))',
  },
  pillHold: {
    fontSize: '0.62rem',
    fontWeight: 800,
    background: 'color-mix(in srgb, var(--warning-soft) 88%, #fff)',
    color: 'color-mix(in srgb, var(--warning) 85%, #000)',
    padding: '0.16rem 0.42rem',
    borderRadius: 999,
    border: '1px solid color-mix(in srgb, var(--warning) 28%, var(--border))',
  },
  metaInlineRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    columnGap: '0.85rem',
    rowGap: '0.18rem',
  },
  metaFullRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    minWidth: 0,
  },
  metaItem: { display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, flex: '0 1 auto' },
  metaLabel: {
    fontSize: '0.62rem',
    fontWeight: 750,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-muted)',
  },
  metaValue: { fontSize: '0.75rem', fontWeight: 650, color: 'var(--text)', lineHeight: 1.25, wordBreak: 'break-word' },
  metaValueMuted: { fontSize: '0.73rem', fontWeight: 500, color: 'var(--text-muted)', lineHeight: 1.3, wordBreak: 'break-word' },
  metaLink: {
    fontSize: '0.76rem',
    fontWeight: 650,
    color: 'var(--accent)',
    textDecoration: 'none',
  },
  paymentNote: {
    margin: '0 0 0.16rem',
    fontSize: '0.65rem',
    fontWeight: 700,
    color: 'color-mix(in srgb, var(--warning) 90%, #000)',
    background: 'color-mix(in srgb, var(--warning-soft) 88%, #fff)',
    border: '1px solid color-mix(in srgb, var(--warning) 25%, var(--border))',
    padding: '0.2rem 0.38rem',
    lineHeight: 1.3,
    borderRadius: 'var(--radius-sm)',
  },
  paymentNoteCod: {
    margin: '0 0 0.16rem',
    fontSize: '0.64rem',
    fontWeight: 800,
    color: 'color-mix(in srgb, var(--text) 94%, var(--info))',
    background: 'color-mix(in srgb, var(--info) 10%, #fff)',
    border: '1px solid color-mix(in srgb, var(--info) 22%, var(--border))',
    padding: '0.2rem 0.38rem',
    lineHeight: 1.35,
    borderRadius: 'var(--radius-sm)',
  },
  paymentNotePaid: {
    margin: '0 0 0.16rem',
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'color-mix(in srgb, var(--success) 78%, #000)',
    background: 'linear-gradient(90deg, color-mix(in srgb, var(--success-soft) 95%, #fff) 0%, #fff 100%)',
    border: '1px solid color-mix(in srgb, var(--success) 18%, var(--border))',
    borderLeft: '3px solid color-mix(in srgb, var(--success) 65%, #000)',
    padding: '0.28rem 0.45rem',
    lineHeight: 1.35,
    borderRadius: 10,
  },
  assignRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem',
    marginTop: '0.04rem',
    paddingTop: '0.22rem',
    borderTop: '1px solid color-mix(in srgb, var(--border) 75%, transparent)',
    width: '100%',
    minWidth: 0,
  },
  assignLabel: {
    fontSize: '0.65rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    flex: '0 0 auto',
  },
  select: {
    minHeight: 'var(--touch-min)',
    flex: '1 1 0',
    minWidth: 0,
    maxWidth: '100%',
    padding: '0 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid color-mix(in srgb, var(--border) 88%, var(--accent))',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  cardFooter: {
    marginTop: '0.38rem',
    minWidth: 0,
    paddingTop: '0.42rem',
    borderTop: '1px dashed color-mix(in srgb, #0f766e 28%, var(--border))',
  },
};
