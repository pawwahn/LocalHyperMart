import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Button, Card, Toast } from '@/shared/ui';
import { APP_NAME } from '@hlm-brand';
import {
  cancelHubPaymentRequest,
  createHubCodPaymentRequest,
  createHubFranchisePaymentRequest,
  fetchAdminHubPaymentRequests,
  fetchHubPaymentRequestLines,
  previewHubCodPaymentRequest,
  type HubCodPreview,
  type HubPaymentRequest,
} from '../api/hubPaymentRequestApi';
import { ListPager } from './ListPager';
import {
  buildHubCodStatementCsv,
  downloadHubCodStatementCsv,
  sumCodLineAmounts,
  type CodStatementLine,
} from '../lib/hubCodStatementExport';
import {
  hubCodPaymentPeriodKind,
  rangeForReportPreset,
  REPORT_DATE_PRESET_OPTIONS,
  type ReportDatePreset,
} from '@/shared/dates/istReportPresets';
import { formatIsoDateRange, isoDateRangeSlug } from '@/shared/dates/formatDateRange';
import {
  fetchDeliverySettlementCandidates,
  type DeliveryFranchiseDue,
} from '../api/settlementsApi';

type Props = {
  token: string;
  townId: string;
  hubId: string;
  refreshTick?: number;
  onChanged?: () => void;
  /** When set, only one issue block is shown (for sub-tabs under Hub pays KoyaKart). */
  section?: 'cod' | 'franchise' | 'both';
};

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

function codPeriodParams(preset: ReportDatePreset, start: string, end: string) {
  const periodKind = hubCodPaymentPeriodKind(preset);
  return {
    periodKind,
    periodStart: start,
    periodEnd: periodKind === 'DAILY' ? start : end,
  };
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const month = i + 1;
  const name = new Date(2020, i, 15).toLocaleDateString('en-IN', { month: 'long' });
  return { month, name };
});

