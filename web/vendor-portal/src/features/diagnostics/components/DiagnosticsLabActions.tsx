import { useState, type CSSProperties } from 'react';
import { ConfirmDialog } from '@/shared/ui';
import type { DiagnosticsPortalProfile, DiagnosticsVendorOrder } from '../api/diagnosticsApi';
import { DiagnosticsHandoffDialog } from './DiagnosticsHandoffDialog';
import { DiagnosticsLabReportAttachments } from './DiagnosticsLabReportAttachments';

export function DiagnosticsLabActions({
  order,
  onAction,
  staff = [],
  token = '',
  allSamplePhotosViewed = true,
}: {
  order: DiagnosticsVendorOrder;
  onAction: (orderId: string, action: string, extra?: Record<string, unknown>) => Promise<boolean | void> | void;
  staff?: DiagnosticsPortalProfile['staff'];
  token?: string;
  allSamplePhotosViewed?: boolean;
}) {
  const [prompt, setPrompt] = useState<'receive' | 'finalize' | 'eta' | 'etaEdit' | 'confirmSamples' | null>(null);
  const [pendingEta, setPendingEta] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const samplesConfirmed = Boolean(order.samplesBenchConfirmedAt);
  const canConfirmSamples = (order.allowedActions ?? []).includes('CONFIRM_SAMPLES_RECEIVED');
  const confirmSamplesReady = canConfirmSamples && allSamplePhotosViewed;
  const hasReportFiles = (order.reportAttachments?.length ?? 0) > 0;
  const apiAllowsFinalize = (order.allowedActions ?? []).includes('FINALIZE');
  const canFinalize = apiAllowsFinalize && hasReportFiles;
  const benchReportStatus = /REPORT_ETA_SET|REPORT_IN_PROGRESS/i.test(String(order.status ?? ''));
  const showFinalizeSlot =
    apiAllowsFinalize ||
    (samplesConfirmed && benchReportStatus) ||
    (!samplesConfirmed && /REPORT/i.test(String(order.status ?? '')));
  const canSetEta = order.allowedActions?.includes('SET_REPORT_ETA');
  const showReceive = order.allowedActions?.includes('RECEIVED_AT_LAB');
  const hasReportEta = Boolean(order.reportEta);

  async function run(action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    try {
      await onAction(order.id, action, extra);
      setPrompt(null);
      setPendingEta(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.benchPanel}>
      <div style={styles.benchHead}>
        <div style={styles.benchTitleBlock}>
          <span style={styles.benchMark} aria-hidden />
          <div>
            <span style={styles.benchTitle}>Lab bench</span>
            <span style={styles.benchSubtitle}>Confirm · upload · schedule · finalize</span>
          </div>
        </div>
        {hasReportEta ? (
          canSetEta ? (
            <button
              type="button"
              style={styles.etaChipButton}
              title="Change report ETA"
              onClick={() => setPrompt('etaEdit')}
            >
              ETA · {formatReportEtaChip(order.reportEta!)}
              <span style={styles.etaEditMark} aria-hidden>
                ✎
              </span>
            </button>
          ) : (
            <span style={styles.etaChip}>
              ETA · {formatReportEtaChip(order.reportEta!)}
            </span>
          )
        ) : null}
      </div>

      {samplesConfirmed ? (
        <div style={styles.confirmedStrip}>
          <span style={styles.confirmedIcon} aria-hidden>
            ✓
          </span>
          <div style={styles.confirmedCopy}>
            <strong>Samples verified</strong>
            <span>
              {order.patientName || 'Patient'}
              {order.samplesBenchConfirmedAt
                ? ` · ${new Date(order.samplesBenchConfirmedAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`
                : ''}
            </span>
          </div>
        </div>
      ) : canConfirmSamples ? (
        <div style={styles.confirmStep}>
          <span style={styles.stepBadge}>2</span>
          <div style={styles.confirmCopy}>
            <strong style={styles.confirmTitle}>Confirm samples received</strong>
            <span style={styles.confirmHint}>
              {allSamplePhotosViewed
                ? 'Photos reviewed — confirm the bag matches this patient.'
                : 'Review every sample photo above first.'}
            </span>
          </div>
          <button
            type="button"
            style={confirmSamplesReady ? styles.btnPrimary : styles.btnDisabled}
            disabled={!confirmSamplesReady || busy}
            title={!allSamplePhotosViewed ? 'Open every sample photo above to cross-check first' : undefined}
            onClick={() => confirmSamplesReady && setPrompt('confirmSamples')}
          >
            Confirm
          </button>
        </div>
      ) : null}

      <div style={styles.workGrid}>
        {token ? <DiagnosticsLabReportAttachments order={order} token={token} onAction={onAction} /> : null}
        {canSetEta && !hasReportEta ? (
          <EtaPicker
            onConfirm={(iso) => {
              setPendingEta(iso);
              setPrompt('eta');
            }}
          />
        ) : null}
      </div>

      {(showFinalizeSlot || showReceive) && (
        <div style={styles.benchActions}>
          {showReceive ? (
            <button type="button" style={styles.btnSecondary} onClick={() => setPrompt('receive')}>
              Received at lab
            </button>
          ) : null}
          {showFinalizeSlot ? (
            <button
              type="button"
              style={canFinalize ? styles.btnFinalize : styles.btnDisabled}
              disabled={!canFinalize || busy}
              title={
                !hasReportFiles
                  ? 'Upload at least one report file first'
                  : !samplesConfirmed
                    ? 'Confirm samples received for this patient first'
                    : undefined
              }
              onClick={() => canFinalize && setPrompt('finalize')}
            >
              Finalize report
            </button>
          ) : null}
        </div>
      )}

      <DiagnosticsHandoffDialog
        open={prompt === 'receive'}
        order={order}
        staff={staff}
        busy={busy}
        onClose={() => !busy && setPrompt(null)}
        onConfirm={(picked) =>
          void run('RECEIVED_AT_LAB', {
            receivedByStaffId: picked.id,
            receivedByStaffName: picked.displayName,
            note: `Handed to ${picked.displayName}${picked.roleLabel ? ` (${picked.roleLabel})` : ''}`,
          })
        }
      />
      <ConfirmDialog
        open={prompt === 'confirmSamples'}
        title="Confirm samples received?"
        confirmLabel="Yes, samples match patient"
        busy={busy}
        description={`Confirm the bag for ${order.orderNumber} belongs to ${order.patientName || 'this patient'} before you finalize the report.`}
        onClose={() => !busy && setPrompt(null)}
        onConfirm={() => void run('CONFIRM_SAMPLES_RECEIVED')}
      />
      {prompt === 'etaEdit' && canSetEta ? (
        <EtaPicker
          key={`edit-${order.reportEta ?? 'new'}`}
          initialIso={order.reportEta}
          layout="dialog"
          onCancel={() => setPrompt(null)}
          onConfirm={(iso) => {
            setPendingEta(iso);
            setPrompt('eta');
          }}
        />
      ) : null}
      <ConfirmDialog
        open={prompt === 'eta'}
        title={hasReportEta ? 'Update report ETA?' : 'Set report ETA?'}
        confirmLabel={hasReportEta ? 'Yes, update ETA' : 'Yes, set ETA'}
        busy={busy}
        description={`ETA for ${order.orderNumber}${pendingEta ? `: ${new Date(pendingEta).toLocaleString('en-IN')}` : ''}.`}
        onClose={() => {
          if (busy) return;
          setPrompt(null);
          setPendingEta(null);
        }}
        onConfirm={() => {
          if (!pendingEta) return;
          void run('SET_REPORT_ETA', { reportEta: pendingEta });
        }}
      />
      <ConfirmDialog
        open={prompt === 'finalize'}
        title="Finalize this report?"
        confirmLabel="Yes, finalize"
        busy={busy}
        description={`Patient ${order.patientName || ''} · ${order.orderNumber}. This marks the report ready for the buyer.`}
        onClose={() => !busy && setPrompt(null)}
        onConfirm={() => void run('FINALIZE')}
      />
    </div>
  );
}

function formatReportEtaChip(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EtaPicker({
  initialIso,
  layout = 'card',
  onConfirm,
  onCancel,
}: {
  initialIso?: string | null;
  layout?: 'card' | 'dialog';
  onConfirm: (iso: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(() => toDatetimeLocalValue(initialIso));
  const hasEta = Boolean(value);
  const isUpdate = Boolean(initialIso);
  const body = (
    <>
      <div style={styles.etaHead}>
        <span style={styles.etaLabel}>{isUpdate ? 'Update report ETA' : 'Report ETA'}</span>
        <span style={styles.etaHint}>Customer sees this on their order</span>
      </div>
      <div style={styles.etaRow}>
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={hasEta ? styles.etaInputReady : styles.etaInput}
          aria-label="Report ready by"
        />
        <button
          type="button"
          style={hasEta ? styles.btnEta : styles.btnEtaDisabled}
          disabled={!hasEta}
          onClick={() => {
            if (!value) return;
            onConfirm(new Date(value).toISOString());
          }}
        >
          {isUpdate ? 'Update ETA' : 'Set ETA'}
        </button>
        {layout === 'dialog' && onCancel ? (
          <button type="button" style={styles.btnSecondaryCompact} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </>
  );
  if (layout === 'dialog') {
    return (
      <div style={styles.etaDialogBackdrop} role="presentation" onClick={onCancel}>
        <div
          style={styles.etaDialogCard}
          role="dialog"
          aria-label="Update report ETA"
          onClick={(e) => e.stopPropagation()}
        >
          {body}
        </div>
      </div>
    );
  }
  return <div style={styles.etaCard}>{body}</div>;
}

const styles: Record<string, CSSProperties> = {
  benchPanel: {
    width: '100%',
    padding: '0.5rem 0.55rem 0.55rem',
    borderRadius: 14,
    background: 'linear-gradient(168deg, #ffffff 0%, #f0fdfa 48%, #ecfdf5 100%)',
    border: '1px solid color-mix(in srgb, #0f766e 35%, var(--border))',
    boxShadow: '0 4px 18px rgba(6, 78, 59, 0.08), inset 0 1px 0 rgba(255,255,255,0.95)',
    display: 'grid',
    gap: '0.42rem',
  },
  benchHead: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.35rem',
  },
  benchTitleBlock: { display: 'flex', alignItems: 'flex-start', gap: '0.4rem', minWidth: 0 },
  benchMark: {
    width: 4,
    height: 34,
    borderRadius: 999,
    background: 'linear-gradient(180deg, #14b8a6, #065f46)',
    flexShrink: 0,
    marginTop: 2,
  },
  benchTitle: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: '#064e3b',
  },
  benchSubtitle: { display: 'block', fontSize: '0.66rem', fontWeight: 500, color: 'var(--text-muted)', marginTop: '0.06rem' },
  etaChip: {
    fontSize: '0.68rem',
    fontWeight: 700,
    padding: '0.22rem 0.5rem',
    borderRadius: 999,
    background: '#fff',
    border: '1px solid #99f6e4',
    color: '#0f766e',
    boxShadow: '0 1px 2px rgba(15, 118, 110, 0.12)',
  },
  etaChipButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.28rem',
    fontSize: '0.68rem',
    fontWeight: 700,
    padding: '0.22rem 0.5rem',
    borderRadius: 999,
    background: '#fff',
    border: '1px solid #99f6e4',
    color: '#0f766e',
    boxShadow: '0 1px 2px rgba(15, 118, 110, 0.12)',
    cursor: 'pointer',
  },
  etaEditMark: { fontSize: '0.62rem', opacity: 0.85 },
  etaDialogBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 1200,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(15, 23, 42, 0.45)',
  },
  etaDialogCard: {
    width: 'min(22rem, 100%)',
    padding: '0.65rem 0.7rem',
    borderRadius: 12,
    background: '#fff',
    border: '1px solid color-mix(in srgb, var(--border) 78%, #0f766e 22%)',
    boxShadow: '0 12px 40px rgba(15, 23, 42, 0.18)',
  },
  btnSecondaryCompact: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    minHeight: 40,
    padding: '0.38rem 0.65rem',
    background: '#fff',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  confirmedStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.38rem 0.45rem',
    borderRadius: 11,
    background: '#ecfdf5',
    border: '1px solid #99f6e4',
  },
  confirmedIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.82rem',
    fontWeight: 900,
    color: '#fff',
    background: 'linear-gradient(135deg, #0f766e, #047857)',
  },
  confirmedCopy: {
    display: 'grid',
    gap: '0.04rem',
    fontSize: '0.72rem',
    color: '#065f46',
  },
  confirmStep: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.42rem',
    padding: '0.4rem 0.45rem',
    borderRadius: 11,
    background: '#fff',
    border: '1px solid color-mix(in srgb, #0f766e 25%, var(--border))',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
  },
  stepBadge: {
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
  },
  confirmCopy: { flex: '1 1 10rem', minWidth: 0, display: 'grid', gap: '0.08rem' },
  confirmTitle: { fontSize: '0.76rem', color: '#064e3b' },
  confirmHint: { fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  workGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(11.5rem, 1fr))',
    gap: '0.42rem',
    alignItems: 'stretch',
  },
  benchActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    paddingTop: '0.08rem',
  },
  btnPrimary: {
    flex: '0 0 auto',
    border: 'none',
    borderRadius: 10,
    minHeight: 44,
    padding: '0.45rem 0.85rem',
    background: 'linear-gradient(135deg, #064e3b, #0f766e)',
    color: '#ecfdf5',
    fontWeight: 800,
    fontSize: '0.74rem',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(6, 78, 59, 0.28)',
  },
  btnFinalize: {
    flex: '1 1 auto',
    border: 'none',
    borderRadius: 10,
    minHeight: 44,
    padding: '0.45rem 0.85rem',
    background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
    color: '#eff6ff',
    fontWeight: 800,
    fontSize: '0.74rem',
    cursor: 'pointer',
    boxShadow: '0 2px 10px rgba(37, 99, 235, 0.25)',
  },
  btnSecondary: {
    flex: '0 1 auto',
    border: '1px solid color-mix(in srgb, var(--border) 80%, #0f766e)',
    borderRadius: 10,
    minHeight: 44,
    padding: '0.45rem 0.75rem',
    background: '#fff',
    color: '#065f46',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  btnDisabled: {
    flex: '0 0 auto',
    border: 'none',
    borderRadius: 10,
    minHeight: 44,
    padding: '0.45rem 0.85rem',
    background: '#e2e8f0',
    color: '#94a3b8',
    fontWeight: 800,
    fontSize: '0.74rem',
    cursor: 'not-allowed',
  },
  etaCard: {
    display: 'grid',
    gap: '0.35rem',
    padding: '0.48rem 0.5rem',
    borderRadius: 12,
    background: '#fff',
    border: '1px solid color-mix(in srgb, var(--border) 78%, #0f766e 22%)',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
    height: '100%',
    alignContent: 'start',
  },
  etaHead: { display: 'grid', gap: '0.06rem' },
  etaLabel: {
    fontSize: '0.72rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#065f46',
  },
  etaHint: { fontSize: '0.65rem', color: 'var(--text-muted)' },
  etaRow: { display: 'flex', flexWrap: 'wrap', gap: '0.32rem', alignItems: 'center' },
  etaInput: {
    flex: '1 1 9rem',
    minWidth: 0,
    border: '1px solid color-mix(in srgb, var(--border) 90%, #f97316)',
    borderRadius: 9,
    padding: '0.38rem 0.45rem',
    fontSize: '0.78rem',
    background: '#fffbeb',
  },
  etaInputReady: {
    flex: '1 1 9rem',
    minWidth: 0,
    border: '1px solid #0f766e',
    borderRadius: 9,
    padding: '0.38rem 0.45rem',
    fontSize: '0.78rem',
    background: '#fff',
  },
  btnEta: {
    border: '1px solid #0f766e',
    borderRadius: 10,
    minHeight: 40,
    padding: '0.38rem 0.65rem',
    background: 'linear-gradient(135deg, #ecfdf5, #fff)',
    color: '#065f46',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  btnEtaDisabled: {
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    minHeight: 40,
    padding: '0.38rem 0.65rem',
    background: '#f8fafc',
    color: '#94a3b8',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'not-allowed',
  },
};
