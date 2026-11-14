import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { OrderStatusTimeline } from '@/features/shop/components/OrderStatusTimeline';
import {
  cancelDiagnosticsOrder,
  downloadDiagnosticsReportFile,
  downloadDiagnosticsReportPdf,
  fetchDiagnosticsOrder,
  retryDiagnosticsPayment,
  type DiagnosticsOrder,
} from '../api/diagnosticsApi';
import { buildDiagnosticsBuyerTimeline, diagnosticsReportReady } from '../lib/diagnosticsOrderProgress';
import { isPdfReportAttachment, primaryFinalReportAttachment } from '../lib/diagnosticsPrimaryReport';
import { DiagnosticsBuyerReportFiles } from '../components/DiagnosticsBuyerReportFiles';
import { CollapsibleCard } from '@/shared/ui/CollapsibleCard';
import { CheckoutDismissedError, openGatewayCheckout } from '@/features/shop/lib/gatewayCheckout';
import { resolveOnlineCheckout } from '@/features/shop/lib/loadOnlineCheckout';
import { confirmOnlinePaymentResilient } from '@/features/shop/api/shopApi';
import { PaymentGatewayChoices, usePaymentGateways } from '@/features/shop/components/PaymentGatewayChoices';
import { useBuyerAlerts } from '@/features/shop/hooks/useBuyerAlerts';

function money(value: number): string {
  const amount = Number(value) || 0;
  return Number.isInteger(amount) ? `₹${amount}` : `₹${amount.toFixed(2)}`;
}

