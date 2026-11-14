import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ConfirmDialog } from '@/shared/ui';
import {
  diagnosticsSamplePhotos,
  MAX_DIAGNOSTICS_SAMPLE_PHOTOS,
  type DiagnosticsStaffRow,
  type DiagnosticsVendorOrder,
} from '../api/diagnosticsApi';
import { cleanDisplayText } from './DiagnosticsDispatchOrderCards';
import { DiagnosticsHandoffDialog } from './DiagnosticsHandoffDialog';
import { DiagnosticsVisitMap } from './DiagnosticsVisitMap';

type Prompt = 'start' | 'reached' | 'identity' | 'samples' | 'handoff' | 'cod' | 'photos' | null;

function speakConfirmPatientName(patientName: string) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  if (!synth) return;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(
    `Confirm patient name. ${patientName}. Ask the patient their name before you collect any sample.`,
  );
  utter.lang = 'en-IN';
  utter.rate = 0.88;
  utter.volume = 1;
  synth.speak(utter);
}

function testNames(order: DiagnosticsVendorOrder): string {
  return (order.lines ?? [])
    .map((l) => l.testName?.trim())
    .filter(Boolean)
    .join(', ');
}

export function DiagnosticsVisitActions({
  order,
  onAction,
  onPhotos,
  staff = [],
}: {
  order: DiagnosticsVendorOrder;
  onAction: (orderId: string, action: string, extra?: Record<string, unknown>) => Promise<boolean | void>;
  onPhotos?: (orderId: string, files: File[]) => void;
  staff?: DiagnosticsStaffRow[];
}) {
  const actions = order.allowedActions ?? [];
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [busy, setBusy] = useState(false);
  const [nameChecked, setNameChecked] = useState(false);
  const [needCheck, setNeedCheck] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const address = cleanDisplayText(order.addressText);
  const tests = useMemo(() => testNames(order), [order]);
  const photoCount = diagnosticsSamplePhotos(order).length;
  const photosLeft = Math.max(0, MAX_DIAGNOSTICS_SAMPLE_PHOTOS - photoCount);

  useEffect(() => {
    if (prompt !== 'identity') return;
    speakConfirmPatientName(order.patientName || 'the patient');
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, [prompt, order.patientName]);

  async function run(action: string, next?: Prompt, extra?: Record<string, unknown>) {
    setBusy(true);
    try {
      const ok = await onAction(order.id, action, extra);
      if (ok === false) return;
      if (next === 'identity') speakConfirmPatientName(order.patientName || 'the patient');
      setPrompt(next ?? null);
      setNameChecked(false);
      setNeedCheck(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.row}>
        {actions.includes('START_COLLECTION') ? (
          <button type="button" style={styles.btn} onClick={() => setPrompt('start')}>
            Start visit
          </button>
        ) : null}
        {actions.includes('REACH_PATIENT') ? (
          <button type="button" style={styles.btn} onClick={() => setPrompt('reached')}>
            Reached patient
          </button>
        ) : null}
        {actions.includes('CONFIRM_PATIENT') ? (
          <button type="button" style={styles.btn} onClick={() => setPrompt('identity')}>
            Confirm patient
          </button>
        ) : null}
        {actions.includes('SAMPLES_COLLECTED') ? (
          <button
            type="button"
            style={photoCount < 1 ? { ...styles.btn, ...styles.btnDisabled } : styles.btn}
            disabled={photoCount < 1}
            title={photoCount < 1 ? 'Upload at least 1 sample photo first' : undefined}
            onClick={() => {
              if (photoCount < 1) return;
              setPrompt('samples');
            }}
          >
            Samples collected
          </button>
        ) : null}
        {actions.includes('RECEIVED_AT_LAB') ? (
          <button type="button" style={styles.btnGhost} onClick={() => setPrompt('handoff')}>
            Hand off to lab
          </button>
        ) : null}
        {actions.includes('MARK_COD_RECEIVED') ? (
          <button type="button" style={styles.btnGhost} onClick={() => setPrompt('cod')}>
            COD received
          </button>
        ) : null}
        {actions.includes('ADD_SAMPLE_PHOTO') && onPhotos && photosLeft > 0 ? (
          <label style={styles.photoLabel}>
            Add sample photos ({photoCount}/{MAX_DIAGNOSTICS_SAMPLE_PHOTOS})
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
                e.target.value = '';
                if (picked.length === 0) return;
                setPendingPhotos(picked.slice(0, photosLeft));
                setPrompt('photos');
              }}
            />
          </label>
        ) : actions.includes('ADD_SAMPLE_PHOTO') ? (
          <span style={styles.photoLabel}>5 photos added</span>
        ) : null}
      </div>

      <ConfirmDialog
        open={prompt === 'start'}
        title="Start collecting this sample?"
        confirmLabel="Yes, start"
        busy={busy}
        description={
          <div style={styles.dialogBody}>
            <p style={styles.warn}>
              Make sure there are no open sample collections before you start a new one.
            </p>
            <p style={styles.p}>
              Travel to this patient only. Finish this visit before opening another kit so tests do not mix.
            </p>
            <p style={styles.meta}>
              <strong>{order.patientName || 'Patient'}</strong>
              {' · '}
              {order.orderNumber}
            </p>
            {tests ? (
              <p style={styles.meta}>
                Samples: <strong>{tests}</strong>
              </p>
            ) : null}
            {address ? <DiagnosticsVisitMap address={address} height={120} compact /> : null}
          </div>
        }
        onClose={() => !busy && setPrompt(null)}
        onConfirm={() => void run('START_COLLECTION')}
      />

      <ConfirmDialog
        open={prompt === 'reached'}
        title="Reached the patient?"
        confirmLabel="Yes"
        busy={busy}
        description="Confirm you are at this address. Next you will verify the patient name before collecting."
        onClose={() => !busy && setPrompt(null)}
        onConfirm={() => void run('REACH_PATIENT', 'identity')}
      />

      <ConfirmDialog
        open={prompt === 'identity'}
        title="Confirm patient name"
        confirmLabel="Yes, name matches"
        extraLabel="Read name"
        busy={busy}
        description={
          <div style={styles.dialogBody}>
            <p style={styles.p}>Ask the patient their name out loud. Collect only if it matches this booking.</p>
            <p style={styles.patientYell}>{order.patientName || '—'}</p>
            <p style={styles.meta}>
              Label vials with <strong>{order.orderNumber}</strong>
              {tests ? ` · ${tests}` : ''}
            </p>
            <label style={styles.check}>
              <input
                type="checkbox"
                checked={nameChecked}
                onChange={(e) => {
                  setNameChecked(e.target.checked);
                  if (e.target.checked) setNeedCheck(false);
                }}
              />
              I asked the patient and the name matches
            </label>
            {needCheck ? <p style={styles.warn}>Tick the box after you hear the patient say their name.</p> : null}
          </div>
        }
        onExtra={() => speakConfirmPatientName(order.patientName || 'the patient')}
        onClose={() => {
          if (busy) return;
          window.speechSynthesis?.cancel();
          setPrompt(null);
          setNameChecked(false);
          setNeedCheck(false);
        }}
        onConfirm={() => {
          if (!nameChecked) {
            setNeedCheck(true);
            speakConfirmPatientName(order.patientName || 'the patient');
            return;
          }
          void run('CONFIRM_PATIENT');
        }}
      />

      <ConfirmDialog
        open={prompt === 'samples'}
        title="Samples collected?"
        confirmLabel="Yes, bagged"
        busy={busy}
        description={
          <div style={styles.dialogBody}>
            <p style={styles.p}>
              Every vial for this visit must show {order.orderNumber} and {order.patientName}. Do not put another
              patient&apos;s tubes in this bag.
            </p>
            {tests ? <p style={styles.meta}>Tests: {tests}</p> : null}
            {photoCount < 1 ? (
              <p style={styles.warn}>Upload at least 1 sample photo before you mark collected.</p>
            ) : null}
          </div>
        }
        onClose={() => !busy && setPrompt(null)}
        onConfirm={() => {
          if (photoCount < 1) return;
          void run('SAMPLES_COLLECTED');
        }}
      />

      <DiagnosticsHandoffDialog
        open={prompt === 'handoff'}
        order={order}
        staff={staff}
        busy={busy}
        onClose={() => !busy && setPrompt(null)}
        onConfirm={(picked) =>
          void run('RECEIVED_AT_LAB', undefined, {
            receivedByStaffId: picked.id,
            receivedByStaffName: picked.displayName,
            note: `Handed to ${picked.displayName}${picked.roleLabel ? ` (${picked.roleLabel})` : ''}`,
          })
        }
      />

      <ConfirmDialog
        open={prompt === 'cod'}
        title="Mark COD received?"
        confirmLabel="Yes, collected"
        busy={busy}
        description={`Confirm cash is in hand for ${order.orderNumber} · ${order.patientName || 'this patient'}.`}
        onClose={() => !busy && setPrompt(null)}
        onConfirm={() => void run('MARK_COD_RECEIVED')}
      />

      <ConfirmDialog
        open={prompt === 'photos'}
        title="Upload sample photos?"
        confirmLabel="Yes, upload"
        busy={busy}
        description={`Attach ${pendingPhotos.length} photo${pendingPhotos.length === 1 ? '' : 's'} to ${order.orderNumber} only. Max ${MAX_DIAGNOSTICS_SAMPLE_PHOTOS} per visit.`}
        onClose={() => {
          if (busy) return;
          setPrompt(null);
          setPendingPhotos([]);
        }}
        onConfirm={() => {
          if (!onPhotos || pendingPhotos.length === 0) return;
          onPhotos(order.id, pendingPhotos);
          setPendingPhotos([]);
          setPrompt(null);
        }}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.4rem', minWidth: 0 },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' },
  btn: {
    border: 'none',
    borderRadius: 10,
    minHeight: 44,
    padding: '0.45rem 0.65rem',
    background: 'linear-gradient(135deg, #064e3b, #0f766e)',
    color: '#ecfdf5',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  btnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  btnGhost: {
    border: '1px solid #0f766e',
    borderRadius: 10,
    minHeight: 44,
    padding: '0.45rem 0.65rem',
    background: '#fff',
    color: '#065f46',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  photoLabel: { fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' },
  kit: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '0.28rem 0.5rem',
    background: '#ecfdf5',
    border: '1px solid #99f6e4',
    borderRadius: 8,
    padding: '0.28rem 0.42rem',
  },
  kitLabel: {
    fontSize: '0.6rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#0f766e',
  },
  kitId: { fontSize: '0.78rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  kitName: { fontSize: '0.78rem', fontWeight: 800 },
  kitTests: { fontSize: '0.7rem', color: 'var(--text-muted)', flex: '1 1 8rem' },
  dialogBody: { display: 'grid', gap: '0.4rem' },
  p: { margin: 0, fontSize: '0.82rem', lineHeight: 1.4 },
  meta: { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  patientYell: {
    margin: 0,
    fontSize: '1.35rem',
    fontWeight: 800,
    color: '#064e3b',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  check: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--text)',
  },
  warn: { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--danger)' },
};
