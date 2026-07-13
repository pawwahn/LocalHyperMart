import { useState, type CSSProperties } from 'react';
import { ActionTimeline } from '@/shared/components/ActionTimeline';
import { LegStepper } from './LegStepper';
import { PickupItemsList } from './PickupItemsList';
import type { AssignmentView, PickupManifestView } from '../api/agentApi';
import {
  deliveryHint,
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
  const currentIndex = stepIndex(step, ['shop', 'to_hub', 'done']);
  const canPick = step === 'shop' && !busy;
  const shopName = manifest?.shopName?.trim() || 'Shop';
  const bagShort = task.subOrderNumber?.split('-').pop() || task.subOrderNumber || 'bag';

  return (
    <article style={styles.card}>
      <p style={styles.shopTitle}>🏪 {shopName}</p>
      <p style={styles.bagMeta}>Bag {bagShort}</p>
      <ActionTimeline
        compact
        events={task.events}
        assignedAt={task.assignedAt}
        startedAt={task.startedAt}
        completedAt={task.completedAt}
      />
      <PickupItemsList
        manifest={manifest}
        loading={manifestLoading}
        failed={manifestFailed}
        onRetry={onRetryManifest}
      />
      <p style={styles.hint}>{pickupHint(step)}</p>
      <LegStepper
        steps={PICKUP_STEPS.map((s) => ({ ...s, label: pickupStepLabel(s.id as 'shop' | 'to_hub' | 'done') }))}
        currentIndex={currentIndex}
        tone="vendor"
      />
      {step === 'shop' ? (
        <button
          type="button"
          style={{ ...styles.bigBtn, ...styles.greenBtn, opacity: canPick ? 1 : 0.6 }}
          disabled={!canPick}
          onClick={() => void onPickVendor(task.id, task.status)}
        >
          I took the bag
        </button>
      ) : (
        <p style={step === 'to_hub' ? styles.waitingBox : styles.doneBox}>
          {step === 'to_hub' ? 'Take bag to hub · wait for hub uncle' : 'Done ✓'}
        </p>
      )}
    </article>
  );
}