function when(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function DiagnosticsOrderPage() {
  const { orderId = '' } = useParams();
  const { markOrderSeen } = useBuyerAlerts();
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const { options: paymentGateways, gateway: paymentGateway, setGateway: setPaymentGateway } = usePaymentGateways(token);
  const [order, setOrder] = useState<DiagnosticsOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (orderId) markOrderSeen(orderId);
  }, [orderId, markOrderSeen]);

  useEffect(() => {
    if (!token || !orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchDiagnosticsOrder(token, orderId)
      .then((row) => {
        if (!cancelled) {
          setError(null);
          setOrder(row);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load order');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, token]);

  const timeline = useMemo(() => {
    if (!order) return [];
    return buildDiagnosticsBuyerTimeline(order).map((row) => ({
      code: row.label,
      label: row.label,
      state: row.current ? 'CURRENT' : row.done ? 'DONE' : 'UPCOMING',
      at: row.at ?? undefined,
    }));
  }, [order]);

  const total = order
    ? order.totalAmount != null
      ? Number(order.totalAmount)
      : Number(order.testsSubtotal) +
          Number(order.homeCollectionFee || 0) +
          Number(order.platformFeeAmount || 0) +
          Number(order.codFee || 0)
    : 0;

  const reportReady = order ? diagnosticsReportReady(order) : false;
  const hasUploadedReports = (order?.reportAttachments?.length ?? 0) > 0;
  const labFinalReport = order ? primaryFinalReportAttachment(order) : null;

  async function loadReport(): Promise<{ blob: Blob; fileName: string }> {
    if (!token || !order) throw new Error('Missing order');
    const uploaded = primaryFinalReportAttachment(order);
    if (uploaded) {
      const blob = await downloadDiagnosticsReportFile(token, uploaded.url);
      const ext = isPdfReportAttachment(uploaded) ? 'pdf' : 'report';
      return { blob, fileName: `report-${order.orderNumber}.${ext}` };
    }
    const blob = await downloadDiagnosticsReportPdf(token, order.id);
    return { blob, fileName: `report-${order.orderNumber}.pdf` };
  }

  async function doViewReport() {
    if (!token || !order) return;
    setBusy(true);
    setError(null);
    try {
      const { blob } = await loadReport();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open report');
    } finally {
      setBusy(false);
    }
  }

  async function doDownloadReport() {
    if (!token || !order) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, fileName } = await loadReport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusy(false);
    }
  }

  async function doPayNow() {
    if (!token || !order) return;
    setBusy(true);
    setError(null);
    try {
      const poll = { intervalMs: 200, timeoutMs: 8_000 };
      const checkout = await resolveOnlineCheckout({
        token,
        payment: {
          paymentId: order.payment?.paymentId,
          checkout: order.payment?.checkout,
        },
        paymentGateway,
        poll,
        retry: async () => {
          const r = await retryDiagnosticsPayment(token, order.id, paymentGateway);
          return { paymentId: r.paymentId, checkout: r.checkout };
        },
      });
      const paid = await openGatewayCheckout(checkout, { contact: session?.phone });
      await confirmOnlinePaymentResilient(token, paid);
      setOrder(await fetchDiagnosticsOrder(token, order.id));
    } catch (err) {
      if (!(err instanceof CheckoutDismissedError)) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Payment failed');
      }
    } finally {
      setBusy(false);
    }
  }

  async function doCancel() {
    if (!token || !order) return;
    setBusy(true);
    setError(null);
    try {
      setOrder(await cancelDiagnosticsOrder(token, order.id));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Diagnostics order" showDeliveryBanner={false} showStickyCart={false}>
      <div style={styles.pageRail}>
        <Link to="/orders" style={styles.back}>
          ‹ My orders
        </Link>
        {loading ? <p style={styles.muted}>Loading…</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
        {order ? (
          <div style={styles.stack}>
            <article style={styles.card}>
              <div style={styles.head}>
                <strong>{order.orderNumber}</strong>
                <span style={styles.pill}>{order.statusLabel}</span>
              </div>
              <p style={styles.line}>
                {order.shopName} · {money(total)} ·{' '}
                {/^(UPI|ONLINE)$/i.test(String(order.paymentMethod ?? '')) ? 'Prepaid' : 'COD'}
              </p>
              <p style={styles.muted}>Patient: {order.patientName}</p>
              {order.referenceType === 'DOCTOR' && order.referringDoctorName ? (
                <p style={styles.muted}>Referred by {order.referringDoctorName}</p>
              ) : null}
              {order.addressText ? <p style={styles.muted}>{order.addressText}</p> : null}
              {order.slotStart ? (
                <p style={styles.row}>
                  <span>Collection slot</span>
                  <strong>
                    {when(order.slotStart)}
                    {order.slotEnd ? ` – ${when(order.slotEnd)}` : ''}
                  </strong>
                </p>
              ) : null}
              {order.reportEta ? (
                <p style={styles.row}>
                  <span>Report ETA</span>
                  <strong>{when(order.reportEta)}</strong>
                </p>
              ) : null}
            </article>

            {timeline.length > 0 ? (
              <OrderStatusTimeline
                steps={timeline}
                orderStatus={order.status}
                displayStatus={order.statusLabel}
                defaultExpanded={false}
              />
            ) : null}

            {order.status === 'AWAITING_PAYMENT' && /^(UPI|ONLINE)$/i.test(String(order.paymentMethod ?? '')) ? (
              <article style={styles.card}>
                <h3 style={styles.sectionTitle}>Complete payment</h3>
                <p style={styles.muted}>Your booking is held until payment succeeds.</p>
                <PaymentGatewayChoices options={paymentGateways} value={paymentGateway} onChange={setPaymentGateway} />
                <button type="button" style={styles.download} disabled={busy} onClick={() => void doPayNow()}>
                  {busy ? 'Opening…' : `Pay now · ${money(total)}`}
                </button>
              </article>
            ) : null}

            <CollapsibleCard
              title="Tests"
              summary={`${order.lines.length} test${order.lines.length === 1 ? '' : 's'} · ${money(total)}`}
              defaultExpanded={false}
            >
              <ul style={styles.lines} className="hlm-row-stripe-list">
                {order.lines.map((line) => (
                  <li key={line.id} style={styles.item} className="hlm-row-stripe">
                    <span style={styles.itemName}>{line.testName}</span>
                    <span style={styles.itemPrice}>{money(line.unitPrice)}</span>
                    {line.resultValue ? (
                      <span style={styles.result}>
                        {line.resultValue}
                        {line.resultUnit ? ` ${line.resultUnit}` : ''}
                        {line.referenceRange ? ` (ref ${line.referenceRange})` : ''}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CollapsibleCard>

            {hasUploadedReports && order ? (
              <DiagnosticsBuyerReportFiles
                order={order}
                token={token}
                defaultExpanded={false}
                onError={(message) => setError(message)}
              />
            ) : null}

            {reportReady ? (
              <article style={styles.card}>
                <h3 style={styles.sectionTitle}>Report</h3>
                <p style={styles.muted}>
                  {labFinalReport
                    ? 'Your lab shared the final report — open or save the file they uploaded.'
                    : 'View the summary report built from results entered by your lab.'}
                </p>
                <div style={styles.reportActions}>
                  <button type="button" style={styles.viewReport} disabled={busy} onClick={() => void doViewReport()}>
                    {busy ? '…' : 'View report'}
                  </button>
                  <button type="button" style={styles.download} disabled={busy} onClick={() => void doDownloadReport()}>
                    {labFinalReport && !isPdfReportAttachment(labFinalReport) ? 'Download report' : 'Download report PDF'}
                  </button>
                </div>
              </article>
            ) : null}

            {order.allowedActions?.includes('CANCEL') ? (
              <button type="button" style={styles.cancel} disabled={busy} onClick={() => void doCancel()}>
                Cancel booking
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  pageRail: { maxWidth: 520, margin: '0 auto', display: 'grid', gap: '0.65rem' },
  back: { textDecoration: 'none', color: '#0f766e', fontWeight: 700, fontSize: '0.82rem' },
  stack: { display: 'grid', gap: '0.65rem' },
  card: {
    borderRadius: 16,
    padding: '0.85rem',
    background: '#fff',
    border: '1px solid var(--border)',
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.05)',
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' },
  pill: {
    fontSize: '0.65rem',
    fontWeight: 800,
    padding: '0.2rem 0.45rem',
    borderRadius: 999,
    background: '#ecfdf5',
    color: '#065f46',
  },
  line: { margin: '0.35rem 0 0', fontSize: '0.82rem' },
  row: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.78rem', margin: '0.35rem 0 0' },
  muted: { color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.25rem 0 0' },
  error: { color: '#b91c1c', fontWeight: 700 },
  sectionTitle: { margin: '0 0 0.45rem', fontSize: '0.82rem' },
  lines: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 0 },
  item: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: '0.65rem',
    rowGap: '0.2rem',
    fontSize: '0.78rem',
    padding: '0.5rem 0.55rem',
    borderRadius: 10,
    border: '1px solid transparent',
  },
  itemName: { flex: '1 1 auto', minWidth: 0, fontWeight: 600, color: 'var(--text)' },
  itemPrice: {
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  result: {
    width: '100%',
    flexBasis: '100%',
    fontSize: '0.72rem',
    color: '#0f766e',
    fontWeight: 700,
  },
  reportActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    marginTop: '0.45rem',
  },
  viewReport: {
    flex: '1 1 7.5rem',
    padding: '0.55rem 0.85rem',
    borderRadius: 12,
    border: '1px solid #0f766e',
    background: '#fff',
    color: '#065f46',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
  download: {
    flex: '1 1 7.5rem',
    padding: '0.55rem 0.85rem',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #064e3b, #0f766e)',
    color: '#ecfdf5',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
  attachList: { listStyle: 'none', margin: '0.35rem 0 0', padding: 0, display: 'grid', gap: '0.25rem' },
  attachItem: { margin: 0 },
  cancel: {
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#b91c1c',
    borderRadius: 12,
    padding: '0.65rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
