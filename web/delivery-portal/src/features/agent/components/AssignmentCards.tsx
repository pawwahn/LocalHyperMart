import { useState, type CSSProperties, type ReactNode } from 'react';
import { CallPhoneLink } from '@/shared/ui/CallPhoneLink';
import { formatPortalTime } from '@/shared/time/formatPortalTime';
import { LegStepper } from './LegStepper';
import { PickupItemsList } from './PickupItemsList';
import type { AssignmentView, DeliveryManifestView, PickupManifestView } from '../api/agentApi';
import {
  deliveryStep,
  deliveryStepLabel,
  pickupHint,
  pickupStep,
  pickupStepLabel,
} from '../lib/assignmentSteps';

const PICKUP_STEPS = [
  { id: 'shop', label: 'Shop' },
  { id: 'to_hub', label: 'Hub' },
  { id: 'done', label: 'Done' },
];

const DELIVERY_STEPS = [
  { id: 'hub', label: 'Hub' },
  { id: 'en_route', label: 'Home' },
  { id: 'done', label: 'Done' },
];

function stepIndex(step: string, steps: string[]): number {
  const idx = steps.indexOf(step);
  return idx < 0 ? 0 : idx;
}

function latestMeta(task: AssignmentView): string | null {
  const events = task.events ?? [];
  if (events.length > 0) {
    const last = events[events.length - 1];
    return formatPortalTime(last.createdAt);
  }
  return task.assignedAt ? formatPortalTime(task.assignedAt) : null;
}

function MiniBlock({
  label,
  summary,
  children,
}: {
  label: string;
  summary: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={styles.mini}>
      <button type="button" style={styles.miniBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span style={styles.miniLeft}>
          <span style={styles.miniLabel}>{label}</span>
          <span style={styles.miniSummary}>{summary}</span>
        </span>
        <span style={styles.miniChev} aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? <div style={styles.miniBody}>{children}</div> : null}
    </div>
  );
}

