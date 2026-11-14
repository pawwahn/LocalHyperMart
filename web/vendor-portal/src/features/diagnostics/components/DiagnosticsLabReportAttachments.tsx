import { useRef, useState, type CSSProperties } from 'react';
import { ConfirmDialog } from '@/shared/ui';
import {
  MAX_DIAGNOSTICS_REPORT_ATTACHMENTS,
  uploadDiagnosticsReportFile,
  type DiagnosticsReportAttachment,
  type DiagnosticsVendorOrder,
} from '../api/diagnosticsApi';

type ReportKind = 'INTERIM' | 'FINAL';

export function DiagnosticsLabReportAttachments({
  order,
  token,
  onAction,
}: {
  order: DiagnosticsVendorOrder;
  token: string;
  onAction: (orderId: string, action: string, extra?: Record<string, unknown>) => Promise<boolean | void> | void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const attachments = order.reportAttachments ?? [];
  const allowed = order.allowedActions ?? [];
  const samplesConfirmed = Boolean(order.samplesBenchConfirmedAt);
  const canAdd = allowed.includes('ADD_REPORT_ATTACHMENT');
  const awaitingSampleConfirm = allowed.includes('CONFIRM_SAMPLES_RECEIVED');
  const canRemove = allowed.includes('REMOVE_REPORT_ATTACHMENT');
  const atMax = attachments.length >= MAX_DIAGNOSTICS_REPORT_ATTACHMENTS;

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [kindPrompt, setKindPrompt] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DiagnosticsReportAttachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadReady = samplesConfirmed && !atMax && !busy;

  function openPicker() {
    fileRef.current?.click();
  }

  function onFilePicked(file: File | undefined) {
    if (!file || !samplesConfirmed) return;
    setPendingFile(file);
    setKindPrompt(true);
  }

  async function uploadWithKind(kind: ReportKind) {
    if (!pendingFile || !token || busy) return;
    setBusy(true);
    setUploadError(null);
    try {
      const mediaId = await uploadDiagnosticsReportFile(token, pendingFile);
      const ok = await onAction(order.id, 'ADD_REPORT_ATTACHMENT', { mediaId, reportKind: kind });
      if (!ok) {
        throw new Error('Could not attach this file to the booking. See the error above and retry.');
      }
      setPendingFile(null);
      setKindPrompt(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  if (!canAdd && !awaitingSampleConfirm && attachments.length === 0) return null;

  const countTone =
    attachments.length >= MAX_DIAGNOSTICS_REPORT_ATTACHMENTS
      ? styles.countFull
      : attachments.length > 0
        ? styles.countPartial
        : styles.count;

  return (
    <section style={styles.block} aria-label="Report files">
      <div style={styles.headRow}>
        <div style={styles.headCopy}>
          <span style={styles.stepBadge}>3</span>
          <div>
            <span style={styles.label}>Report files</span>
            <p style={styles.sub}>Interim uploads appear on the customer order immediately.</p>
          </div>
        </div>
        <span style={countTone}>
          {attachments.length}/{MAX_DIAGNOSTICS_REPORT_ATTACHMENTS}
        </span>
      </div>
      {canAdd || awaitingSampleConfirm ? (
        <button
          type="button"
          style={uploadReady ? styles.btnUpload : styles.btnGhostDisabled}
          disabled={!uploadReady}
          title={
            !samplesConfirmed
              ? 'Confirm samples received before uploading reports'
              : atMax
                ? 'Maximum attachments reached'
                : undefined
          }
          onClick={() => uploadReady && openPicker()}
        >
          {uploadReady ? (
            <span style={styles.uploadIcon} aria-hidden>
              ↑
            </span>
          ) : null}
          Upload report
        </button>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => onFilePicked(e.target.files?.[0])}
      />
      {attachments.length > 0 ? (
        <div style={styles.attachGrid}>
          {attachments.map((att) => (
            <div key={att.mediaId} style={styles.attachCard}>
              <div style={styles.preview}>
                {String(att.contentType ?? '').includes('pdf') ? (
                  <a href={att.url} target="_blank" rel="noreferrer" style={styles.pdfLink}>
                    PDF
                  </a>
                ) : (
                  <a href={att.url} target="_blank" rel="noreferrer" style={styles.photoLink}>
                    <img src={att.url} alt="" style={styles.thumb} />
                  </a>
                )}
              </div>
              <span style={att.kind === 'INTERIM' ? styles.kindInterim : styles.kindFinal}>
                {att.kind === 'INTERIM' ? 'Interim' : 'Final'}
              </span>
              {canRemove ? (
                <button
                  type="button"
                  style={styles.delete}
                  aria-label="Remove attachment"
                  onClick={() => setPendingDelete(att)}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p style={styles.hint}>Upload PDF or images (max {MAX_DIAGNOSTICS_REPORT_ATTACHMENTS}).</p>
      )}

      <ConfirmDialog
        open={kindPrompt && Boolean(pendingFile)}
        title="Interim or final report?"
        confirmLabel={busy ? 'Uploading…' : 'Interim report'}
        busy={busy}
        extraLabel="Final report"
        extraDisabled={busy}
        onExtra={() => void uploadWithKind('FINAL')}
        description={
          pendingFile ? (
            <>
              <p style={{ margin: 0 }}>
                Attach “{pendingFile.name}” to {order.patientName || order.orderNumber}. Interim is shared with the
                customer immediately.
              </p>
              {uploadError ? (
                <p style={{ margin: '0.5rem 0 0', color: '#b91c1c', fontWeight: 700, fontSize: '0.85rem' }}>{uploadError}</p>
              ) : null}
            </>
          ) : (
            ''
          )
        }
        onClose={() => {
          if (busy) return;
          setKindPrompt(false);
          setPendingFile(null);
          setUploadError(null);
          if (fileRef.current) fileRef.current.value = '';
        }}
        onConfirm={() => void uploadWithKind('INTERIM')}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Remove this attachment?"
        confirmLabel="Yes, remove"
        danger
        busy={busy}
        description="The file will be deleted. You can upload a replacement if needed."
        onClose={() => !busy && setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          setBusy(true);
          void Promise.resolve(
            onAction(order.id, 'REMOVE_REPORT_ATTACHMENT', { mediaId: pendingDelete.mediaId }),
          ).finally(() => {
            setBusy(false);
            setPendingDelete(null);
          });
        }}
      />
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  block: {
    display: 'grid',
    gap: '0.4rem',
    width: '100%',
    height: '100%',
    padding: '0.48rem 0.5rem',
    borderRadius: 12,
    background: '#fff',
    border: '1px solid color-mix(in srgb, var(--border) 78%, #0f766e 22%)',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
    alignContent: 'start',
  },
  headRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.45rem' },
  headCopy: { display: 'flex', gap: '0.38rem', alignItems: 'flex-start', minWidth: 0 },
  stepBadge: {
    flexShrink: 0,
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
  label: { fontSize: '0.72rem', fontWeight: 800, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.04em' },
  sub: { margin: '0.1rem 0 0', fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  count: {
    flexShrink: 0,
    fontSize: '0.7rem',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    color: '#64748b',
    padding: '0.2rem 0.45rem',
    borderRadius: 999,
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
  },
  countPartial: {
    flexShrink: 0,
    fontSize: '0.7rem',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    color: '#0f766e',
    padding: '0.2rem 0.45rem',
    borderRadius: 999,
    background: '#ecfdf5',
    border: '1px solid #99f6e4',
  },
  countFull: {
    flexShrink: 0,
    fontSize: '0.7rem',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    color: '#b45309',
    padding: '0.2rem 0.45rem',
    borderRadius: 999,
    background: '#fffbeb',
    border: '1px solid #fcd34d',
  },
  hint: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' },
  attachGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '0.45rem' },
  attachCard: {
    position: 'relative',
    padding: '0.4rem',
    borderRadius: 10,
    border: '1px solid #64748b',
    background: '#fff',
    display: 'grid',
    justifyItems: 'center',
    gap: '0.28rem',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
  },
  preview: { width: 64, height: 64, display: 'grid', placeItems: 'center' },
  thumb: { width: 64, height: 64, objectFit: 'cover', borderRadius: 8, display: 'block' },
  photoLink: { display: 'block' },
  pdfLink: {
    display: 'inline-grid',
    placeItems: 'center',
    width: 64,
    height: 64,
    borderRadius: 8,
    background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
    color: '#065f46',
    fontWeight: 800,
    fontSize: '0.72rem',
    textDecoration: 'none',
  },
  kindInterim: {
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.12rem 0.32rem',
    borderRadius: 999,
    background: '#fef3c7',
    color: '#92400e',
  },
  kindFinal: {
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.12rem 0.32rem',
    borderRadius: 999,
    background: '#d1fae5',
    color: '#065f46',
  },
  delete: {
    position: 'absolute',
    top: 4,
    right: 4,
    border: 'none',
    borderRadius: 999,
    width: 22,
    height: 22,
    background: '#991b1b',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
  },
  btnUpload: {
    justifySelf: 'start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    border: '1px solid #0f766e',
    borderRadius: 10,
    minHeight: 40,
    padding: '0.38rem 0.7rem',
    background: 'linear-gradient(135deg, #ecfdf5 0%, #fff 100%)',
    color: '#065f46',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(15, 118, 110, 0.15)',
  },
  uploadIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.85rem',
    fontWeight: 900,
    background: '#0f766e',
    color: '#ecfdf5',
  },
  btnGhostDisabled: {
    justifySelf: 'start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    border: '1px dashed #cbd5e1',
    borderRadius: 10,
    minHeight: 40,
    padding: '0.38rem 0.7rem',
    background: '#f8fafc',
    color: 'var(--text-muted)',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'not-allowed',
  },
};
