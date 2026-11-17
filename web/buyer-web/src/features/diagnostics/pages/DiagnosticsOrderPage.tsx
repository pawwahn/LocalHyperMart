import { useEffect, useMemo, useState } from 'react';
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
import { BUYER_ORDER_LAYOUT_CSS } from '@/shared/layout/buyerOrderLayout';

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

  const prepaid = /^(UPI|ONLINE)$/i.test(String(order?.paymentMethod ?? ''));

  return (
    <PortalShell hideTitle showDeliveryBanner={false} showStickyCart={false} showTownPicker={false}>
      <style>{BUYER_ORDER_LAYOUT_CSS}</style>
      <div className="hlm-buyer-order">
        <Link to="/orders" className="hlm-buyer-order-back">
          <span className="hlm-buyer-order-back-chev" aria-hidden>
            ‹
          </span>
          My orders
        </Link>
        {loading ? <p className="hlm-buyer-order-muted">Loading…</p> : null}
        {error ? <p className="hlm-buyer-order-error">{error}</p> : null}
        {order ? (
          <div className="hlm-buyer-order-stack">
            <header className="hlm-buyer-order-hero hlm-buyer-order-span-full">
              <div className="hlm-buyer-order-hero-main">
                <div className="hlm-buyer-order-hero-top">
                  <span className="hlm-buyer-order-id">{order.orderNumber}</span>
                  <span className="hlm-buyer-order-pill">{order.statusLabel}</span>
                </div>
                <h1 className="hlm-buyer-order-title">Diagnostics order</h1>
                <p className="hlm-buyer-order-lead">
                  {order.shopName} · {prepaid ? 'Prepaid' : 'COD'}
                </p>
                <p className="hlm-buyer-order-muted">Patient: {order.patientName}</p>
                {order.referenceType === 'DOCTOR' && order.referringDoctorName ? (
                  <p className="hlm-buyer-order-muted">Referred by {order.referringDoctorName}</p>
                ) : null}
                {order.addressText ? <p className="hlm-buyer-order-muted">{order.addressText}</p> : null}
                {order.slotStart ? (
                  <p className="hlm-buyer-order-row">
                    <span>Collection slot</span>
                    <strong>
                      {when(order.slotStart)}
                      {order.slotEnd ? ` – ${when(order.slotEnd)}` : ''}
                    </strong>
                  </p>
                ) : null}
                {order.reportEta ? (
                  <p className="hlm-buyer-order-row">
                    <span>Report ETA</span>
                    <strong>{when(order.reportEta)}</strong>
                  </p>
                ) : null}
              </div>
              <div className="hlm-buyer-order-total-chip" aria-label="Order total">
                <span className="hlm-buyer-order-total-label">Total</span>
                <span className="hlm-buyer-order-total-amt">{money(total)}</span>
              </div>
            </header>

            <div className="hlm-buyer-order-col-aside">
              {timeline.length > 0 ? (
                <OrderStatusTimeline
                  steps={timeline}
                  orderStatus={order.status}
                  displayStatus={order.statusLabel}
                  defaultExpanded
                />
              ) : null}

              {order.status === 'AWAITING_PAYMENT' && prepaid ? (
                <article className="hlm-buyer-order-card">
                  <h2 className="hlm-buyer-order-section-title">Complete payment</h2>
                  <p className="hlm-buyer-order-muted">Your booking is held until payment succeeds.</p>
                  <PaymentGatewayChoices options={paymentGateways} value={paymentGateway} onChange={setPaymentGateway} />
                  <button
                    type="button"
                    className="hlm-buyer-order-download"
                    disabled={busy}
                    onClick={() => void doPayNow()}
                  >
                    {busy ? 'Opening…' : `Pay now · ${money(total)}`}
                  </button>
                </article>
              ) : null}
            </div>

            <div className="hlm-buyer-order-col-main">
              <CollapsibleCard
                title="Tests"
                summary={`${order.lines.length} test${order.lines.length === 1 ? '' : 's'} · ${money(total)}`}
                defaultExpanded
              >
                <ul className="hlm-buyer-order-lines hlm-row-stripe-list">
                  {order.lines.map((line) => (
                    <li key={line.id} className="hlm-buyer-order-line-item hlm-buyer-order-line-item--flex hlm-row-stripe">
                      <span className="hlm-buyer-order-line-name">{line.testName}</span>
                      <span className="hlm-buyer-order-line-price">{money(line.unitPrice)}</span>
                      {line.resultValue ? (
                        <span className="hlm-buyer-order-line-result">
                          {line.resultValue}
                          {line.resultUnit ? ` ${line.resultUnit}` : ''}
                          {line.referenceRange ? ` (ref ${line.referenceRange})` : ''}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CollapsibleCard>

              {hasUploadedReports ? (
                <DiagnosticsBuyerReportFiles
                  order={order}
                  token={token}
                  defaultExpanded
                  onError={(message) => setError(message)}
                />
              ) : null}

              {reportReady ? (
                <article className="hlm-buyer-order-card">
                  <h2 className="hlm-buyer-order-section-title">Report</h2>
                  <p className="hlm-buyer-order-muted">
                    {labFinalReport
                      ? 'Your lab shared the final report — open or save the file they uploaded.'
                      : 'View the summary report built from results entered by your lab.'}
                  </p>
                  <div className="hlm-buyer-order-report-actions">
                    <button
                      type="button"
                      className="hlm-buyer-order-view-report"
                      disabled={busy}
                      onClick={() => void doViewReport()}
                    >
                      {busy ? '…' : 'View report'}
                    </button>
                    <button
                      type="button"
                      className="hlm-buyer-order-download"
                      disabled={busy}
                      onClick={() => void doDownloadReport()}
                    >
                      {labFinalReport && !isPdfReportAttachment(labFinalReport) ? 'Download report' : 'Download report PDF'}
                    </button>
                  </div>
                </article>
              ) : null}
            </div>

            {order.allowedActions?.includes('CANCEL') ? (
              <button type="button" className="hlm-buyer-order-cancel hlm-buyer-order-span-full" disabled={busy} onClick={() => void doCancel()}>
                Cancel booking
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </PortalShell>
  );
}