export function VendorPickupCard({
  task,
  busy,
  manifest,
  manifestLoading,
  manifestFailed,
  onRetryManifest,
  onPickVendor,
}: {
  task: AssignmentView;
  busy: boolean;
  manifest?: PickupManifestView;
  manifestLoading?: boolean;
  manifestFailed?: boolean;
  onRetryManifest?: () => void;
  onPickVendor: (id: string, status: string) => void;
}) {
  const step = pickupStep(task.status);
  const currentIndex = step === 'done' ? PICKUP_STEPS.length : stepIndex(step, ['shop', 'to_hub', 'done']);
  const canPick = step === 'shop' && !busy;
  const shopName = manifest?.shopName?.trim() || 'Shop';
  const bagShort = task.subOrderNumber?.split('-').pop() || task.subOrderNumber || 'bag';
  const shopAddress = manifest?.shopAddress?.trim();
  const shopPhone = manifest?.shopPhone?.trim();
  const isDone = step === 'done';
  const stepLabel = pickupStepLabel(step);

  return (
    <article style={styles.card}>
      <div style={styles.cardTop}>
        <span style={{ ...styles.statusPill, ...(isDone ? styles.statusDone : styles.statusPickup) }}>
          {isDone ? 'Done' : stepLabel}
        </span>
        <span style={styles.orderId}>{task.orderNumber}</span>
      </div>

      <div style={styles.headRow}>
        <div style={styles.headMain}>
          <p style={styles.customerName}>{shopName}</p>
          <p style={styles.oneLine}>Bag {bagShort}{shopAddress ? ` · ${shopAddress}` : ''}</p>
        </div>
        {shopPhone ? <CallPhoneLink phone={shopPhone} label="Call" style={styles.callBtn} /> : null}
      </div>

      <PickupItemsList
        manifest={manifest}
        loading={manifestLoading}
        failed={manifestFailed}
        onRetry={onRetryManifest}
        defaultOpen={false}
      />

      <MiniBlock label="Progress" summary={stepLabel}>
        <LegStepper
          steps={PICKUP_STEPS.map((s) => ({ ...s, label: pickupStepLabel(s.id as 'shop' | 'to_hub' | 'done') }))}
          currentIndex={currentIndex}
          tone="vendor"
        />
        {!isDone ? <p style={styles.hint}>{pickupHint(step)}</p> : null}
      </MiniBlock>

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
      {step === 'to_hub' ? <p style={styles.waitBanner}>Take bag to hub</p> : null}
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
  onDeliver,
}: {
  task: AssignmentView;
  busy: boolean;
  manifest?: DeliveryManifestView;
  manifestLoading?: boolean;
  manifestFailed?: boolean;
  onRetryManifest?: () => void;
  onPickHub: (id: string, status: string) => void;
  onDeliver: (id: string, status: string, otp: string, recipientName?: string) => void;
}) {
  const step = deliveryStep(task.status);
  const currentIndex =
    step === 'done' ? DELIVERY_STEPS.length : stepIndex(step, ['hub', 'en_route', 'done']);
  const [otp, setOtp] = useState('111111');
  const [showCodeBox, setShowCodeBox] = useState(false);
  const when = latestMeta(task);
  const statusLabel =
    step === 'hub' ? 'At hub' : step === 'en_route' ? 'On the way' : 'Delivered';

  return (
    <article style={styles.card}>
      <div style={styles.cardTop}>
        <span
          style={{
            ...styles.statusPill,
            ...(step === 'hub'
              ? styles.statusHub
              : step === 'en_route'
                ? styles.statusRoute
                : styles.statusDone),
          }}
        >
          {statusLabel}
        </span>
        <span style={styles.orderId}>{task.orderNumber}</span>
      </div>

      <div style={styles.headRow}>
        <div style={styles.headMain}>
          {task.destinationName ? <p style={styles.customerName}>{task.destinationName}</p> : null}
          {task.destinationAddress ? (
            <p style={styles.addressOnce} title={task.destinationAddress}>
              {task.destinationLabel ? `${task.destinationLabel} · ` : ''}
              {task.destinationAddress}
            </p>
          ) : task.destinationLabel ? (
            <p style={styles.addressOnce}>{task.destinationLabel}</p>
          ) : (
            <p style={styles.addressWarn}>Address missing</p>
          )}
          {when ? <p style={styles.whenLine}>{when}</p> : null}
        </div>
        {task.destinationPhone ? (
          <CallPhoneLink phone={task.destinationPhone} label="Call" style={styles.callBtn} />
        ) : null}
      </div>

      <PickupItemsList
        manifest={manifest}
        loading={manifestLoading}
        failed={manifestFailed}
        onRetry={onRetryManifest}
        title="Order items"
        showShop
        defaultOpen={false}
      />

      <MiniBlock label="Progress" summary={deliveryStepLabel(step)}>
        <LegStepper
          steps={DELIVERY_STEPS.map((s) => ({
            ...s,
            label: deliveryStepLabel(s.id as 'hub' | 'en_route' | 'done'),
          }))}
          currentIndex={currentIndex}
          tone="buyer"
        />
      </MiniBlock>

      {step !== 'done' ? (
        <div style={styles.actions}>
          {step === 'hub' ? (
            <button
              type="button"
              style={{ ...styles.cta, ...styles.ctaAccent }}
              disabled={busy}
              onClick={() => void onPickHub(task.id, task.status)}
            >
              {busy ? 'Saving…' : 'I took order from hub'}
            </button>
          ) : null}

          {step === 'en_route' && !showCodeBox ? (
            <button
              type="button"
              style={{ ...styles.cta, ...styles.ctaAccent }}
              disabled={busy}
              onClick={() => setShowCodeBox(true)}
            >
              Enter OTP & finish
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
              <p style={styles.otpHelp}>Local/dev: 111111</p>
              <button
                type="button"
                style={{ ...styles.cta, ...styles.ctaAccent }}
                disabled={busy || otp.trim().length < 4}
                onClick={() => void onDeliver(task.id, task.status, otp, 'Customer')}
              >
                {busy ? 'Submitting…' : 'Submit delivery'}
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
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
    padding: '0.55rem 0.65rem',
    display: 'grid',
    gap: '0.35rem',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.4rem',
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
    background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
    color: 'var(--accent)',
  },
  statusRoute: {
    background: 'rgba(245, 158, 11, 0.16)',
    color: '#b45309',
  },
  statusDone: {
    background: 'rgba(22, 163, 74, 0.14)',
    color: '#15803d',
  },
  statusPickup: {
    background: 'rgba(22, 163, 74, 0.14)',
    color: '#15803d',
  },
  orderId: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
    wordBreak: 'break-all',
  },
  headRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.45rem',
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
    padding: '0.4rem 0.55rem',
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 36,
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
  actions: { display: 'grid', gap: '0.35rem' },
  cta: {
    border: 'none',
    borderRadius: 12,
    padding: '0.75rem 0.85rem',
    fontWeight: 800,
    fontSize: '0.92rem',
    cursor: 'pointer',
    width: '100%',
    minHeight: 44,
  },
  ctaAccent: {
    background: 'var(--accent)',
    color: '#fff',
  },
  ctaGreen: {
    background: '#16a34a',
    color: '#fff',
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
