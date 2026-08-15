import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, SearchSelect } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listVendors, type VendorVm } from '../api/vendorsApi';
import {
  ADVANCED_FEE_MODELS,
  FEE_MODEL_OPTIONS,
  PRIMARY_FEE_MODELS,
  listVendorCommercialTermsHistory,
  upsertVendorCommercialTerms,
  type CommissionSlab,
  type VendorCommercialTerms,
  type VendorFeeModel,
} from '../api/commercialTermsApi';

const GREEN = '#16a34a';
const GREEN_BG = '#dcfce7';
const GREEN_TEXT = '#14532d';

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** One-line date for history table (avoids wrapping YYYY-MM-DD). */
function formatHistoryDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function feeLabel(model: VendorFeeModel | undefined): string {
  return FEE_MODEL_OPTIONS.find((m) => m.id === model)?.label ?? model ?? '—';
}

function periodLabel(row: VendorCommercialTerms): string {
  return `${row.effectiveFrom ?? '—'} → ${row.effectiveTo ?? '—'}`;
}

function termsDetail(row: VendorCommercialTerms): string {
  switch (row.feeModel) {
    case 'PER_ORDER_FLAT':
      return `₹${Number(row.perOrderFlatAmount ?? 0).toFixed(2)} / order`;
    case 'COMMISSION_PCT':
      return `${Number(row.commissionPercent ?? 0)}%`;
    case 'HYBRID':
      return `₹${Number(row.monthlySubscriptionAmount ?? 0).toFixed(0)}/mo + ${Number(row.commissionPercent ?? 0)}%`;
    case 'MONTHLY_SUBSCRIPTION':
      return `₹${Number(row.monthlySubscriptionAmount ?? 0).toFixed(2)} / mo`;
    case 'SLAB_COMMISSION': {
      const slabs = row.commissionSlabs ?? [];
      if (!slabs.length) return 'No slabs';
      return slabs
        .map((s) => `${s.uptoAmount == null ? 'open' : `≤${s.uptoAmount}`}@${s.percent}%`)
        .join(' · ');
    }
    default:
      return 'No fee';
  }
}

function applyTerms(
  terms: VendorCommercialTerms,
  set: {
    setFeeModel: (v: VendorFeeModel) => void;
    setCommissionPercent: (v: string) => void;
    setPerOrderFlat: (v: string) => void;
    setMonthlySub: (v: string) => void;
    setBillingDay: (v: string) => void;
    setNotes: (v: string) => void;
    setSlabs: (v: CommissionSlab[]) => void;
  },
) {
  set.setFeeModel(terms.feeModel ?? 'NONE');
  set.setCommissionPercent(String(terms.commissionPercent ?? 0));
  set.setPerOrderFlat(String(terms.perOrderFlatAmount ?? 0));
  set.setMonthlySub(String(terms.monthlySubscriptionAmount ?? 0));
  set.setBillingDay(String(terms.subscriptionBillingDay ?? 1));
  set.setNotes(terms.notes ?? '');
  set.setSlabs(
    terms.commissionSlabs?.length
      ? terms.commissionSlabs
      : [
          { uptoAmount: 10000, percent: 5 },
          { uptoAmount: null, percent: 3 },
        ],
  );
}

