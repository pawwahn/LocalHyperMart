import { PickerDateField } from '@hlm-dates';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, SearchSelect } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { formatWhen, money, shortOrderNo } from '@/features/orders/api/ordersApi';
import {
  exportAdminCancellations,
  initiatorLabel,
  listAdminCancellations,
  listBuyerCancelRisks,
  listVendorCancelRisks,
  verticalLabel,
  type AdminBuyerCancelRisk,
  type AdminCancellationRow,
  type AdminVendorCancelRisk,
  type CancellationInitiator,
  type CancellationVertical,
} from '../api/cancellationsApi';
import { cancellationsToCsv, downloadCsv } from '../lib/cancellationCsv';
import { VendorPenaltyDialog } from '../components/VendorPenaltyDialog';

const PAGE_SIZE = 20;

const VERTICALS: Array<{ value: '' | CancellationVertical; label: string }> = [
  { value: '', label: 'All services' },
  { value: 'GROCERY', label: 'Grocery' },
  { value: 'BEAUTY', label: 'Glam' },
  { value: 'LAUNDRY', label: 'Laundry' },
  { value: 'DIAGNOSTICS', label: 'Diagnostics' },
];

const INITIATORS: Array<{ value: '' | CancellationInitiator; label: string }> = [
  { value: '', label: 'All sides' },
  { value: 'BUYER', label: 'Buyer-led' },
  { value: 'VENDOR', label: 'Vendor-led' },
  { value: 'PLATFORM', label: 'Platform' },
  { value: 'UNKNOWN', label: 'Unattributed' },
];

const SIDE_CHIPS: Array<{ value: '' | CancellationInitiator; label: string }> = [
  { value: '', label: 'All' },
  { value: 'BUYER', label: 'Buyer side' },
  { value: 'VENDOR', label: 'Vendor side' },
];

function townLabel(t: TownVm): string {
  const place = t.displayName || t.townCode;
  const bits = [place, t.townCode && t.townCode !== place ? t.townCode : null].filter(Boolean);
  return bits.join(' · ');
}