function billingMonthEndIso(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function formatBillingMonth(year: number, month: number): string {
  if (month < 1 || month > 12) return '—';
  const d = new Date(`${year}-${String(month).padStart(2, '0')}-01T12:00:00+05:30`);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export function HubPaymentRequestsAdminPanel({
  token,
  townId,
  hubId,
  refreshTick = 0,
  onChanged,
  section = 'both',
}: Props) {
  const [codRows, setCodRows] = useState<HubPaymentRequest[]>([]);
  const [frRows, setFrRows] = useState<HubPaymentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewPageSize, setPreviewPageSize] = useState(50);
  const [billPage, setBillPage] = useState(0);
  const [billPageSize, setBillPageSize] = useState(25);

  const initialCodRange = rangeForReportPreset('financialYear');
  const [codPreset, setCodPreset] = useState<ReportDatePreset>('financialYear');
  const [codStart, setCodStart] = useState(initialCodRange.from);
  const [codEnd, setCodEnd] = useState(initialCodRange.to);
  const [preview, setPreview] = useState<HubCodPreview | null>(null);
  const [previewLinesOpen, setPreviewLinesOpen] = useState(true);

  const t = todayIso();
  const [frYear, setFrYear] = useState(() => Number(t.slice(0, 4)));
  const [frMonth, setFrMonth] = useState(() => Number(t.slice(5, 7)));
  const [franchiseDue, setFranchiseDue] = useState<DeliveryFranchiseDue | null>(null);
  const [franchiseLoading, setFranchiseLoading] = useState(false);
  const [issuedToast, setIssuedToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !townId || !hubId) return;
    setLoading(true);
    setError(null);
    try {
      if (section === 'franchise') {
        setFrRows(await fetchAdminHubPaymentRequests(token, townId, hubId, 'FRANCHISE'));
      } else if (section === 'cod') {
        setCodRows(await fetchAdminHubPaymentRequests(token, townId, hubId, 'COD'));
      } else {
        const [cod, fr] = await Promise.all([
          fetchAdminHubPaymentRequests(token, townId, hubId, 'COD'),
          fetchAdminHubPaymentRequests(token, townId, hubId, 'FRANCHISE'),
        ]);
        setCodRows(cod);
        setFrRows(fr);
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load payment requests');
    } finally {
      setLoading(false);
    }
  }, [token, townId, hubId, section]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  const loadFranchiseEnrollment = useCallback(async () => {
    if (!token || !townId || !hubId || frMonth < 1 || frMonth > 12) {
      setFranchiseDue(null);
      return;
    }
    const from = `${frYear}-${String(frMonth).padStart(2, '0')}-01`;
    const to = billingMonthEndIso(frYear, frMonth);
    setFranchiseLoading(true);
    try {
      const data = await fetchDeliverySettlementCandidates(token, {
        townId,
        payeeType: 'HUB',
        payeeId: hubId,
        from,
        to,
      });
      setFranchiseDue(data.franchise ?? null);
    } catch {
      setFranchiseDue(null);
    } finally {
      setFranchiseLoading(false);
    }
  }, [token, townId, hubId, frYear, frMonth]);

  useEffect(() => {
    if (section === 'franchise' || section === 'both') {
      void loadFranchiseEnrollment();
    }
  }, [section, loadFranchiseEnrollment, refreshTick]);

  function applyCodPreset(next: ReportDatePreset) {
    setCodPreset(next);
    setPreview(null);
    if (next === 'custom') return;
    const range = rangeForReportPreset(next);
    setCodStart(range.from);
    setCodEnd(range.to);
  }

  async function runPreview(page = 0, size = previewPageSize) {
    setBusy(true);
    setError(null);
    try {
      const next = await previewHubCodPaymentRequest(
        token,
        {
          townId,
          hubId,
          ...codPeriodParams(codPreset, codStart, codEnd),
        },
        page,
        size,
      );
      setPreview(next);
      setPreviewPage(page);
      setPreviewLinesOpen(true);
    } catch (err) {
      setPreview(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  async function downloadPreviewCsv() {
    setBusy(true);
    try {
      const full = await previewHubCodPaymentRequest(
        token,
        { townId, hubId, ...codPeriodParams(codPreset, codStart, codEnd) },
        0,
        10_000,
      );
      const csv = buildHubCodStatementCsv({
        hubId,
        periodStart: full.periodStart,
        periodEnd: full.periodEnd,
        totalAmount: full.totalAmount,
        hubBalanceOwed: full.hubBalanceOwedToCompany,
        lines: full.codLines ?? [],
      });
      downloadHubCodStatementCsv(`cod-${isoDateRangeSlug(full.periodStart, full.periodEnd)}.csv`, csv);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'CSV export failed');
    } finally {
      setBusy(false);
    }
  }

  async function issueCod() {
    setBusy(true);
    setError(null);
    try {
      const created = await createHubCodPaymentRequest(token, {
        townId,
        hubId,
        ...codPeriodParams(codPreset, codStart, codEnd),
      });
      setPreview(null);
      setIssuedToast(`Issued bill ${created.documentRef}`);
      onChanged?.();
      void load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not issue COD bill');
    } finally {
      setBusy(false);
    }
  }

  async function issueFranchise() {
    setBusy(true);
    setError(null);
    try {
      const created = await createHubFranchisePaymentRequest(token, {
        townId,
        hubId,
        billingYear: frYear,
        billingMonth: frMonth,
      });
      setIssuedToast(`Issued bill ${created.documentRef}`);
      onChanged?.();
      void load();
      void loadFranchiseEnrollment();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not issue franchise bill');
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setBusy(true);
    try {
      await cancelHubPaymentRequest(token, id);
      onChanged?.();
      void load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  }

  const previewReconcile = useMemo(() => {
    if (!preview) return null;
    const lines = preview.codLines ?? [];
    const lineSum = sumCodLineAmounts(lines);
    const total = Number(preview.totalAmount);
    const balance = Number(preview.hubBalanceOwedToCompany);
    const allLoaded = lines.length === preview.orderCount;
    const linesMatchTotal = allLoaded ? Math.abs(lineSum - total) < 0.005 : true;
    const countMatch = preview.orderCount >= 0;
    const withinBalance = total <= balance + 0.005;
    return { lineSum, total, balance, linesMatchTotal, countMatch, withinBalance, lines, allLoaded };
  }, [preview]);

  const canIssueCod =
    preview &&
    preview.orderCount > 0 &&
    previewReconcile?.linesMatchTotal &&
    previewReconcile?.countMatch &&
    previewReconcile?.withinBalance;

  const franchiseEnrolled = !!franchiseDue?.enabled;
  const canIssueFranchise =
    franchiseEnrolled &&
    !franchiseDue?.alreadyCollected &&
    Number(franchiseDue?.amount ?? 0) > 0 &&
    !busy &&
    !franchiseLoading;

  if (!townId || !hubId) return null;

  const showCod = section === 'cod' || section === 'both';
  const showFranchise = section === 'franchise' || section === 'both';

  return (
    <div style={section === 'both' ? styles.root : styles.rootSingle}>
      {error ? <p style={styles.error}>{error}</p> : null}

      {showCod ? (
      <Card padding="sm" style={styles.card}>
        {section === 'both' ? <h3 style={styles.h3}>Issue COD statement</h3> : null}
        <p style={styles.muted}>
          IST delivery month — hub-route COD orders delivered in this range that are already on a hub close-day (same
          presets as settlements reports).
        </p>
        <div style={styles.presets}>
          {REPORT_DATE_PRESET_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              style={codPreset === id ? styles.presetActive : styles.preset}
              onClick={() => applyCodPreset(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={styles.row2}>
          <label style={styles.label}>
            From (IST)
            <input
              type="date"
              value={codStart}
              onChange={(e) => {
                setCodStart(e.target.value);
                setCodPreset('custom');
                setPreview(null);
              }}
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            To (IST)
            <input
              type="date"
              value={codEnd}
              min={codStart}
              disabled={hubCodPaymentPeriodKind(codPreset) === 'DAILY'}
              onChange={(e) => {
                setCodEnd(e.target.value);
                setCodPreset('custom');
                setPreview(null);
              }}
              style={styles.input}
            />
          </label>
        </div>
        <div style={styles.actions}>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void runPreview()}>
            Preview
          </Button>
          <Button size="sm" disabled={busy || !canIssueCod} onClick={() => void issueCod()}>
            Issue to hub · {preview ? money(preview.totalAmount) : '—'}
          </Button>
        </div>
        {preview && previewReconcile ? (
          <>
            <p style={styles.preview}>
              {formatIsoDateRange(preview.periodStart, preview.periodEnd)} · {preview.orderCount} orders ·{' '}
              {money(preview.totalAmount)} · hub balance {money(preview.hubBalanceOwedToCompany)}
              {preview.warning ? ` · ${preview.warning}` : ''}
            </p>
            {!previewReconcile.allLoaded ? null : !previewReconcile.linesMatchTotal || !previewReconcile.countMatch ? (
              <p style={styles.error}>
                Line amounts ({money(previewReconcile.lineSum)}) must match statement total (
                {money(previewReconcile.total)}) — re-run Preview before issuing.
              </p>
            ) : null}
            {!previewReconcile.withinBalance ? (
              <p style={styles.error}>
                Statement total exceeds hub balance owed by{' '}
                {money(previewReconcile.total - previewReconcile.balance)} — narrow the date range.
              </p>
            ) : previewReconcile.total === previewReconcile.balance ? (
              <p style={styles.ok}>Totals match hub ledger balance to the paisa — safe to issue.</p>
            ) : (
              <p style={styles.preview}>
                Partial period: {money(previewReconcile.balance - previewReconcile.total)} will remain on hub balance
                after this bill is paid in full.
              </p>
            )}
            <CodStatementLinesBlock
              hubId={hubId}
              periodStart={preview.periodStart}
              periodEnd={preview.periodEnd}
              totalAmount={preview.totalAmount}
              hubBalanceOwed={preview.hubBalanceOwedToCompany}
              lines={previewReconcile.lines}
              orderCount={preview.orderCount}
              page={previewPage}
              pageSize={previewPageSize}
              onPage={(p) => void runPreview(p, previewPageSize)}
              onPageSize={(size) => {
                setPreviewPageSize(size);
                void runPreview(0, size);
              }}
              open={previewLinesOpen}
              onToggle={() => setPreviewLinesOpen((v) => !v)}
              onExportCsv={() => void downloadPreviewCsv()}
            />
          </>
        ) : null}
        <CodRequestList
          token={token}
          rows={codRows}
          hubId={hubId}
          onCancel={(id) => void cancel(id)}
          busy={busy}
          loading={loading}
          page={billPage}
          pageSize={billPageSize}
          onPage={setBillPage}
          onPageSize={(size) => {
            setBillPageSize(size);
            setBillPage(0);
          }}
        />
      </Card>
      ) : null}

      {showFranchise ? (
      <Card padding="sm" style={styles.card}>
        {section === 'both' ? <h3 style={styles.h3}>Issue franchise bill</h3> : null}
        <p style={styles.muted}>Calendar month — hubs can pay current or overdue months.</p>
        <p style={styles.monthHeading}>{formatBillingMonth(frYear, frMonth)}</p>
        <p style={styles.muted}>
          {formatIsoDateRange(
            `${frYear}-${String(frMonth).padStart(2, '0')}-01`,
            billingMonthEndIso(frYear, frMonth),
          )}
        </p>
        <div style={styles.row2}>
          <label style={styles.label}>
            Year
            <input
              type="number"
              min={2020}
              max={2100}
              value={frYear}
              onChange={(e) => setFrYear(Number(e.target.value))}
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            Month
            <select
              value={frMonth}
              onChange={(e) => setFrMonth(Number(e.target.value))}
              style={styles.input}
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.month} — {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {franchiseLoading ? (
          <p style={styles.muted}>Checking franchise enrollment…</p>
        ) : !franchiseEnrolled ? (
          <p style={styles.warn}>
            {franchiseDue?.label?.trim()
              ? franchiseDue.label
              : 'This hub does not have a franchise fee enrolled with KoyaKart — billing is disabled.'}
          </p>
        ) : franchiseDue?.alreadyCollected ? (
          <p style={styles.ok}>Franchise for {formatBillingMonth(frYear, frMonth)} is already collected.</p>
        ) : (
          <p style={styles.preview}>
            Franchise due {money(franchiseDue?.amount ?? 0)}
            {franchiseDue?.label ? ` · ${franchiseDue.label}` : ''}
          </p>
        )}
        <Button size="sm" disabled={!canIssueFranchise} onClick={() => void issueFranchise()}>
          Issue franchise bill
          {franchiseEnrolled && !franchiseDue?.alreadyCollected && Number(franchiseDue?.amount ?? 0) > 0
            ? ` · ${money(franchiseDue!.amount)}`
            : ''}
        </Button>
        <RequestList rows={frRows} onCancel={(id) => void cancel(id)} busy={busy} />
      </Card>
      ) : null}

      <Toast
        open={Boolean(issuedToast)}
        message={issuedToast ?? ''}
        brandName={APP_NAME}
        tone="success"
        placement="center"
        durationMs={6000}
        onClose={() => setIssuedToast(null)}
      />
    </div>
  );
}

function CodStatementLinesBlock({
  hubId,
  periodStart,
  periodEnd,
  totalAmount,
  hubBalanceOwed,
  lines,
  orderCount,
  page,
  pageSize,
  onPage,
  onPageSize,
  open,
  onToggle,
  documentRef,
  onExportCsv,
}: {
  hubId: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  hubBalanceOwed?: number;
  lines: CodStatementLine[];
  orderCount?: number;
  page?: number;
  pageSize?: number;
  onPage?: (page: number) => void;
  onPageSize?: (size: number) => void;
  open: boolean;
  onToggle: () => void;
  documentRef?: string;
  onExportCsv?: () => void;
}) {
  const totalOrders = orderCount ?? lines.length;
  if (totalOrders === 0 && lines.length === 0) {
    return <p style={styles.muted}>No order lines in preview — adjust dates and Preview again.</p>;
  }

  const pageCount = Math.max(1, Math.ceil(totalOrders / (pageSize || 50)));

  function onDownload() {
    if (onExportCsv) {
      onExportCsv();
      return;
    }
    const csv = buildHubCodStatementCsv({
      hubId,
      periodStart,
      periodEnd,
      documentRef,
      totalAmount,
      hubBalanceOwed,
      lines,
    });
    const slug = documentRef ?? `cod-${isoDateRangeSlug(periodStart, periodEnd)}`;
    downloadHubCodStatementCsv(`${slug}.csv`, csv);
  }

  return (
    <div style={styles.linesShell}>
      <div style={styles.linesToolbar}>
        <button type="button" style={styles.toggleBtn} onClick={onToggle} aria-expanded={open}>
          {open ? '▾' : '▸'} Orders ({totalOrders.toLocaleString('en-IN')})
        </button>
        <div style={styles.billActions}>
          {onPage && page != null && pageSize != null ? (
            <ListPager
              page={page}
              pageCount={pageCount}
              total={totalOrders}
              pageSize={pageSize}
              pageSizes={[25, 50, 100, 200]}
              onPage={onPage}
              onPageSize={onPageSize ?? (() => undefined)}
            />
          ) : null}
          <Button type="button" size="sm" variant="secondary" onClick={onDownload}>
            Download CSV
          </Button>
        </div>
      </div>
      {open ? (
        <CodStatementTable
          lines={lines}
          totalAmount={totalAmount}
          paged={totalOrders > lines.length}
        />
      ) : null}
    </div>
  );
}

function CodStatementTable({
  lines,
  totalAmount,
  paged,
}: {
  lines: CodStatementLine[];
  totalAmount: number;
  paged?: boolean;
}) {
  const lineSum = sumCodLineAmounts(lines);
  const totalsOk = !paged && Math.abs(lineSum - Number(totalAmount)) < 0.005;
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Order</th>
            <th style={styles.th}>Close date</th>
            <th style={styles.thRight}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.orderId}>
              <td style={styles.td}>{l.orderNumber?.trim() || l.orderId}</td>
              <td style={styles.tdMuted}>{l.closeDate ?? '—'}</td>
              <td style={styles.tdRight}>{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={styles.tfootLabel} colSpan={2}>
              {paged ? 'This page' : `Line total${totalsOk ? '' : ' (≠ statement)'}`}
            </td>
            <td style={{ ...styles.tfootAmt, ...(totalsOk || paged ? null : { color: 'var(--danger)' }) }}>
              {money(lineSum)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CodRequestList({
  token,
  rows,
  hubId,
  onCancel,
  busy,
  loading,
  page,
  pageSize,
  onPage,
  onPageSize,
}: {
  token: string;
  rows: HubPaymentRequest[];
  hubId: string;
  onCancel: (id: string) => void;
  busy: boolean;
  loading?: boolean;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [linePage, setLinePage] = useState(0);
  const [linePageSize, setLinePageSize] = useState(50);
  const [lines, setLines] = useState<CodStatementLine[]>([]);
  const [lineTotal, setLineTotal] = useState(0);
  const [linesLoading, setLinesLoading] = useState(false);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  async function loadLines(requestId: string, nextPage = 0, nextSize = linePageSize) {
    setLinesLoading(true);
    try {
      const data = await fetchHubPaymentRequestLines(token, requestId, nextPage, nextSize);
      setLines(data.items ?? []);
      setLineTotal(data.totalElements ?? 0);
      setLinePage(data.page ?? nextPage);
      setLinePageSize(data.size ?? nextSize);
    } catch {
      setLines([]);
      setLineTotal(0);
    } finally {
      setLinesLoading(false);
    }
  }

  async function exportBill(r: HubPaymentRequest) {
    const data = await fetchHubPaymentRequestLines(token, r.requestId, 0, 10_000);
    const csv = buildHubCodStatementCsv({
      hubId,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      documentRef: r.documentRef,
      totalAmount: r.totalAmount,
      lines: data.items ?? [],
    });
    downloadHubCodStatementCsv(`${r.documentRef}.csv`, csv);
  }

  if (loading && rows.length === 0) return <p style={styles.muted}>Loading bills…</p>;
  if (rows.length === 0) return <p style={styles.muted}>No bills yet.</p>;

  return (
    <div>
      <div style={styles.linesToolbar}>
        <p style={{ ...styles.muted, margin: 0 }}>Issued bills</p>
        <ListPager
          page={safePage}
          pageCount={pageCount}
          total={rows.length}
          pageSize={pageSize}
          pageSizes={[25, 50, 100]}
          onPage={onPage}
          onPageSize={onPageSize}
        />
      </div>
      <ul style={styles.billList}>
        {paged.map((r) => {
          const open = openId === r.requestId;
          const orderCount = r.orderCount ?? r.codLines?.length ?? 0;
          return (
            <li key={r.requestId} style={styles.billItem}>
              <div style={styles.billHead}>
                <button
                  type="button"
                  style={styles.toggleBtn}
                  onClick={() => {
                    if (open) {
                      setOpenId(null);
                      return;
                    }
                    setOpenId(r.requestId);
                    setLinePage(0);
                    void loadLines(r.requestId, 0, linePageSize);
                  }}
                  aria-expanded={open}
                  disabled={orderCount === 0}
                >
                  {orderCount > 0 ? (open ? '▾' : '▸') : '·'}{' '}
                  <strong>{r.documentRef}</strong> · {money(r.totalAmount)} · {r.statusLabel}
                  {orderCount > 0 ? ` · ${orderCount.toLocaleString('en-IN')} orders` : ''}
                </button>
                <div style={styles.billActions}>
                  {orderCount > 0 ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => void exportBill(r)}>
                      CSV
                    </Button>
                  ) : null}
                  {r.status === 'ISSUED' ? (
                    <button type="button" style={styles.linkBtn} disabled={busy} onClick={() => onCancel(r.requestId)}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
              {open ? (
                linesLoading ? (
                  <p style={styles.muted}>Loading orders…</p>
                ) : (
                  <>
                    <ListPager
                      page={linePage}
                      pageCount={Math.max(1, Math.ceil(lineTotal / linePageSize))}
                      total={lineTotal}
                      pageSize={linePageSize}
                      pageSizes={[25, 50, 100, 200]}
                      onPage={(p) => void loadLines(r.requestId, p, linePageSize)}
                      onPageSize={(size) => {
                        setLinePageSize(size);
                        void loadLines(r.requestId, 0, size);
                      }}
                    />
                    <CodStatementTable lines={lines} totalAmount={r.totalAmount} paged={lineTotal > lines.length} />
                  </>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RequestList({
  rows,
  onCancel,
  busy,
}: {
  rows: HubPaymentRequest[];
  onCancel: (id: string) => void;
  busy: boolean;
}) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  if (rows.length === 0) return <p style={styles.muted}>No bills yet.</p>;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);
  return (
    <div>
      <ListPager
        page={safePage}
        pageCount={pageCount}
        total={rows.length}
        pageSize={pageSize}
        pageSizes={[25, 50, 100]}
        onPage={setPage}
        onPageSize={(size) => {
          setPageSize(size);
          setPage(0);
        }}
      />
      <ul style={styles.list}>
        {paged.map((r) => (
          <li key={r.requestId} style={styles.listItem}>
            <span>
              <strong>{r.documentRef}</strong> · {money(r.totalAmount)} · {r.statusLabel}
            </span>
            {r.status === 'ISSUED' ? (
              <button type="button" style={styles.linkBtn} disabled={busy} onClick={() => onCancel(r.requestId)}>
                Cancel
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: { display: 'grid', gap: '0.5rem' },
  rootSingle: { display: 'grid', gap: '0.5rem', minWidth: 0 },
  card: { display: 'grid', gap: '0.4rem' },
  h3: { margin: 0, fontSize: '0.92rem', fontWeight: 800 },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.82rem' },
  presets: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap' },
  preset: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.22rem 0.55rem',
    cursor: 'pointer',
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  presetActive: {
    border: '1.5px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 'var(--radius-full)',
    padding: '0.22rem 0.55rem',
    cursor: 'pointer',
    fontSize: '0.72rem',
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' },
  label: { display: 'grid', gap: '0.15rem', fontSize: '0.72rem', fontWeight: 600 },
  input: {
    padding: '0.3rem 0.4rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' },
  preview: { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' },
  ok: { margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#15803d' },
  warn: { margin: 0, fontSize: '0.78rem', fontWeight: 650, color: 'var(--danger)' },
  monthHeading: { margin: 0, fontSize: '1rem', fontWeight: 900 },
  linesShell: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
    background: 'var(--bg-elevated)',
  },
  linesToolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.35rem',
    padding: '0.35rem 0.45rem',
    borderBottom: '1px solid var(--border)',
  },
  toggleBtn: {
    border: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'left',
    padding: 0,
    color: 'var(--text)',
  },
  tableWrap: { maxHeight: 'min(22rem, 50vh)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' },
  th: { textAlign: 'left', fontWeight: 700, padding: '0.35rem 0.45rem', borderBottom: '1px solid var(--border)' },
  thRight: { textAlign: 'right', fontWeight: 700, padding: '0.35rem 0.45rem', borderBottom: '1px solid var(--border)' },
  td: { padding: '0.32rem 0.45rem', verticalAlign: 'top', fontWeight: 650 },
  tdMuted: { padding: '0.32rem 0.45rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' },
  tdRight: {
    padding: '0.32rem 0.45rem',
    textAlign: 'right',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
  },
  tfootLabel: { padding: '0.4rem 0.45rem', fontWeight: 800, borderTop: '1px solid var(--border)' },
  tfootAmt: {
    padding: '0.4rem 0.45rem',
    textAlign: 'right',
    fontWeight: 900,
    borderTop: '1px solid var(--border)',
    fontVariantNumeric: 'tabular-nums',
  },
  billList: { margin: '0.35rem 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' },
  billItem: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.35rem 0.45rem',
    display: 'grid',
    gap: '0.35rem',
  },
  billHead: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.35rem', alignItems: 'center' },
  billActions: { display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' },
  list: { margin: '0.25rem 0 0', paddingLeft: '1rem', fontSize: '0.75rem', display: 'grid', gap: '0.25rem' },
  listItem: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' },
  linkBtn: {
    border: 'none',
    background: 'none',
    color: 'var(--danger)',
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
  },
};
