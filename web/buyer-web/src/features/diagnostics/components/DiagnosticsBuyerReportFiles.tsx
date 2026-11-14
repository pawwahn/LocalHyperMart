import { useState, type CSSProperties } from 'react';
import { CollapsibleCard } from '@/shared/ui/CollapsibleCard';
import type { DiagnosticsOrder } from '../api/diagnosticsApi';
import { downloadDiagnosticsReportFile } from '../api/diagnosticsApi';
import { diagnosticsReportReady } from '../lib/diagnosticsOrderProgress';

type Attachment = NonNullable<DiagnosticsOrder['reportAttachments']>[number];

function fileLabel(att: Attachment, index: number): string {
  const isPdf = String(att.contentType ?? '').includes('pdf');
  const kind = att.kind === 'INTERIM' ? 'Interim' : att.kind === 'FINAL' ? 'Final' : 'Report';
  return `${kind} ${isPdf ? 'PDF' : 'image'} ${index + 1}`;
}

export function DiagnosticsBuyerReportFiles({
  order,
  token,
  onError,
  defaultExpanded = false,
}: {
  order: DiagnosticsOrder;
  token: string;
  onError?: (message: string) => void;
  defaultExpanded?: boolean;
}) {
  const files = order.reportAttachments ?? [];
  const reportReady = diagnosticsReportReady(order);
  const interim = reportReady
    ? []
    : files.filter((f) => String(f.kind).toUpperCase() === 'INTERIM');
  const finalFiles = files.filter((f) => String(f.kind).toUpperCase() === 'FINAL');
  const other = files.filter((f) => {
    const k = String(f.kind).toUpperCase();
    return k !== 'INTERIM' && k !== 'FINAL';
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  if (files.length === 0) return null;
  const listedCount = reportReady ? finalFiles.length + other.length : files.length;
  if (listedCount === 0) return null;

  async function openFile(att: Attachment, download: boolean) {
    setBusyId(att.mediaId);
    try {
      const blob = await downloadDiagnosticsReportFile(token, att.url);
      const url = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${order.orderNumber}-${att.mediaId.slice(0, 8)}`;
        a.click();
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Could not open file');
    } finally {
      setBusyId(null);
    }
  }

  function Section({ title, hint, items, accent }: { title: string; hint: string; items: Attachment[]; accent: 'amber' | 'teal' }) {
    if (items.length === 0) return null;
    return (
      <section style={accent === 'amber' ? styles.sectionInterim : styles.sectionFinal}>
        <header style={styles.sectionHead}>
          <h4 style={styles.sectionTitle}>{title}</h4>
          <span style={styles.sectionCount}>{items.length}</span>
        </header>
        <p style={styles.sectionHint}>{hint}</p>
        <ul style={styles.fileGrid}>
          {items.map((att, i) => {
            const isPdf = String(att.contentType ?? '').includes('pdf');
            const busy = busyId === att.mediaId;
            return (
              <li key={att.mediaId} style={styles.fileCard}>
                <div style={styles.previewFrame}>
                  <span style={styles.pdfTile}>{isPdf ? 'PDF' : 'Image'}</span>
                </div>
                <p style={styles.fileName}>{fileLabel(att, i)}</p>
                <div style={styles.fileActions}>
                  <button type="button" style={styles.btnView} disabled={busy} onClick={() => void openFile(att, false)}>
                    {busy ? '…' : 'View'}
                  </button>
                  <button type="button" style={styles.btnDownload} disabled={busy} onClick={() => void openFile(att, true)}>
                    Download
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const summary =
    interim.length > 0
      ? `${interim.length} interim · ${listedCount} file${listedCount === 1 ? '' : 's'}`
      : `${listedCount} file${listedCount === 1 ? '' : 's'}`;

  return (
    <CollapsibleCard title="Lab reports & files" summary={summary} defaultExpanded={defaultExpanded} cardStyle={styles.card}>
      {!reportReady ? (
        <p style={styles.lead}>
          Interim results appear here as soon as the lab uploads them — you do not need to wait for finalization.
        </p>
      ) : null}
      <Section
        title="Interim reports"
        hint="Partial or early results from the lab. Final values may still change."
        items={interim}
        accent="amber"
      />
      <Section
        title="Final report files"
        hint="Uploaded final documents from the lab."
        items={finalFiles}
        accent="teal"
      />
      <Section title="Other files" hint="Additional uploads from the lab." items={other} accent="teal" />
    </CollapsibleCard>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {},
  lead: { margin: '0.35rem 0 0.65rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 },
  sectionInterim: {
    marginTop: '0.55rem',
    padding: '0.65rem',
    borderRadius: 12,
    background: '#fffbeb',
    border: '1px solid #fcd34d',
  },
  sectionFinal: {
    marginTop: '0.55rem',
    padding: '0.65rem',
    borderRadius: 12,
    background: '#ecfdf5',
    border: '1px solid #99f6e4',
  },
  sectionHead: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  sectionTitle: { margin: 0, fontSize: '0.8rem', fontWeight: 800 },
  sectionCount: {
    fontSize: '0.65rem',
    fontWeight: 800,
    padding: '0.12rem 0.38rem',
    borderRadius: 999,
    background: '#fff',
    border: '1px solid var(--border)',
  },
  sectionHint: { margin: '0.3rem 0 0.45rem', fontSize: '0.72rem', color: 'var(--text-muted)' },
  fileGrid: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
    gap: '0.45rem',
  },
  fileCard: {
    borderRadius: 10,
    padding: '0.45rem',
    background: '#fff',
    border: '1px solid var(--border)',
    display: 'grid',
    gap: '0.3rem',
  },
  previewFrame: {
    borderRadius: 8,
    overflow: 'hidden',
    height: 88,
    background: '#f8fafc',
    display: 'grid',
    placeItems: 'center',
  },
  previewImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  pdfTile: {
    fontWeight: 800,
    fontSize: '0.85rem',
    color: '#065f46',
  },
  fileName: { margin: 0, fontSize: '0.68rem', fontWeight: 700, lineHeight: 1.3 },
  fileActions: { display: 'flex', gap: '0.25rem', flexWrap: 'wrap' },
  btnView: {
    flex: 1,
    border: '1px solid #0f766e',
    borderRadius: 8,
    padding: '0.28rem 0.35rem',
    background: '#fff',
    color: '#065f46',
    fontWeight: 800,
    fontSize: '0.65rem',
    cursor: 'pointer',
  },
  btnDownload: {
    flex: 1,
    border: 'none',
    borderRadius: 8,
    padding: '0.28rem 0.35rem',
    background: 'linear-gradient(135deg, #064e3b, #0f766e)',
    color: '#ecfdf5',
    fontWeight: 800,
    fontSize: '0.65rem',
    cursor: 'pointer',
  },
};