function isoToday(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

type SectionState = {
  rows: AdminCancellationRow[];
  totalPages: number;
  totalElements: number;
  page: number;
};

function SoftCard({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div className={className} style={{ ...styles.softCard, ...style }}>
      {children}
    </div>
  );
}

function TableShell({ children, minWidth, className }: { children: ReactNode; minWidth?: string; className?: string }) {
  return (
    <SoftCard style={{ padding: 0, overflow: 'hidden' }} className={className}>
      <div className="sa-canc-table-scroll">
        <table className="sa-canc-table" style={{ minWidth: minWidth ?? '56rem' }}>
          {children}
        </table>
      </div>
    </SoftCard>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="sa-canc-empty" role="status">
      <span className="sa-canc-empty-icon" aria-hidden>
        ◌
      </span>
      <p>{message}</p>
    </div>
  );
}

function SectionBlock({
  title,
  hint,
  count,
  countLabel,
  tone,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  countLabel: string;
  tone?: 'default' | 'partial';
  children: ReactNode;
}) {
  const active = count > 0;
  return (
    <section
      className={`sa-canc-section${tone === 'partial' ? ' sa-canc-section--partial' : ''}${active ? ' sa-canc-section--active' : ''}`}
    >
      <header className="sa-canc-section-head">
        <div style={styles.sectionTitleBlock}>
          <h2 className="sa-canc-section-title">{title}</h2>
          <p className="sa-canc-section-hint">{hint}</p>
        </div>
        <span className={`sa-canc-count${active ? ' on' : ''}`}>
          <strong>{count}</strong> {countLabel}
        </span>
      </header>
      <div className="sa-canc-section-body">{children}</div>
    </section>
  );
}

function ListPager({
  page,
  totalPages,
  loading,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div style={styles.pager}>
      <button
        type="button"
        style={page <= 0 || loading ? styles.pagerBtnDisabled : styles.pagerBtn}
        disabled={page <= 0 || loading}
        onClick={onPrev}
        aria-label="Previous page"
      >
        ‹
      </button>
      <span style={styles.pagerMeta}>
        Page {page + 1} of {totalPages}
      </span>
      <button
        type="button"
        style={page + 1 >= totalPages || loading ? styles.pagerBtnDisabled : styles.pagerBtn}
        disabled={page + 1 >= totalPages || loading}
        onClick={onNext}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}

function CancellationTable({
  rows,
  loading,
  empty,
  showPenalty,
  onAddPenalty,
}: {
  rows: AdminCancellationRow[];
  loading: boolean;
  empty: string;
  showPenalty?: boolean;
  onAddPenalty?: (row: AdminCancellationRow) => void;
}) {
  if (loading && rows.length === 0) {
    return <EmptyPanel message="Loading cancellations…" />;
  }
  if (rows.length === 0) {
    return <EmptyPanel message={empty} />;
  }
  const penaltyEligible = (r: AdminCancellationRow) =>
    showPenalty && r.vendorId && (r.initiatedBy === 'VENDOR' || r.kind === 'PARTIAL');
  return (
    <TableShell minWidth="62rem" className="sa-canc-events-card">
      <thead>
        <tr>
          <th>When</th>
          <th>Service</th>
          <th>Order</th>
          <th>Party</th>
          <th>Who</th>
          <th>Summary</th>
          <th className="num">Lost ₹</th>
          <th>Next steps</th>
          <th className="sa-canc-sticky-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.vertical}-${r.orderId}-${r.kind}`} className="sa-canc-row">
            <td className="muted">{formatWhen(r.occurredAt)}</td>
            <td>
              <span style={styles.vertPill}>{verticalLabel(r.vertical)}</span>
            </td>
            <td>
              {r.vertical === 'GROCERY' && r.adminPath ? (
                <Link to={r.adminPath} className="sa-canc-order-link">
                  {shortOrderNo(r.orderNumber)}
                </Link>
              ) : (
                <span className="sa-canc-order-no">{shortOrderNo(r.orderNumber)}</span>
              )}
              <div className="sa-canc-sub">
                {r.orderStatus}
                {r.paymentMethod ? ` · ${r.paymentMethod}` : ''}
              </div>
            </td>
            <td>
              <div className="sa-canc-party">{r.counterpartyName ?? '—'}</div>
              <div className="sa-canc-sub">{r.buyerPhone ?? r.buyerId.slice(0, 8)}</div>
            </td>
            <td>
              <span style={initiatorPillStyle(r.initiatedBy)}>{initiatorLabel(r.initiatedBy)}</span>
            </td>
            <td>
              <span className="sa-canc-summary">{r.summary ?? '—'}</span>
              {r.reason ? <div className="sa-canc-reason">{r.reason}</div> : null}
            </td>
            <td className="num sa-canc-lost">
              <strong>{money(r.cancelledAmount)}</strong>
              {r.platformFee > 0 ? <div className="sa-canc-sub">Fee {money(r.platformFee)}</div> : null}
              {r.amountCollected > 0 ? <div className="sa-canc-sub">Paid {money(r.amountCollected)}</div> : null}
            </td>
            <td>
              <HintList hints={r.actionHints} />
            </td>
            <td className="sa-canc-sticky-actions">
              <div className="sa-canc-act-row">
                {r.vertical === 'GROCERY' && r.adminPath ? (
                  <Link to={r.adminPath} className="sa-canc-act sa-canc-act--primary">
                    Order
                  </Link>
                ) : null}
                {r.buyerPhone ? (
                  <Link to="/customers" state={{ phone: r.buyerPhone }} className="sa-canc-act">
                    Buyer
                  </Link>
                ) : null}
                {penaltyEligible(r) ? (
                  r.vendorPenaltySent ? (
                    <span className="sa-canc-act sa-canc-act--done" title="Penalty already sent for this order">
                      ✓ Penalty sent
                    </span>
                  ) : (
                    <button type="button" className="sa-canc-act sa-canc-act--penalty" onClick={() => onAddPenalty?.(r)}>
                      Add penalty
                    </button>
                  )
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function HintList({ hints }: { hints: string[] }) {
  if (!hints.length) return <span className="sa-canc-sub">—</span>;
  return (
    <ul className="sa-canc-hints">
      {hints.map((h) => (
        <li key={h}>{h}</li>
      ))}
    </ul>
  );
}

export function CancellationsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTownApplied = useRef(false);

  const [towns, setTowns] = useState<TownVm[]>([]);
  const townId = searchParams.get('townId') ?? '';
  const vertical = (searchParams.get('vertical') as CancellationVertical | '') ?? '';
  const initiatedBy = (searchParams.get('initiatedBy') as CancellationInitiator | '') ?? '';
  const from = searchParams.get('from') ?? daysAgoIso(29);
  const to = searchParams.get('to') ?? isoToday();
  const fullPage = Math.max(0, Number(searchParams.get('fullPage') ?? '0') || 0);
  const partialPage = Math.max(0, Number(searchParams.get('partialPage') ?? '0') || 0);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportBusy, setExportBusy] = useState(false);
  const [full, setFull] = useState<SectionState>({ rows: [], totalPages: 0, totalElements: 0, page: 0 });
  const [partial, setPartial] = useState<SectionState>({ rows: [], totalPages: 0, totalElements: 0, page: 0 });
  const [buyerRisks, setBuyerRisks] = useState<AdminBuyerCancelRisk[]>([]);
  const [buyerRiskTotal, setBuyerRiskTotal] = useState(0);
  const [vendorRisks, setVendorRisks] = useState<AdminVendorCancelRisk[]>([]);
  const [vendorRiskTotal, setVendorRiskTotal] = useState(0);
  const [penaltyRow, setPenaltyRow] = useState<AdminCancellationRow | null>(null);

  const showBuyerRisk = initiatedBy !== 'VENDOR';
  const showVendorRisk = initiatedBy !== 'BUYER';

  const townOptions = useMemo(
    () =>
      towns.map((t) => ({
        value: t.id,
        label: townLabel(t),
        searchText: `${t.displayName} ${t.townCode} ${t.stateCode ?? ''}`,
      })),
    [towns],
  );

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listTowns(token);
        if (cancelled) return;
        setTowns(list);
        if (!defaultTownApplied.current && !searchParams.get('townId') && list.length > 0) {
          defaultTownApplied.current = true;
          patchParams({ townId: list[0].id });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load towns');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, patchParams, searchParams]);

  const reload = useCallback(async () => {
    if (!token || !townId) {
      setFull({ rows: [], totalPages: 0, totalElements: 0, page: 0 });
      setPartial({ rows: [], totalPages: 0, totalElements: 0, page: 0 });
      setBuyerRisks([]);
      setBuyerRiskTotal(0);
      setVendorRisks([]);
      setVendorRiskTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const base = {
        townId,
        from,
        to,
        vertical: vertical || undefined,
        initiatedBy: initiatedBy || undefined,
        size: PAGE_SIZE,
      };
      const [fullData, partialData, buyerRiskData, vendorRiskData] = await Promise.all([
        listAdminCancellations(token, { ...base, kind: 'FULL', page: fullPage }),
        listAdminCancellations(token, { ...base, kind: 'PARTIAL', page: partialPage }),
        showBuyerRisk ? listBuyerCancelRisks(token, { townId, from, to, page: 0, size: 15 }) : Promise.resolve(null),
        showVendorRisk ? listVendorCancelRisks(token, { townId, from, to, page: 0, size: 15 }) : Promise.resolve(null),
      ]);
      setFull({
        rows: fullData.items ?? [],
        totalPages: fullData.totalPages ?? 0,
        totalElements: fullData.totalElements ?? 0,
        page: fullPage,
      });
      setPartial({
        rows: partialData.items ?? [],
        totalPages: partialData.totalPages ?? 0,
        totalElements: partialData.totalElements ?? 0,
        page: partialPage,
      });
      setBuyerRisks(buyerRiskData?.items ?? []);
      setBuyerRiskTotal(buyerRiskData?.totalElements ?? 0);
      setVendorRisks(vendorRiskData?.items ?? []);
      setVendorRiskTotal(vendorRiskData?.totalElements ?? 0);
    } catch (err) {
      setFull({ rows: [], totalPages: 0, totalElements: 0, page: 0 });
      setPartial({ rows: [], totalPages: 0, totalElements: 0, page: 0 });
      setBuyerRisks([]);
      setBuyerRiskTotal(0);
      setVendorRisks([]);
      setVendorRiskTotal(0);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load cancellations');
    } finally {
      setLoading(false);
    }
  }, [token, townId, vertical, initiatedBy, from, to, fullPage, partialPage, showBuyerRisk, showVendorRisk]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const exportBoth = useCallback(async () => {
    if (!token || !townId) return;
    setExportBusy(true);
    setNotice(null);
    setError(null);
    try {
      const base = { townId, from, to, vertical: vertical || undefined, initiatedBy: initiatedBy || undefined };
      const [fullRows, partialRows] = await Promise.all([
        exportAdminCancellations(token, { ...base, kind: 'FULL' }),
        exportAdminCancellations(token, { ...base, kind: 'PARTIAL' }),
      ]);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`cancellations-full-${stamp}.csv`, cancellationsToCsv(fullRows));
      downloadCsv(`cancellations-partial-${stamp}.csv`, cancellationsToCsv(partialRows));
      setNotice(`Exported ${fullRows.length} full and ${partialRows.length} partial rows.`);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportBusy(false);
    }
  }, [token, townId, from, to, vertical, initiatedBy]);

  const fullTitle =
    initiatedBy === 'BUYER'
      ? 'Buyer-led — fully cancelled'
      : initiatedBy === 'VENDOR'
        ? 'Vendor-led — fully cancelled'
        : 'Fully cancelled';
  const partialTitle =
    initiatedBy === 'BUYER'
      ? 'Buyer-led — partial (grocery)'
      : initiatedBy === 'VENDOR'
        ? 'Vendor-led — partial (grocery)'
        : 'Partial cancellations';

  return (
    <PortalShell
      title="Cancellations"
      subtitle="Full and partial cancels across grocery and services — use hints for refunds, penalties, and vendor follow-up."
      onRefresh={() => void reload()}
    >
      <style>{PAGE_CSS}</style>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="info">{notice}</Banner> : null}

      <VendorPenaltyDialog
        open={penaltyRow != null}
        row={penaltyRow}
        token={token}
        onClose={() => setPenaltyRow(null)}
        onSuccess={(msg) => {
          setNotice(msg);
          void reload();
        }}
      />

      <div className="sa-canc-page">
        <Card elevated padding="sm" className="sa-canc-filters">
          <p className="sa-canc-filters-eyebrow">Filters</p>
          <div className="sa-canc-toolbar">
            <div className="sa-canc-field sa-canc-town">
              <SearchSelect
                label="Town"
                value={townId}
                options={townOptions}
                onChange={(id) => patchParams({ townId: id || null, fullPage: null, partialPage: null })}
                placeholder="Select town…"
                emptyMessage="No towns"
              />
            </div>
            <label className="sa-canc-field">
              Service
              <select
                value={vertical}
                onChange={(e) =>
                  patchParams({ vertical: e.target.value || null, fullPage: null, partialPage: null })
                }
              >
                {VERTICALS.map((v) => (
                  <option key={v.value || 'all'} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="sa-canc-field">
              Cancelled by
              <select
                value={initiatedBy}
                onChange={(e) =>
                  patchParams({ initiatedBy: e.target.value || null, fullPage: null, partialPage: null })
                }
              >
                {INITIATORS.map((v) => (
                  <option key={v.value || 'all'} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="sa-canc-field">
              From
              <PickerDateField
                value={from}
                onChange={(v: string) => patchParams({ from: v || null, fullPage: null, partialPage: null })}
              />
            </label>
            <label className="sa-canc-field">
              To
              <PickerDateField
                value={to}
                onChange={(v: string) => patchParams({ to: v || null, fullPage: null, partialPage: null })}
              />
            </label>
            <div className="sa-canc-actions">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!townId || exportBusy}
                onClick={() => void exportBoth()}
              >
                {exportBusy ? 'Exporting…' : 'Export CSV'}
              </Button>
            </div>
          </div>
          <div className="sa-canc-sides" role="group" aria-label="Buyer or vendor side">
            {SIDE_CHIPS.map((chip) => (
              <button
                key={chip.value || 'all'}
                type="button"
                className={initiatedBy === chip.value ? 'sa-canc-chip on' : 'sa-canc-chip'}
                onClick={() =>
                  patchParams({ initiatedBy: chip.value || null, fullPage: null, partialPage: null })
                }
              >
                {chip.label}
              </button>
            ))}
          </div>
        </Card>

        {showBuyerRisk ? (
        <SectionBlock
          title="Buyer cancel risk"
          hint="Repeat full / partial cancels in the period — use for abuse review or restricting buyer cancel policy."
          count={buyerRiskTotal}
          countLabel="buyers"
        >
          {buyerRisks.length === 0 ? (
            <EmptyPanel message={townId ? 'No repeat cancel patterns in this period.' : 'Select a town.'} />
          ) : (
            <TableShell minWidth="40rem">
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Buyer</th>
                  <th>Counts</th>
                  <th>Last event</th>
                  <th className="num">Lost ₹</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {buyerRisks.map((b) => (
                  <tr key={b.buyerId} className="sa-canc-row">
                    <td>
                      <span style={riskPillStyle(b.riskLevel)}>{b.riskLevel}</span>
                    </td>
                    <td>
                      <div className="sa-canc-party">{b.buyerPhone ?? b.buyerId.slice(0, 8)}</div>
                    </td>
                    <td>{b.summary ?? '—'}</td>
                    <td className="muted">{formatWhen(b.lastOccurredAt)}</td>
                    <td className="num sa-canc-lost">
                      <strong>{money(b.totalLostAmount)}</strong>
                    </td>
                    <td>
                      {b.buyerPhone ? (
                        <Link to="/customers" state={{ phone: b.buyerPhone }} className="sa-canc-act">
                          Open buyer
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </SectionBlock>
        ) : null}

        {showVendorRisk ? (
          <SectionBlock
            title="Vendor cancel risk"
            hint="Vendor-driven full cancels and grocery shop rejects — use for SLA review, penalties, and settlement follow-up."
            count={vendorRiskTotal}
            countLabel="vendors"
          >
            {vendorRisks.length === 0 ? (
              <EmptyPanel message={townId ? 'No repeat vendor cancel patterns in this period.' : 'Select a town.'} />
            ) : (
              <TableShell minWidth="42rem">
                <thead>
                  <tr>
                    <th>Risk</th>
                    <th>Vendor / shop</th>
                    <th>Counts</th>
                    <th>Last event</th>
                    <th className="num">Lost ₹</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {vendorRisks.map((v) => (
                    <tr key={v.vendorId} className="sa-canc-row">
                      <td>
                        <span style={riskPillStyle(v.riskLevel)}>{v.riskLevel}</span>
                      </td>
                      <td>
                        <div className="sa-canc-party">{v.vendorName ?? v.vendorId.slice(0, 8)}</div>
                      </td>
                      <td>{v.summary ?? '—'}</td>
                      <td className="muted">{formatWhen(v.lastOccurredAt)}</td>
                      <td className="num sa-canc-lost">
                        <strong>{money(v.totalLostAmount)}</strong>
                      </td>
                      <td>
                        <Link
                          to={`/settlements?townId=${encodeURIComponent(townId)}&vendorId=${encodeURIComponent(v.vendorId)}`}
                          className="sa-canc-act sa-canc-act--primary"
                        >
                          Settlements
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </SectionBlock>
        ) : null}

        <SectionBlock
          title={fullTitle}
          hint="Entire grocery order or whole service booking cancelled. Check prepaid amounts and vendor no-shows."
          count={full.totalElements}
          countLabel="in range"
        >
          <CancellationTable
            rows={full.rows}
            loading={loading}
            empty={townId ? 'No full cancellations in this period.' : 'Select a town.'}
            showPenalty
            onAddPenalty={setPenaltyRow}
          />
          <ListPager
            page={full.page}
            totalPages={full.totalPages}
            loading={loading}
            onPrev={() => patchParams({ fullPage: String(full.page - 1) })}
            onNext={() => patchParams({ fullPage: String(full.page + 1) })}
          />
        </SectionBlock>

        <SectionBlock
          title={partialTitle}
          hint="Grocery only: shop reject, buyer bag cancel, or line items removed while the master order continues. Service bookings appear under full cancel when the whole booking ends."
          count={partial.totalElements}
          countLabel="in range"
          tone="partial"
        >
          <CancellationTable
            rows={partial.rows}
            loading={loading}
            empty={townId ? 'No partial grocery cancellations in this period.' : 'Select a town.'}
            showPenalty
            onAddPenalty={setPenaltyRow}
          />
          <ListPager
            page={partial.page}
            totalPages={partial.totalPages}
            loading={loading}
            onPrev={() => patchParams({ partialPage: String(partial.page - 1) })}
            onNext={() => patchParams({ partialPage: String(partial.page + 1) })}
          />
        </SectionBlock>
      </div>
    </PortalShell>
  );
}

function initiatorPillStyle(who: CancellationInitiator): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: 999,
    fontSize: '0.68rem',
    fontWeight: 800,
  };
  if (who === 'BUYER') {
    return { ...base, color: '#1d4ed8', background: '#dbeafe' };
  }
  if (who === 'VENDOR') {
    return { ...base, color: '#9A5F10', background: '#FFF3DF' };
  }
  if (who === 'PLATFORM') {
    return { ...base, color: '#6b21a8', background: '#f3e8ff' };
  }
  return { ...base, color: 'var(--text-muted)', background: 'var(--bg-muted)' };
}

function riskPillStyle(level: string): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-block',
    padding: '0.15rem 0.55rem',
    borderRadius: 999,
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
  };
  if (level === 'HIGH') {
    return { ...base, color: '#E03546', background: '#FDE8EA' };
  }
  if (level === 'MEDIUM') {
    return { ...base, color: '#9A5F10', background: '#FFF3DF' };
  }
  return { ...base, color: '#009111', background: '#E7F6EC' };
}

const PAGE_CSS = `
.sa-canc-page {
  display: grid;
  gap: 1rem;
}
.sa-canc-filters {
  border-top: 3px solid var(--accent);
  background: linear-gradient(
    165deg,
    color-mix(in srgb, var(--accent-soft) 55%, var(--bg-elevated)) 0%,
    var(--bg-elevated) 42%
  );
}
.sa-canc-filters-eyebrow {
  margin: 0 0 0.55rem;
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.sa-canc-section {
  display: grid;
  gap: 0.55rem;
  padding: 0.85rem 0.95rem 1rem;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-card);
}
.sa-canc-section--active {
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
}
.sa-canc-section--partial.sa-canc-section--active {
  border-color: color-mix(in srgb, #f59e0b 28%, var(--border));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, #fff7ed 80%, var(--bg-elevated)) 0%,
    var(--bg-elevated) 3.5rem
  );
}
.sa-canc-section-head {
  display: flex;
  justify-content: space-between;
  gap: 0.85rem;
  align-items: flex-start;
  flex-wrap: wrap;
}
.sa-canc-section-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.14rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.sa-canc-section-hint {
  margin: 0.3rem 0 0;
  font-size: 0.81rem;
  color: var(--text-muted);
  line-height: 1.42;
  max-width: 44rem;
}
.sa-canc-count {
  flex-shrink: 0;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.32rem 0.72rem;
  white-space: nowrap;
}
.sa-canc-count.on {
  color: var(--accent-hover);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 32%, transparent);
}
.sa-canc-section-body {
  display: grid;
  gap: 0.45rem;
}
.sa-canc-empty {
  margin: 0;
  padding: 1.5rem 1rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.86rem;
  border-radius: 14px;
  border: 1px dashed color-mix(in srgb, var(--border) 85%, transparent);
  background: linear-gradient(180deg, var(--bg-muted), var(--bg-elevated));
}
.sa-canc-empty-icon {
  display: inline-flex;
  width: 2.1rem;
  height: 2.1rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  margin-bottom: 0.45rem;
  font-size: 0.95rem;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg) 65%, var(--bg-muted));
  border: 1px solid var(--border);
}
.sa-canc-empty p {
  margin: 0;
  line-height: 1.4;
}
.sa-canc-table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.sa-canc-table {
  width: 100%;
  border-collapse: collapse;
}
.sa-canc-table th {
  text-align: left;
  padding: 0.72rem 0.85rem;
  font-size: 0.66rem;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, var(--bg-muted), color-mix(in srgb, var(--bg-muted) 70%, var(--bg-elevated)));
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
}
.sa-canc-table th.num {
  text-align: right;
}
.sa-canc-table td {
  padding: 0.78rem 0.85rem;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
  font-size: 0.85rem;
  vertical-align: top;
  background: var(--bg-elevated);
}
.sa-canc-table td.muted {
  color: var(--text-muted);
  font-size: 0.83rem;
  white-space: nowrap;
}
.sa-canc-table td.num {
  text-align: right;
}
.sa-canc-row:hover td {
  background: color-mix(in srgb, var(--accent-soft) 35%, var(--bg-elevated));
}
.sa-canc-row:last-child td {
  border-bottom: none;
}
.sa-canc-sticky-actions {
  position: sticky;
  right: 0;
  z-index: 2;
  min-width: 10.5rem;
  background: var(--bg-elevated);
  box-shadow: -8px 0 12px -10px color-mix(in srgb, var(--text) 25%, transparent);
}
.sa-canc-row:hover .sa-canc-sticky-actions {
  background: color-mix(in srgb, var(--accent-soft) 35%, var(--bg-elevated));
}
.sa-canc-order-link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 800;
}
.sa-canc-order-link:hover {
  text-decoration: underline;
}
.sa-canc-order-no {
  font-weight: 700;
}
.sa-canc-party {
  font-weight: 700;
  font-size: 0.87rem;
}
.sa-canc-sub {
  font-size: 0.71rem;
  color: var(--text-muted);
  margin-top: 0.18rem;
  line-height: 1.35;
}
.sa-canc-summary {
  font-weight: 600;
}
.sa-canc-reason {
  font-size: 0.73rem;
  margin-top: 0.22rem;
  color: color-mix(in srgb, var(--text) 88%, var(--text-muted));
  line-height: 1.35;
}
.sa-canc-lost strong {
  font-size: 0.95rem;
  font-weight: 850;
  color: #c2410c;
}
.sa-canc-hints {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  max-width: 16rem;
}
.sa-canc-hints li {
  font-size: 0.72rem;
  line-height: 1.35;
  color: var(--text-muted);
  padding: 0.22rem 0.45rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-muted) 70%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
}
.sa-canc-act-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.32rem;
  align-items: center;
}
.sa-canc-act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.75rem;
  font-size: 0.71rem;
  font-weight: 800;
  font-family: inherit;
  line-height: 1.1;
  border-radius: 999px;
  padding: 0.18rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  background: var(--bg);
  color: var(--text);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.sa-canc-act:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--text) 8%, transparent);
}
.sa-canc-act--primary {
  color: var(--accent-hover);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 38%, transparent);
}
.sa-canc-act--penalty {
  color: #9a3412;
  background: linear-gradient(180deg, #fff7ed, #ffedd5);
  border-color: #fdba74;
}
.sa-canc-act--penalty:hover {
  background: linear-gradient(180deg, #ffedd5, #fed7aa);
}
.sa-canc-act--done {
  cursor: default;
  color: var(--accent-hover);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
}
.sa-canc-events-card {
  border-color: color-mix(in srgb, var(--border) 90%, var(--accent));
}
.sa-canc-toolbar {
  display: grid;
  grid-template-columns:
    minmax(9rem, 1.25fr)
    minmax(6.5rem, 0.7fr)
    minmax(6.5rem, 0.7fr)
    minmax(8rem, 0.8fr)
    minmax(8rem, 0.8fr)
    auto;
  gap: 0.45rem 0.55rem;
  align-items: end;
}
.sa-canc-sides {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.65rem;
  padding-top: 0.55rem;
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}
.sa-canc-chip {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  border-radius: 999px;
  min-height: 1.85rem;
  padding: 0.2rem 0.75rem;
  font-size: 0.76rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}
.sa-canc-chip.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-hover);
  font-weight: 800;
}
.sa-canc-field {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sa-canc-town .hlm-search-select-label,
.sa-canc-field > span:first-child {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sa-canc-field select,
.sa-canc-field .hlm-picker-date-input,
.sa-canc-field input {
  width: 100%;
  box-sizing: border-box;
  min-height: 2.65rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 0.55rem;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 650;
}
.sa-canc-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 2.65rem;
}
@media (max-width: 1100px) {
  .sa-canc-toolbar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .sa-canc-actions { grid-column: 1 / -1; justify-content: flex-start; }
}
@media (max-width: 720px) {
  .sa-canc-toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 520px) {
  .sa-canc-toolbar { grid-template-columns: 1fr; }
}
`;

const styles: Record<string, CSSProperties> = {
  page: { display: 'grid', gap: '1rem' },
  filtersCard: { marginBottom: '0.15rem' },
  filtersEyebrow: {
    margin: '0 0 0.55rem',
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  softCard: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-card)',
  },
  section: {
    display: 'grid',
    gap: '0.75rem',
  },
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.85rem',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  sectionTitleBlock: { minWidth: 0, flex: '1 1 16rem' },
  h2: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.12rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  sectionHint: {
    margin: '0.35rem 0 0',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    lineHeight: 1.45,
    maxWidth: '44rem',
  },
  countBadge: {
    flexShrink: 0,
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '0.35rem 0.75rem',
    whiteSpace: 'nowrap',
  },
  tableScroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '0.8rem 1rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.86rem',
    verticalAlign: 'top',
    background: 'var(--bg-elevated)',
  },
  tdMuted: {
    padding: '0.8rem 1rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.84rem',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
    background: 'var(--bg-elevated)',
  },
  buyerCell: { fontWeight: 700, fontSize: '0.88rem' },
  orderLink: { color: 'var(--accent)', textDecoration: 'none', fontWeight: 800 },
  subMeta: { fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.35 },
  reason: { fontSize: '0.74rem', marginTop: '0.25rem', color: 'var(--text)', lineHeight: 1.4 },
  vertPill: {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: 999,
    fontSize: '0.68rem',
    fontWeight: 800,
    background: 'var(--accent-soft)',
    border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
    color: 'var(--accent-hover)',
  },
  hintList: { margin: 0, paddingLeft: '1.1rem', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.45 },
  empty: {
    margin: 0,
    padding: '1.25rem 1rem',
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
    textAlign: 'center',
    background: 'var(--bg-muted)',
    borderRadius: 14,
    border: '1px dashed color-mix(in srgb, var(--border) 80%, transparent)',
  },
  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.65rem',
    marginTop: '0.15rem',
  },
  pagerBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    boxShadow: 'var(--shadow-card)',
    cursor: 'pointer',
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--text)',
  },
  pagerBtnDisabled: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    cursor: 'not-allowed',
    fontSize: '1.15rem',
    fontWeight: 700,
  },
  pagerMeta: { color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
  actionsCol: { display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' },
  actionChip: {
    display: 'inline-block',
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--accent-hover)',
    background: 'var(--accent-soft)',
    border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
    borderRadius: 999,
    padding: '0.2rem 0.55rem',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  actionBtn: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.22rem 0.5rem',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    cursor: 'pointer',
    color: 'var(--text)',
  },
  penaltySent: {
    fontSize: '0.68rem',
    fontWeight: 800,
    padding: '0.2rem 0.5rem',
    borderRadius: 999,
    border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    whiteSpace: 'nowrap',
  },
};