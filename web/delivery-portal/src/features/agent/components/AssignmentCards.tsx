import { useState, type CSSProperties } from 'react';
import { CallPhoneLink } from '@/shared/ui/CallPhoneLink';
import { DropMap } from './DropMap';
import { PickupItemsList } from './PickupItemsList';
import type {
  AssignmentView,
  DeliveryManifestView,
  LaundryCashOutcome,
  PickupManifestView,
} from '../api/agentApi';
import {
  deliveryStep,
  pickupHint,
  pickupStep,
  pickupStepLabel,
} from '../lib/assignmentSteps';
import { formatCollectRupee, resolveCodCollect } from '../lib/codCollect';
import {
  ConfirmLaundryAgentStepDialog,
  type LaundryAgentConfirmStep,
} from './ConfirmLaundryAgentStepDialog';

function tripAccentBar(step: 'hub' | 'en_route' | 'done'): string {
  if (step === 'en_route') return '#ea580c';
  if (step === 'hub') return 'var(--accent)';
  return '#16a34a';
}

function splitDropAddress(raw: string): { near: string | null; lines: string } {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const nearIndex = parts.findIndex((part) => /^near\s+/i.test(part));
  const near = nearIndex >= 0 ? parts[nearIndex].replace(/^near\s+/i, '') : null;
  const lines = parts.filter((_, index) => index !== nearIndex).join(', ');
  return { near, lines };
}

function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function formatRupeeShort(amount: number): string {
  return `₹${amount.toFixed(2).replace(/\.00$/, '')}`;
}

function LaundryCodBlock({
  amount,
  mode,
  value,
  onChange,
  selectId,
}: {
  amount: number;
  mode: 'pickup' | 'drop';
  value: LaundryCashOutcome | '';
  onChange: (v: LaundryCashOutcome) => void;
  selectId: string;
}) {
  return (
    <div style={styles.codBlock}>
      <p style={styles.inlineAlert} role="status">
        <span style={styles.inlineAlertIcon} aria-hidden>
          ₹
        </span>
        Collect {formatCollectRupee(amount)} cash from the customer before you continue.
      </p>
      <label style={styles.laundryCashLabel} htmlFor={selectId}>
        Cash payment (not the clothes)
      </label>
      <select
        id={selectId}
        style={styles.laundryCashSelect}
        value={value}
        onChange={(e) => onChange(e.target.value as LaundryCashOutcome)}
      >
        <option value="">Select…</option>
        <option value="COLLECTED">Cash collected</option>
        {mode === 'pickup' ? <option value="NOT_COLLECTED">Cash not collected</option> : null}
      </select>
    </div>
  );
}

function deliveryItemsLine(manifest?: DeliveryManifestView): string | null {
  if (!manifest) return null;
  const n = manifest.totalItemCount ?? 0;
  if (n <= 0) return null;
  return `${n} item${n === 1 ? '' : 's'} · ${formatRupeeShort(manifest.subtotal ?? 0)}`;
}

function compactDropLine(task: AssignmentView): string {
  if (task.destinationAddress) {
    const { near, lines } = splitDropAddress(task.destinationAddress);
    if (near) return `Near ${near}`;
    const short = lines.split(',').map((p) => p.trim()).filter(Boolean).slice(0, 2).join(', ');
    return short || task.destinationAddress;
  }
  return task.destinationLabel?.trim() || 'Address on file';
}

function DropAddress({ label, address }: { label?: string | null; address: string }) {
  const [mapOpen, setMapOpen] = useState(false);
  const { near, lines } = splitDropAddress(address);
  const house = label ? `${label} · ${lines}` : lines;
  const addressLine = near ? `Near ${near} · ${house}` : house;
  return (
    <div style={styles.drop}>
      {addressLine ? <p style={styles.addressCompact}>{addressLine}</p> : null}
      <div style={styles.mapLinks}>
        <a href={mapsSearchUrl(address)} target="_blank" rel="noopener noreferrer" style={styles.mapsLinkInline}>
          Open in Maps
        </a>
        <button type="button" style={styles.mapToggle} onClick={() => setMapOpen((v) => !v)}>
          {mapOpen ? 'Hide map' : 'Show map'}
        </button>
      </div>
      {mapOpen ? <DropMap address={address} height={100} /> : null}
    </div>
  );
}

function MinimizeTripButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      style={styles.minimizeBtn}
      onClick={onClick}
      aria-label="Minimize"
      title="Minimize"
    >
      <span style={styles.minimizeIcon} aria-hidden>
        ▴
      </span>
    </button>
  );
}

function CollapsedAssignmentCard({
  statusLabel,
  statusTone,
  orderNumber,
  title,
  subtitle,
  onExpand,
}: {
  statusLabel: string;
  statusTone: CSSProperties;
  orderNumber: string;
  title: string;
  subtitle?: string;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      style={styles.collapsedRowBtn}
      onClick={onExpand}
      aria-expanded={false}
      title={`${orderNumber} — ${title}${subtitle ? ` — ${subtitle}` : ''}`}
    >
      <span style={{ ...styles.statusPill, ...styles.statusPillCompact, ...statusTone }}>{statusLabel}</span>
      <span style={styles.collapsedTextCol}>
        <span style={styles.collapsedTitle}>{title}</span>
        {subtitle ? <span style={styles.collapsedSub}>{subtitle}</span> : null}
      </span>
      <span style={styles.expandChevCompact} aria-hidden>
        ›
      </span>
    </button>
  );
}

function collapsedDeliverySubtitle(
  task: AssignmentView,
  itemsLine: string | null,
  cod: ReturnType<typeof resolveCodCollect>,
): string | undefined {
  const parts: string[] = [];
  if (task.destinationName?.trim()) parts.push(compactDropLine(task));
  if (itemsLine) parts.push(itemsLine);
  if (cod) parts.push(`Collect ${formatCollectRupee(cod.amount)}`);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function VendorPickupCard({
  task,
  busy,
  manifest,
  manifestLoading,
  manifestFailed,
  onRetryManifest,
  onPickVendor,
  expanded = true,
  onRequestExpand,
  onRequestCollapse,
}: {
  task: AssignmentView;
  busy: boolean;
  manifest?: PickupManifestView;
  manifestLoading?: boolean;
  manifestFailed?: boolean;
  onRetryManifest?: () => void;
  onPickVendor: (id: string, status: string) => void;
  expanded?: boolean;
  onRequestExpand?: () => void;
  onRequestCollapse?: () => void;
}) {
  const step = pickupStep(task.status);
  const canPick = step === 'shop' && !busy;
  const shopName = manifest?.shopName?.trim() || 'Shop';
  const bagShort = task.subOrderNumber?.split('-').pop() || task.subOrderNumber || 'bag';
  const shopAddress = manifest?.shopAddress?.trim();
  const shopPhone = manifest?.shopPhone?.trim();
  const isDone = step === 'done';
  const stepLabel = pickupStepLabel(step);
  const collapsible = onRequestExpand != null;
  const isOpen = !collapsible || expanded;

  const pickupSubtitle = [`Bag ${bagShort}`, !isDone ? pickupHint(step) : null].filter(Boolean).join(' · ');

  const pickupStepKey = step === 'done' ? 'done' : step === 'to_hub' ? 'en_route' : 'hub';

  return (
    <article
      data-trip-card={isOpen ? 'open' : 'shut'}
      style={{
        ...styles.card,
        ...(isOpen ? styles.cardOpen : styles.cardShut),
        ...(isOpen ? { borderLeftColor: tripAccentBar(pickupStepKey) } : null),
      }}
    >
      {collapsible && !isOpen && onRequestExpand ? (
        <CollapsedAssignmentCard
          statusLabel={isDone ? 'Done' : stepLabel}
          statusTone={isDone ? styles.statusDone : styles.statusPickup}
          orderNumber={task.orderNumber}
          title={shopName}
          subtitle={pickupSubtitle || undefined}
          onExpand={onRequestExpand}
        />
      ) : null}

      {isOpen ? (
        <>
      <div style={styles.expandedHeader}>
        <div style={styles.expandedHeaderRow}>
          <span
            style={{
              ...styles.statusPill,
              ...styles.statusPillCompact,
              ...(isDone ? styles.statusDone : styles.statusPickup),
            }}
          >
            {isDone ? 'Done' : stepLabel}
          </span>
          <span style={styles.orderIdCompact}>{task.orderNumber}</span>
          <span style={styles.headerSpacer} />
          {shopPhone ? <CallPhoneLink phone={shopPhone} label="Call" style={styles.callBtnFilled} /> : null}
          {collapsible && onRequestCollapse ? <MinimizeTripButton onClick={onRequestCollapse} /> : null}
        </div>
        <p style={styles.addressCompact}>
          {shopName} · Bag {bagShort}
          {shopAddress ? ` · ${shopAddress}` : ''}
        </p>
      </div>

      <PickupItemsList
        manifest={manifest}
        loading={manifestLoading}
        failed={manifestFailed}
        onRetry={onRetryManifest}
        title="Items"
        defaultOpen={false}
      />

      {step === 'shop' ? (
        <button
          type="button"
          style={{ ...styles.cta, ...styles.ctaGreen, opacity: canPick ? 1 : 0.55 }}
          disabled={!canPick}
          onClick={() => void onPickVendor(task.id, task.status)}
        >
          I took the bag
        </button>
      ) : null}
      {step === 'to_hub' ? <p style={styles.inlineAlert}>Take bag to hub</p> : null}
        </>
      ) : null}
    </article>
  );
}

export function BuyerDeliveryCard({
  task,
  busy,
  manifest,
  manifestLoading,
  manifestFailed,
  onRetryManifest,
  onPickHub,
  onPickVendor,
  onDeliver,
  expanded = true,
  onRequestExpand,
  onRequestCollapse,
}: {
  task: AssignmentView;
  busy: boolean;
  manifest?: DeliveryManifestView;
  manifestLoading?: boolean;
  manifestFailed?: boolean;
  onRetryManifest?: () => void;
  onPickHub: (id: string, status: string) => void;
  onPickVendor?: (id: string, status: string, cashOutcome?: LaundryCashOutcome) => void;
  onDeliver: (
    id: string,
    status: string,
    otp: string,
    recipientName?: string,
    cashOutcome?: LaundryCashOutcome,
  ) => void;
  expanded?: boolean;
  onRequestExpand?: () => void;
  onRequestCollapse?: () => void;
}) {
  const laundryTrip = task.legType === 'LAUNDRY_TRIP';
  const laundryPickup = laundryTrip && task.laundryTripKind === 'PICKUP_FROM_CUSTOMER';
  const laundryDrop = laundryTrip && task.laundryTripKind === 'DROP_TO_CUSTOMER';
  const vendorDirect =
    task.legType === 'VENDOR_DIRECT' || (laundryTrip && task.laundryTripKind === 'DROP_TO_CUSTOMER');
  const step = deliveryStep(task.status);
  const [otp, setOtp] = useState('111111');
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [laundryCashOutcome, setLaundryCashOutcome] = useState<LaundryCashOutcome | ''>('');
  const [laundryConfirm, setLaundryConfirm] = useState<LaundryAgentConfirmStep | null>(null);

  const statusLabel =
    step === 'hub'
      ? laundryPickup
        ? 'At customer'
        : vendorDirect
          ? 'At shop'
          : 'At hub'
      : step === 'en_route'
        ? 'On the way'
        : 'Delivered';
  const cod = resolveCodCollect(task, manifest);
  const collapsible = onRequestExpand != null;
  const isOpen = !collapsible || expanded;
  const itemsLine = deliveryItemsLine(manifest);
  const collapsedTitle = task.destinationName?.trim() || compactDropLine(task);
  const collapsedSubtitle = collapsedDeliverySubtitle(task, itemsLine, cod);
  const statusTone =
    step === 'hub' ? styles.statusHub : step === 'en_route' ? styles.statusRoute : styles.statusDone;

  const awaitingOnlinePayment =
    !cod &&
    (task.paymentMethod ?? '').toUpperCase() === 'ONLINE' &&
    (task.orderStatus ?? '').toUpperCase() === 'PAYMENT_PENDING';

  const vendorMarkedPaid =
    laundryTrip &&
    (task.laundryPaymentStatus ?? '').toUpperCase() === 'COLLECTED' &&
    (task.paymentMethod ?? '').toUpperCase() === 'CASH';
  const laundryCashPickupStep = Boolean(cod && laundryPickup && step === 'hub' && !vendorMarkedPaid);
  const laundryCashDropStep = Boolean(cod && laundryDrop && step === 'en_route' && !vendorMarkedPaid);
  const laundryCashReady =
    !laundryCashPickupStep && !laundryCashDropStep
      ? true
      : laundryCashPickupStep
        ? laundryCashOutcome === 'COLLECTED' || laundryCashOutcome === 'NOT_COLLECTED'
        : laundryCashOutcome === 'COLLECTED';

  function laundryCashSummary(): string | null {
    if (!cod) return null;
    if (laundryCashOutcome === 'COLLECTED') {
      return `Cash collected · ${formatCollectRupee(cod.amount)}`;
    }
    if (laundryCashOutcome === 'NOT_COLLECTED') return 'Cash not collected';
    return null;
  }

  function confirmLaundryStep() {
    if (!laundryConfirm) return;
    const stepKind = laundryConfirm;
    setLaundryConfirm(null);
    if (stepKind === 'pickup_customer' && onPickVendor) {
      void onPickVendor(
        task.id,
        task.status,
        laundryCashPickupStep && laundryCashOutcome ? laundryCashOutcome : undefined,
      );
      return;
    }
    if (stepKind === 'at_shop') {
      void onDeliver(task.id, task.status, '111111', task.destinationName ?? 'Customer');
      return;
    }
    if (stepKind === 'drop_deliver') {
      void onDeliver(
        task.id,
        task.status,
        otp,
        'Customer',
        laundryCashDropStep && laundryCashOutcome === 'COLLECTED' ? 'COLLECTED' : undefined,
      );
    }
  }

  const stepKey = step === 'done' ? 'done' : step;

  return (
    <article
      data-trip-card={isOpen ? 'open' : 'shut'}
      style={{
        ...styles.card,
        ...(isOpen ? styles.cardOpen : styles.cardShut),
        ...(isOpen ? { borderLeftColor: tripAccentBar(stepKey) } : null),
      }}
    >
      {collapsible && !isOpen && onRequestExpand ? (
        <CollapsedAssignmentCard
          statusLabel={statusLabel}
          statusTone={statusTone}
          orderNumber={task.orderNumber}
          title={collapsedTitle}
          subtitle={collapsedSubtitle}
          onExpand={onRequestExpand}
        />
      ) : null}

      {isOpen ? (
        <>
      <div style={styles.expandedHeader}>
        <div style={styles.expandedHeaderRow}>
          <span style={{ ...styles.statusPill, ...styles.statusPillCompact, ...statusTone }}>{statusLabel}</span>
          <span style={styles.orderIdCompact} title={task.orderNumber}>
            {task.orderNumber}
          </span>
          <span style={styles.headerSpacer} />
          {task.destinationPhone ? (
            <CallPhoneLink phone={task.destinationPhone} label="Call" style={styles.callBtnFilled} />
          ) : null}
          {collapsible && onRequestCollapse ? <MinimizeTripButton onClick={onRequestCollapse} /> : null}
        </div>
        {task.sourceShopName ? (
          <p style={styles.shopLineInline}>
            <span style={styles.shopTag}>Shop</span>
            {task.sourceShopName}
            {laundryPickup ? ' · return to shop' : laundryTrip ? ' · laundry' : ''}
          </p>
        ) : null}
        {task.destinationName?.trim() && task.destinationAddress ? (
          <p style={styles.dropTitle}>{task.destinationName.trim()}</p>
        ) : null}
        {task.destinationAddress ? (
          <DropAddress label={task.destinationLabel} address={task.destinationAddress} />
        ) : task.destinationName ? (
          <p style={styles.customerNameCompact}>{task.destinationName}</p>
        ) : task.destinationLabel ? (
          <p style={styles.addressOnce}>{task.destinationLabel}</p>
        ) : (
          <p style={styles.addressWarn}>Address missing</p>
        )}
      </div>

      {step !== 'done' && awaitingOnlinePayment ? (
        <p style={{ ...styles.inlineAlert, ...styles.inlineAlertWarn }} role="status">
          <span style={styles.inlineAlertIcon} aria-hidden>
            !
          </span>
          Buyer has not paid online yet. Ask them to open the app, open this order, and complete payment — then you
          can enter OTP.
        </p>
      ) : null}

      {vendorMarkedPaid && laundryTrip && step !== 'done' ? (
        <p style={styles.vendorPaidBanner} role="status">
          Payment received marked by Vendor — no cash to collect on this trip.
        </p>
      ) : null}

      {laundryCashPickupStep && cod ? (
        <LaundryCodBlock
          amount={cod.amount}
          mode="pickup"
          value={laundryCashOutcome}
          onChange={setLaundryCashOutcome}
          selectId={`laundry-cash-pickup-${task.id}`}
        />
      ) : null}

      {laundryCashDropStep && cod ? (
        <LaundryCodBlock
          amount={cod.amount}
          mode="drop"
          value={laundryCashOutcome}
          onChange={setLaundryCashOutcome}
          selectId={`laundry-cash-drop-${task.id}`}
        />
      ) : null}

      {!laundryTrip ? (
        <PickupItemsList
          manifest={manifest}
          loading={manifestLoading}
          failed={manifestFailed}
          onRetry={onRetryManifest}
          title="Items"
          showShop={false}
          defaultOpen={false}
          paymentMethod={cod ? 'COD' : task.paymentMethod ?? manifest?.paymentMethod}
          collectCashAmount={cod?.amount ?? task.collectCashAmount ?? manifest?.collectCashAmount}
        />
      ) : null}

      {step !== 'done' ? (
        <div style={styles.actions}>
          {step === 'hub' ? (
            <button
              type="button"
              style={{
                ...styles.cta,
                ...styles.ctaAccent,
                ...(laundryCashPickupStep && !laundryCashReady ? styles.ctaDisabled : null),
              }}
              disabled={busy || (laundryCashPickupStep && !laundryCashReady)}
              onClick={() => {
                if (laundryPickup) {
                  setLaundryConfirm('pickup_customer');
                  return;
                }
                void ((vendorDirect || laundryPickup) && onPickVendor
                  ? onPickVendor(task.id, task.status)
                  : onPickHub(task.id, task.status));
              }}
            >
              {busy
                ? 'Saving…'
                : laundryPickup
                  ? 'Picked up laundry from customer'
                  : vendorDirect
                    ? 'I took bag from shop'
                    : 'I took order from hub'}
            </button>
          ) : null}

          {step === 'en_route' && !showCodeBox && laundryPickup ? (
            <button
              type="button"
              style={{ ...styles.cta, ...styles.ctaAccent }}
              disabled={busy}
              onClick={() => setLaundryConfirm('at_shop')}
            >
              Items reached shop
            </button>
          ) : null}

          {step === 'en_route' && !showCodeBox && !laundryPickup ? (
            <button
              type="button"
              style={{
                ...styles.cta,
                ...styles.ctaAccent,
                ...(awaitingOnlinePayment || (laundryCashDropStep && !laundryCashReady)
                  ? styles.ctaDisabled
                  : null),
              }}
              disabled={busy || awaitingOnlinePayment || (laundryCashDropStep && !laundryCashReady)}
              onClick={() => setShowCodeBox(true)}
            >
              {awaitingOnlinePayment ? 'Waiting for buyer payment' : 'Enter OTP & finish'}
            </button>
          ) : null}

          {step === 'en_route' && showCodeBox ? (
            <div style={styles.otpPanel}>
              <label style={styles.otpLabel} htmlFor={`otp-${task.id}`}>
                Customer OTP
              </label>
              <input
                id={`otp-${task.id}`}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                style={styles.otpInput}
                autoFocus
              />
              {cod && !laundryTrip ? (
                <p style={styles.otpCodReminder}>
                  Collect {formatCollectRupee(cod.amount)} cash first, then enter OTP.
                </p>
              ) : null}
              <p style={styles.otpHelp}>Local/dev: 111111</p>
              <button
                type="button"
                style={{
                  ...styles.cta,
                  ...styles.ctaAccent,
                  ...(awaitingOnlinePayment || (laundryCashDropStep && !laundryCashReady)
                    ? styles.ctaDisabled
                    : null),
                }}
                disabled={
                  busy ||
                  awaitingOnlinePayment ||
                  otp.trim().length < 4 ||
                  (laundryCashDropStep && !laundryCashReady)
                }
                onClick={() => {
                  if (laundryDrop) {
                    setLaundryConfirm('drop_deliver');
                    return;
                  }
                  void onDeliver(task.id, task.status, otp, 'Customer');
                }}
              >
                {busy ? 'Submitting…' : awaitingOnlinePayment ? 'Waiting for buyer payment' : 'Submit delivery'}
              </button>
              <button
                type="button"
                style={styles.secondaryBtn}
                disabled={busy}
                onClick={() => setShowCodeBox(false)}
              >
                Back
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
        </>
      ) : null}

      {laundryConfirm != null ? (
        <ConfirmLaundryAgentStepDialog
          open
          step={laundryConfirm}
          orderNumber={task.orderNumber}
          customerName={task.destinationName}
          shopName={task.sourceShopName}
          cashSummary={laundryCashSummary()}
          busy={busy}
          onClose={() => {
            if (!busy) setLaundryConfirm(null);
          }}
          onConfirm={confirmLaundryStep}
        />
      ) : null}
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: 'var(--bg-elevated)',
    border: '1px solid color-mix(in srgb, var(--border) 90%, transparent)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-soft)',
    padding: '0.55rem 0.65rem',
    display: 'grid',
    gap: '0.35rem',
    overflow: 'hidden',
  },
  cardOpen: {
    padding: '0.65rem 0.7rem 0.7rem',
    gap: '0.45rem',
    borderLeftWidth: 4,
    borderLeftStyle: 'solid',
    boxShadow: 'var(--shadow-elevated)',
    background:
      'linear-gradient(165deg, var(--bg-elevated) 0%, color-mix(in srgb, var(--accent-soft) 18%, var(--bg-elevated)) 100%)',
  },
  cardShut: {
    padding: '0.45rem 0.55rem',
    gap: 0,
    borderRadius: 14,
    boxShadow: 'var(--shadow-card)',
  },
  collapsedRowBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    width: '100%',
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 44,
  },
  collapsedTextCol: {
    flex: 1,
    minWidth: 0,
    display: 'grid',
    gap: 2,
  },
  collapsedTitle: {
    fontSize: '0.8rem',
    fontWeight: 800,
    fontFamily: 'var(--font-display)',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  collapsedSub: {
    fontSize: '0.68rem',
    fontWeight: 600,
    lineHeight: 1.25,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  statusPillCompact: {
    padding: '0.2rem 0.45rem',
    fontSize: '0.58rem',
    letterSpacing: '0.06em',
    flexShrink: 0,
  },
  orderIdCompact: {
    fontSize: '0.58rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '46%',
    flexShrink: 1,
  },
  expandChevCompact: {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1,
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
    border: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
  },
  minimizeBtn: {
    flexShrink: 0,
    margin: 0,
    padding: 0,
    width: 34,
    height: 34,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid color-mix(in srgb, var(--border) 90%, transparent)',
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  minimizeIcon: {
    fontSize: '0.85rem',
    lineHeight: 1,
    fontWeight: 700,
    marginTop: 2,
  },
  headerSpacer: { flex: 1, minWidth: 8 },
  cardTop: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '0.45rem',
  },
  shopLine: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 650,
    color: 'var(--text-muted)',
    lineHeight: 1.25,
  },
  shopLineInline: {
    margin: 0,
    fontSize: '0.66rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  expandedHeader: {
    display: 'grid',
    gap: '0.35rem',
    minWidth: 0,
    paddingBottom: '0.15rem',
    borderBottom: '1px solid color-mix(in srgb, var(--border) 70%, transparent)',
  },
  dropTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
    color: 'var(--text)',
  },
  shopTag: {
    display: 'inline-block',
    marginRight: '0.35rem',
    padding: '0.08rem 0.35rem',
    borderRadius: 6,
    background: 'var(--bg-muted)',
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  expandedHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    minWidth: 0,
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.12rem 0.45rem',
    borderRadius: 999,
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  },
  statusHub: {
    background: 'linear-gradient(135deg, var(--accent-soft), #d1fae5)',
    color: 'var(--accent)',
    border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
  },
  statusRoute: {
    background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
    color: '#c2410c',
    border: '1px solid #fed7aa',
  },
  statusDone: {
    background: 'rgba(22, 163, 74, 0.14)',
    color: '#15803d',
  },
  statusPickup: {
    background: 'linear-gradient(135deg, var(--accent-soft), #d1fae5)',
    color: 'var(--accent)',
    border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
  },
  orderId: {
    fontSize: '0.64rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    justifySelf: 'end',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  headRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.45rem',
  },
  headRowCompact: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.35rem',
  },
  vendorPaidBanner: {
    margin: 0,
    padding: '0.45rem 0.55rem',
    borderRadius: 10,
    background: 'linear-gradient(135deg, #ecfdf5, var(--accent-soft))',
    border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
    fontSize: '0.72rem',
    fontWeight: 650,
    lineHeight: 1.35,
    color: '#065f46',
  },
  codBlock: {
    display: 'grid',
    gap: '0.35rem',
  },
  laundryCashLabel: {
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  laundryCashSelect: {
    width: '100%',
    padding: '0.5rem 0.55rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    fontSize: '0.82rem',
    fontWeight: 650,
    background: '#fff',
  },
  inlineAlert: {
    margin: 0,
    padding: '0.45rem 0.55rem',
    borderRadius: 10,
    background: 'linear-gradient(135deg, #ecfdf5, var(--accent-soft))',
    border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
    fontSize: '0.72rem',
    fontWeight: 650,
    lineHeight: 1.35,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.35rem',
    color: '#065f46',
  },
  inlineAlertWarn: {
    background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
    border: '1px solid #fde68a',
    color: '#92400e',
  },
  ctaDisabled: {
    opacity: 0.55,
    boxShadow: 'none',
  },
  inlineAlertIcon: {
    flexShrink: 0,
    width: 18,
    height: 18,
    borderRadius: 999,
    border: '2px solid currentColor',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.55rem',
    marginTop: 1,
  },
  headMain: { minWidth: 0, flex: 1, display: 'grid', gap: 1 },
  customerName: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 800,
    fontFamily: 'var(--font-display)',
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
  },
  customerNameCompact: {
    margin: 0,
    fontSize: '0.88rem',
    fontWeight: 800,
    lineHeight: 1.2,
  },
  oneLine: {
    margin: 0,
    fontSize: '0.75rem',
    fontWeight: 650,
    color: 'var(--text)',
    lineHeight: 1.3,
    opacity: 0.78,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  drop: { display: 'grid', gap: '0.08rem' },
  landmark: {
    margin: 0,
    fontSize: '0.84rem',
    fontWeight: 800,
    color: 'var(--text)',
    lineHeight: 1.3,
  },
  landmarkCompact: {
    margin: 0,
    fontSize: '0.76rem',
    fontWeight: 800,
    color: 'var(--text)',
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  addressFull: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 650,
    color: 'var(--text)',
    lineHeight: 1.35,
  },
  addressCompact: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    lineHeight: 1.35,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  mapLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  mapsLink: {
    justifySelf: 'start',
    marginTop: '0.15rem',
    fontSize: '0.75rem',
    fontWeight: 800,
    color: 'var(--accent)',
    textDecoration: 'none',
    minHeight: 32,
    display: 'inline-flex',
    alignItems: 'center',
  },
  mapsLinkInline: {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--accent)',
    textDecoration: 'none',
    minHeight: 32,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2rem 0.45rem',
    borderRadius: 8,
    background: 'var(--accent-soft)',
  },
  mapToggle: {
    margin: 0,
    padding: '0.2rem 0.45rem',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg-muted)',
    color: 'var(--text)',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 32,
  },
  addressOnce: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 650,
    color: 'var(--text)',
    lineHeight: 1.35,
    opacity: 0.85,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  addressWarn: {
    margin: 0,
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--danger)',
  },
  callBtn: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 36,
    padding: '0.3rem 0.55rem',
    borderRadius: 10,
    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.78rem',
    textDecoration: 'none',
    border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
  },
  callBtnCompact: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 32,
    padding: '0.22rem 0.45rem',
    borderRadius: 8,
    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.72rem',
    textDecoration: 'none',
    border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
  },
  callBtnFilled: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    padding: '0.35rem 0.75rem',
    borderRadius: 999,
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.75rem',
    textDecoration: 'none',
    boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 35%, transparent)',
  },
  mini: {
    borderRadius: 10,
    border: '1.5px solid var(--border)',
    background: 'var(--bg-elevated)',
    overflow: 'hidden',
  },
  miniBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.4rem',
    margin: 0,
    padding: '0.32rem 0.45rem',
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 32,
  },
  miniLeft: { minWidth: 0, display: 'grid', gap: 1 },
  miniLabel: { fontSize: '0.72rem', fontWeight: 800, lineHeight: 1.15 },
  miniSummary: {
    fontSize: '0.68rem',
    fontWeight: 650,
    color: 'var(--text)',
    opacity: 0.72,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  miniChev: {
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 800,
    color: 'var(--text)',
    opacity: 0.65,
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
  },
  miniBody: {
    padding: '0 0.55rem 0.5rem',
    display: 'grid',
    gap: '0.35rem',
    borderTop: '1px solid var(--border)',
    paddingTop: '0.45rem',
  },
  whenLine: {
    margin: 0,
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  hint: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    lineHeight: 1.3,
    fontWeight: 650,
  },
  actions: { display: 'grid', gap: '0.28rem' },
  cta: {
    border: 'none',
    borderRadius: 10,
    padding: '0.58rem 0.7rem',
    fontWeight: 800,
    fontSize: '0.86rem',
    cursor: 'pointer',
    width: '100%',
    minHeight: 44,
  },
  ctaAccent: {
    background: 'linear-gradient(180deg, #0ea82a 0%, var(--accent) 55%, var(--accent-hover) 100%)',
    color: '#fff',
    boxShadow: '0 4px 16px color-mix(in srgb, var(--accent) 38%, transparent)',
  },
  ctaGreen: {
    background: 'linear-gradient(180deg, #0ea82a 0%, var(--accent) 55%, var(--accent-hover) 100%)',
    color: '#fff',
    boxShadow: '0 4px 16px color-mix(in srgb, var(--accent) 38%, transparent)',
  },
  otpPanel: {
    display: 'grid',
    gap: '0.4rem',
    padding: '0.6rem',
    borderRadius: 12,
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
  },
  otpLabel: { fontWeight: 800, fontSize: '0.82rem' },
  otpInput: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1.5px solid var(--border)',
    borderRadius: 10,
    padding: '0.7rem 0.6rem',
    fontSize: '1.35rem',
    fontWeight: 800,
    letterSpacing: '0.28em',
    textAlign: 'center',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
  },
  otpHelp: { margin: 0, color: 'var(--text-muted)', fontWeight: 650, fontSize: '0.72rem' },
  otpCodReminder: {
    margin: 0,
    color: '#92400e',
    fontWeight: 800,
    fontSize: '0.82rem',
    lineHeight: 1.35,
    padding: '0.35rem 0.45rem',
    borderRadius: 8,
    background: 'var(--warning-soft, #fffbeb)',
    border: '1px solid #fde68a',
  },
  secondaryBtn: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.55rem 0.85rem',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    fontWeight: 750,
    cursor: 'pointer',
    minHeight: 40,
  },
  waitBanner: {
    margin: 0,
    padding: '0.55rem 0.65rem',
    borderRadius: 10,
    background: 'rgba(245, 158, 11, 0.14)',
    color: '#92400e',
    fontSize: '0.82rem',
    fontWeight: 750,
  },
};