export function VendorBillingPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [vendors, setVendors] = useState<VendorVm[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [current, setCurrent] = useState<VendorCommercialTerms | null>(null);
  const [history, setHistory] = useState<VendorCommercialTerms[]>([]);
  const [feeModel, setFeeModel] = useState<VendorFeeModel>('NONE');
  const [commissionPercent, setCommissionPercent] = useState('0');
  const [perOrderFlat, setPerOrderFlat] = useState('0');
  const [monthlySub, setMonthlySub] = useState('0');
  const [billingDay, setBillingDay] = useState('1');
  const [notes, setNotes] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(isoToday());
  const [effectiveTo, setEffectiveTo] = useState('');
  const [slabs, setSlabs] = useState<CommissionSlab[]>([
    { uptoAmount: 10000, percent: 5 },
    { uptoAmount: null, percent: 3 },
  ]);
  const [loading, setLoading] = useState(true);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const formSet = useMemo(
    () => ({
      setFeeModel,
      setCommissionPercent,
      setPerOrderFlat,
      setMonthlySub,
      setBillingDay,
      setNotes,
      setSlabs,
    }),
    [],
  );

  const townOptions = useMemo(
    () =>
      towns.map((t) => ({
        value: t.id,
        label: t.displayName || t.townCode,
        searchText: [t.displayName, t.townCode, t.state].filter(Boolean).join(' '),
      })),
    [towns],
  );

  const vendorOptions = useMemo(
    () =>
      vendors.map((v) => ({
        value: v.id,
        label: `${v.shopName || v.businessName} · ${v.phone}`,
        searchText: [v.shopName, v.businessName, v.phone].filter(Boolean).join(' '),
      })),
    [vendors],
  );

  const modelHelp = FEE_MODEL_OPTIONS.find((m) => m.id === feeModel)?.help ?? '';

  /** Always show + highlight the active terms (API may omit them when today falls in a gap). */
  const historyDisplay = useMemo(() => {
    const rows = history.map((row) => ({
      ...row,
      current: Boolean(row.current || (current?.id && row.id === current.id)),
    }));
    const currentInList = current?.id
      ? rows.some((r) => r.id === current.id)
      : rows.some((r) => r.current);
    if (current && !currentInList) {
      rows.unshift({ ...current, current: true });
    }
    rows.sort((a, b) => Number(Boolean(b.current)) - Number(Boolean(a.current)));
    return rows;
  }, [history, current]);

  const loadTerms = useCallback(
    async (id: string) => {
      setLoadingTerms(true);
      setError(null);
      try {
        const data = await listVendorCommercialTermsHistory(token, id);
        setCurrent(data.current ?? null);
        setHistory(data.history ?? []);
        if (data.current) {
          applyTerms(data.current, formSet);
          const isAdvanced = ADVANCED_FEE_MODELS.some((m) => m.id === data.current?.feeModel);
          setShowAdvanced(isAdvanced);
        }
        // New save starts today and stays open-ended unless admin sets Ends on.
        setEffectiveFrom(isoToday());
        setEffectiveTo('');
      } catch (err) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load terms');
        setCurrent(null);
        setHistory([]);
      } finally {
        setLoadingTerms(false);
      }
    },
    [token, formSet],
  );

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const townList = await listTowns(token);
        setTowns(townList);
        setTownId((prev) => (townList.some((t) => t.id === prev) ? prev : (townList[0]?.id ?? '')));
      } catch (err) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load towns');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || !townId) {
      setVendors([]);
      setVendorId('');
      return;
    }
    void (async () => {
      try {
        const list = await listVendors(token, townId);
        setVendors(list);
        setVendorId((prev) => (list.some((v) => v.id === prev) ? prev : ''));
      } catch (err) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load vendors');
      }
    })();
  }, [token, townId]);

  useEffect(() => {
    if (!token || !vendorId) {
      setCurrent(null);
      setHistory([]);
      return;
    }
    void loadTerms(vendorId);
  }, [token, vendorId, loadTerms]);

  async function onSave() {
    if (!token || !vendorId || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await upsertVendorCommercialTerms(token, vendorId, {
        feeModel,
        commissionPercent: Number(commissionPercent || 0),
        perOrderFlatAmount: Number(perOrderFlat || 0),
        monthlySubscriptionAmount: Number(monthlySub || 0),
        subscriptionBillingDay: Number(billingDay || 1),
        commissionSlabs: feeModel === 'SLAB_COMMISSION' ? slabs : undefined,
        notes: notes.trim() || undefined,
        effectiveFrom: effectiveFrom || isoToday(),
        effectiveTo: effectiveTo || null,
      });
      await loadTerms(vendorId);
      setNotice(`Saved ${feeLabel(saved.feeModel)} · ${periodLabel(saved)}`);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell title="Vendor billing" onRefresh={() => (vendorId ? void loadTerms(vendorId) : undefined)}>
      <style>{css}</style>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card elevated padding="sm" style={styles.card}>
        <div className="vb-filters">
          <SearchSelect
            label="Town"
            value={townId}
            options={townOptions}
            onChange={(id) => {
              setTownId(id);
              setVendorId('');
              setNotice(null);
            }}
            disabled={loading || towns.length === 0}
            placeholder="Town…"
          />
          <SearchSelect
            label="Vendor"
            value={vendorId}
            options={vendorOptions}
            onChange={(id) => {
              setVendorId(id);
              setNotice(null);
            }}
            disabled={!townId || vendors.length === 0}
            placeholder="Vendor…"
          />
        </div>
      </Card>

      {!vendorId ? (
        <Card padding="sm">
          <p style={styles.muted}>{loading ? 'Loading…' : 'Select town and vendor.'}</p>
        </Card>
      ) : loadingTerms ? (
        <Card padding="sm">
          <p style={styles.muted}>Loading terms…</p>
        </Card>
      ) : (
        <div className="vb-layout">
          <Card padding="sm" style={styles.card}>
            {current ? (
              <div style={styles.activeBar}>
                <span style={styles.activeBadge}>Active</span>
                <strong>{feeLabel(current.feeModel)}</strong>
                <span style={styles.activeMeta}>
                  {formatHistoryDate(current.effectiveFrom)} → {formatHistoryDate(current.effectiveTo)}
                </span>
                <span style={styles.activeMeta}>{termsDetail(current)}</span>
              </div>
            ) : null}

            <div className="vb-editor">
              <div style={styles.pickerBlock}>
                <span style={styles.labelText}>How do you charge this vendor?</span>
                <div className="vb-chips" role="listbox" aria-label="Fee model">
                  {PRIMARY_FEE_MODELS.map((m) => {
                    const selected = feeModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        style={selected ? styles.chipOn : styles.chip}
                        onClick={() => setFeeModel(m.id)}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  style={styles.advancedToggle}
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  {showAdvanced ? 'Hide advanced' : 'Advanced (monthly + % / tiered %)'}
                </button>
                {showAdvanced ? (
                  <div className="vb-chips">
                    {ADVANCED_FEE_MODELS.map((m) => {
                      const selected = feeModel === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          style={selected ? styles.chipOn : styles.chip}
                          onClick={() => setFeeModel(m.id)}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <span style={styles.hint}>{modelHelp}</span>
              </div>

              <div className="vb-params">
                {feeModel === 'PER_ORDER_FLAT' ? (
                  <label style={styles.label}>
                    ₹ per order
                    <input
                      style={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      value={perOrderFlat}
                      onChange={(e) => setPerOrderFlat(e.target.value)}
                    />
                  </label>
                ) : null}

                {feeModel === 'COMMISSION_PCT' || feeModel === 'HYBRID' ? (
                  <label style={styles.label}>
                    % on payout
                    <input
                      style={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      value={commissionPercent}
                      onChange={(e) => setCommissionPercent(e.target.value)}
                    />
                  </label>
                ) : null}

                {feeModel === 'MONTHLY_SUBSCRIPTION' || feeModel === 'HYBRID' ? (
                  <>
                    <label style={styles.label}>
                      ₹ each month
                      <input
                        style={styles.input}
                        type="number"
                        min="0"
                        step="0.01"
                        value={monthlySub}
                        onChange={(e) => setMonthlySub(e.target.value)}
                      />
                    </label>
                    <label style={styles.label}>
                      Day of month
                      <input
                        style={styles.input}
                        type="number"
                        min="1"
                        max="28"
                        value={billingDay}
                        onChange={(e) => setBillingDay(e.target.value)}
                      />
                    </label>
                  </>
                ) : null}

                <label style={styles.label}>
                  Starts from
                  <input
                    style={styles.input}
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                  />
                </label>
                <label style={styles.label}>
                  Ends on
                  <input
                    style={styles.input}
                    type="date"
                    value={effectiveTo}
                    min={effectiveFrom || undefined}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                  />
                </label>
              </div>

              {feeModel === 'SLAB_COMMISSION' ? (
                <div style={styles.slabWrap}>
                  <p style={styles.slabExplain}>
                    Set % by payout size. Example: up to ₹300 → 5%, up to ₹700 → 4%, above that → 3%.
                  </p>
                  <div style={styles.slabHead}>
                    <span style={styles.slabTitle}>Tiers</span>
                    <button
                      type="button"
                      style={styles.addBtn}
                      onClick={() => setSlabs((p) => [...p, { uptoAmount: null, percent: 0 }])}
                    >
                      + Add
                    </button>
                  </div>
                  <div style={styles.slabTable}>
                    <div style={styles.slabHeaderRow}>
                      <span>If payout up to ₹</span>
                      <span>Charge %</span>
                      <span />
                    </div>
                    {slabs.map((slab, idx) => (
                      <div key={idx} style={styles.slabRow}>
                        <input
                          style={styles.input}
                          type="number"
                          min="0"
                          placeholder="no limit"
                          value={slab.uptoAmount ?? ''}
                          onChange={(e) => {
                            const next = [...slabs];
                            next[idx] = {
                              ...slab,
                              uptoAmount: e.target.value === '' ? null : Number(e.target.value),
                            };
                            setSlabs(next);
                          }}
                        />
                        <input
                          style={styles.input}
                          type="number"
                          min="0"
                          step="0.01"
                          value={slab.percent}
                          onChange={(e) => {
                            const next = [...slabs];
                            next[idx] = { ...slab, percent: Number(e.target.value || 0) };
                            setSlabs(next);
                          }}
                        />
                        <button
                          type="button"
                          style={styles.xBtn}
                          disabled={slabs.length <= 1}
                          aria-label="Remove tier"
                          onClick={() => setSlabs((p) => p.filter((_, i) => i !== idx))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <label style={styles.label}>
                Notes (optional)
                <input
                  style={styles.input}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal note"
                />
              </label>

              <div style={styles.saveRow}>
                <Button size="sm" disabled={saving} onClick={() => void onSave()}>
                  {saving ? 'Saving…' : 'Save fee model'}
                </Button>
                <span style={styles.hint}>Orders keep the model active on their placed date.</span>
              </div>
            </div>
          </Card>

          <Card padding="sm" style={styles.card}>
            <h2 style={styles.h2}>History</h2>
            {historyDisplay.length === 0 ? (
              <p style={styles.muted}>No versions yet.</p>
            ) : (
              <div style={styles.histList}>
                {historyDisplay.map((row, index) => (
                  <div
                    key={row.id ?? `${row.effectiveFrom}-${row.feeModel}-${index}`}
                    style={row.current ? styles.histItemCurrent : styles.histItem}
                  >
                    <div style={styles.histTop}>
                      <span style={styles.histPeriod}>
                        {formatHistoryDate(row.effectiveFrom)} → {formatHistoryDate(row.effectiveTo)}
                      </span>
                      <span style={styles.histModel}>
                        {feeLabel(row.feeModel)}
                        {row.current ? <span style={styles.pill}>current</span> : null}
                      </span>
                    </div>
                    <p style={styles.histDetail}>{termsDetail(row)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </PortalShell>
  );
}

const css = `
.vb-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}
.vb-layout {
  display: grid;
  gap: 0.65rem;
}
.vb-editor {
  display: grid;
  gap: 0.65rem;
}
.vb-params {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
  gap: 0.45rem 0.55rem;
  align-items: start;
}
.vb-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
@media (max-width: 640px) {
  .vb-filters { grid-template-columns: 1fr; }
}
@media (min-width: 960px) {
  .vb-layout {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    align-items: start;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.55rem' },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' },
  h2: { margin: 0, fontSize: '0.95rem', fontWeight: 800 },
  label: {
    display: 'grid',
    gap: '0.2rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    minWidth: 0,
  },
  labelText: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  hint: { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.3 },
  pickerBlock: { display: 'grid', gap: '0.4rem' },
  chip: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    borderRadius: '999px',
    padding: '0.35rem 0.7rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  chipOn: {
    border: `1.5px solid ${GREEN}`,
    background: GREEN_BG,
    color: GREEN_TEXT,
    borderRadius: '999px',
    padding: '0.35rem 0.7rem',
    fontSize: '0.8rem',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  advancedToggle: {
    border: 'none',
    background: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    textAlign: 'left',
    fontFamily: 'inherit',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    width: 'fit-content',
  },
  input: {
    padding: '0.4rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.9rem',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    minHeight: '2.25rem',
  },
  activeBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem 0.65rem',
    padding: '0.45rem 0.6rem',
    borderRadius: 'var(--radius-md)',
    border: `1px solid ${GREEN}`,
    background: GREEN_BG,
    color: GREEN_TEXT,
    fontSize: '0.82rem',
  },
  activeBadge: {
    fontSize: '0.62rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    background: '#fff',
    border: `1px solid ${GREEN}`,
    borderRadius: '999px',
    padding: '0.1rem 0.4rem',
  },
  activeMeta: { color: GREEN_TEXT, fontWeight: 600, opacity: 0.9 },
  slabWrap: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.45rem 0.55rem',
    display: 'grid',
    gap: '0.35rem',
    background: 'var(--bg-muted)',
  },
  slabHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  slabTitle: { fontSize: '0.78rem', fontWeight: 800 },
  slabExplain: {
    margin: 0,
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    lineHeight: 1.35,
  },
  addBtn: {
    border: 'none',
    background: 'none',
    color: GREEN,
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontFamily: 'inherit',
    padding: 0,
  },
  slabTable: { display: 'grid', gap: '0.3rem' },
  slabHeaderRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 4.5rem 2rem',
    gap: '0.35rem',
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    padding: '0 0.1rem',
  },
  slabRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 4.5rem 2rem',
    gap: '0.35rem',
    alignItems: 'center',
  },
  xBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    borderRadius: 'var(--radius-md)',
    height: '2.25rem',
    cursor: 'pointer',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    lineHeight: 1,
    fontFamily: 'inherit',
  },
  saveRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.55rem',
  },
  histList: {
    display: 'grid',
    gap: '0.45rem',
    minWidth: 0,
  },
  histItem: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.5rem 0.6rem',
    background: 'var(--bg)',
    display: 'grid',
    gap: '0.25rem',
    minWidth: 0,
  },
  histItemCurrent: {
    border: `2px solid ${GREEN}`,
    borderRadius: 'var(--radius-md)',
    padding: '0.5rem 0.6rem',
    background: GREEN_BG,
    boxShadow: `0 0 0 1px ${GREEN_BG}`,
    display: 'grid',
    gap: '0.25rem',
    minWidth: 0,
  },
  histTop: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.35rem 0.75rem',
    minWidth: 0,
  },
  histPeriod: {
    fontWeight: 700,
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
  },
  histModel: {
    fontWeight: 800,
    fontSize: '0.78rem',
    color: 'var(--text)',
    whiteSpace: 'nowrap',
  },
  histDetail: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
  pill: {
    marginLeft: '0.35rem',
    fontSize: '0.62rem',
    fontWeight: 800,
    color: GREEN_TEXT,
    background: GREEN_BG,
    border: `1px solid ${GREEN}`,
    borderRadius: '999px',
    padding: '0.05rem 0.35rem',
    verticalAlign: 'middle',
  },
};