export function BuyerDeliveryCard({
  task,
  busy,
  onPickHub,
  onDeliver,
}: {
  task: AssignmentView;
  busy: boolean;
  onPickHub: (id: string, status: string) => void;
  onDeliver: (id: string, status: string, otp: string, recipientName?: string) => void;
}) {
  const step = deliveryStep(task.status);
  const currentIndex = stepIndex(step, ['hub', 'en_route', 'done']);
  const [otp, setOtp] = useState('111111');
  const [showCodeBox, setShowCodeBox] = useState(false);

  return (
    <article style={styles.cardBuyer}>
      <p style={styles.orderTitle}>🛵 Customer order</p>
      <p style={styles.orderNo}>{task.orderNumber}</p>
      <ActionTimeline
        compact
        events={task.events}
        assignedAt={task.assignedAt}
        startedAt={task.startedAt}
        completedAt={task.completedAt}
      />
      <p style={styles.hint}>{deliveryHint(step)}</p>
      <LegStepper
        steps={DELIVERY_STEPS.map((s) => ({
          ...s,
          label: deliveryStepLabel(s.id as 'hub' | 'en_route' | 'done'),
        }))}
        currentIndex={currentIndex}
        tone="buyer"
      />
      <div style={styles.actions}>
        {step === 'hub' ? (
          <button
            type="button"
            style={{ ...styles.bigBtn, ...styles.blueBtn }}
            disabled={busy}
            onClick={() => void onPickHub(task.id, task.status)}
          >
            I took order from hub
          </button>
        ) : null}
        {step === 'en_route' && !showCodeBox ? (
          <button
            type="button"
            style={{ ...styles.bigBtn, ...styles.blueBtn }}
            disabled={busy}
            onClick={() => setShowCodeBox(true)}
          >
            Gave to customer · enter code
          </button>
        ) : null}
        {step === 'en_route' && showCodeBox ? (
          <div style={styles.codeBox}>
            <label style={styles.codeLabel} htmlFor={`otp-${task.id}`}>
              Type phone code
            </label>
            <input
              id={`otp-${task.id}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="111111"
              style={styles.codeInput}
              autoFocus
            />
            <p style={styles.codeHelp}>Local/dev code: 111111</p>
            <button
              type="button"
              style={{ ...styles.bigBtn, ...styles.blueBtn, marginTop: 0 }}
              disabled={busy || otp.trim().length < 4}
              onClick={() => void onDeliver(task.id, task.status, otp, 'Customer')}
            >
              {busy ? 'Saving…' : 'Finish delivery'}
            </button>
            <button
              type="button"
              style={styles.cancelBtn}
              disabled={busy}
              onClick={() => setShowCodeBox(false)}
            >
              Back
            </button>
          </div>
        ) : null}
        {step === 'done' ? <p style={styles.doneBox}>Done ✓</p> : null}
      </div>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: 'var(--bg-elevated)',
    border: '3px solid #86efac',
    borderRadius: 16,
    boxShadow: 'var(--shadow-card)',
    padding: '1.1rem 1.15rem',
    display: 'grid',
    gap: '0.45rem',
  },
  cardBuyer: {
    background: 'var(--bg-elevated)',
    border: '3px solid #93c5fd',
    borderRadius: 16,
    boxShadow: 'var(--shadow-card)',
    padding: '1.1rem 1.15rem',
    display: 'grid',
    gap: '0.45rem',
  },
  shopTitle: {
    margin: 0,
    fontWeight: 800,
    fontSize: '1.35rem',
    fontFamily: 'var(--font-display)',
  },
  bagMeta: { margin: 0, color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' },
  orderTitle: { margin: 0, fontWeight: 800, fontSize: '1.2rem', fontFamily: 'var(--font-display)' },
  orderNo: { margin: 0, fontWeight: 700, fontSize: '0.95rem', wordBreak: 'break-all' },
  hint: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '1rem',
    lineHeight: 1.4,
    fontWeight: 700,
  },
  actions: { display: 'grid', gap: '0.5rem', marginTop: '0.25rem' },
  codeBox: {
    display: 'grid',
    gap: '0.55rem',
    padding: '0.85rem',
    borderRadius: 14,
    background: 'rgba(66, 165, 245, 0.1)',
    border: '2px solid rgba(66, 165, 245, 0.35)',
  },
  codeLabel: { fontWeight: 800, fontSize: '1rem' },
  codeInput: {
    width: '100%',
    boxSizing: 'border-box',
    border: '2px solid var(--border)',
    borderRadius: 12,
    padding: '0.95rem 1rem',
    fontSize: '1.6rem',
    fontWeight: 800,
    letterSpacing: '0.2em',
    textAlign: 'center',
  },
  codeHelp: { margin: 0, color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' },
  cancelBtn: {
    border: '2px solid var(--border)',
    borderRadius: 12,
    padding: '0.75rem 1rem',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  bigBtn: {
    marginTop: '0.35rem',
    border: 'none',
    borderRadius: 14,
    padding: '1rem 1.1rem',
    fontWeight: 900,
    fontSize: '1.1rem',
    cursor: 'pointer',
    width: '100%',
  },
  greenBtn: {
    background: '#16a34a',
    color: '#fff',
    boxShadow: '0 6px 16px rgba(22, 163, 74, 0.28)',
  },
  blueBtn: {
    background: 'var(--accent)',
    color: '#fff',
    boxShadow: '0 6px 16px rgba(37, 99, 235, 0.28)',
  },
  waitingBox: {
    margin: '0.35rem 0 0',
    padding: '0.85rem',
    borderRadius: 12,
    background: 'rgba(255, 183, 77, 0.2)',
    color: '#92400e',
    fontSize: '1rem',
    fontWeight: 800,
  },
  doneBox: {
    margin: '0.35rem 0 0',
    padding: '0.85rem',
    borderRadius: 12,
    background: 'rgba(129, 199, 132, 0.2)',
    color: '#047857',
    fontSize: '1rem',
    fontWeight: 800,
  },
};
