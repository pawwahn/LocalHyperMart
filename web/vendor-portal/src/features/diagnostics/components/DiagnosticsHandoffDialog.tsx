import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ConfirmDialog } from '@/shared/ui';
import type { DiagnosticsStaffRow, DiagnosticsVendorOrder } from '../api/diagnosticsApi';

function roleLabel(staff: DiagnosticsStaffRow): string {
  const raw = String(staff.title || staff.roleType || 'Staff').replace(/_/g, ' ').trim().toLowerCase();
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DiagnosticsHandoffDialog({
  open,
  order,
  staff,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  order: DiagnosticsVendorOrder;
  staff: DiagnosticsStaffRow[];
  busy?: boolean;
  onClose: () => void;
  onConfirm: (picked: { id: string; displayName: string; roleLabel: string }) => void;
}) {
  const [pickedId, setPickedId] = useState<string>('');
  const [needPick, setNeedPick] = useState(false);
  const [step, setStep] = useState<'pick' | 'confirm'>('pick');

  useEffect(() => {
    if (open) return;
    setStep('pick');
    setNeedPick(false);
  }, [open]);

  const people = useMemo(
    () =>
      [...(staff ?? [])].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      }),
    [staff],
  );
  const chosen = people.find((s) => s.id === pickedId) ?? null;
  const chosenRole = chosen ? roleLabel(chosen) : '';

  function resetAndClose() {
    if (busy) return;
    setStep('pick');
    setNeedPick(false);
    onClose();
  }

  return (
    <>
      <ConfirmDialog
        open={open && step === 'pick'}
        title="Who is receiving this bag?"
        confirmLabel="Continue"
        cancelLabel="Go back"
        busy={busy}
        description={
          <div style={styles.body}>
            <p style={styles.p}>
              Select any lab staff for {order.orderNumber}. Then confirm the hand-off.
            </p>
            {people.length === 0 ? (
              <p style={styles.warn}>No active lab staff found. Ask a manager to add staff first.</p>
            ) : (
              <ul style={styles.list}>
                {people.map((row) => (
                  <li key={row.id}>
                    <label style={styles.choice}>
                      <input
                        type="radio"
                        name={`handoff-${order.id}`}
                        checked={pickedId === row.id}
                        onChange={() => {
                          setPickedId(row.id);
                          setNeedPick(false);
                        }}
                      />
                      <span>
                        <strong>{row.displayName}</strong>
                        <span style={styles.role}>
                          {' '}
                          {roleLabel(row)}
                          {row.active ? '' : ' · Inactive'}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {needPick ? <p style={styles.warn}>Select a name before you continue.</p> : null}
          </div>
        }
        onClose={resetAndClose}
        onConfirm={() => {
          if (!chosen) {
            setNeedPick(true);
            return;
          }
          setStep('confirm');
        }}
      />
      <ConfirmDialog
        open={open && step === 'confirm'}
        title="Hand this bag to the lab?"
        confirmLabel="Yes, hand off"
        cancelLabel="Change person"
        busy={busy}
        description={
          <div style={styles.body}>
            <p style={styles.p}>
              Confirm you are giving {order.orderNumber} ({order.patientName || 'patient'}) to{' '}
              <strong>{chosen?.displayName}</strong>
              {chosenRole ? ` (${chosenRole})` : ''}.
            </p>
          </div>
        }
        onClose={() => {
          if (busy) return;
          setStep('pick');
        }}
        onConfirm={() => {
          if (!chosen) {
            setStep('pick');
            setNeedPick(true);
            return;
          }
          onConfirm({ id: chosen.id, displayName: chosen.displayName, roleLabel: chosenRole });
        }}
      />
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  body: { display: 'grid', gap: '0.4rem' },
  p: { margin: 0, fontSize: '0.82rem', lineHeight: 1.4 },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: '0.28rem',
    maxHeight: '14rem',
    overflow: 'auto',
  },
  choice: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    minHeight: 44,
    padding: '0.2rem 0.35rem',
    border: '1px solid var(--border)',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  role: { color: 'var(--text-muted)', fontWeight: 650, fontSize: '0.72rem' },
  warn: { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--danger)' },
};
