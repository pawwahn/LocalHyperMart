import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, SearchSelect } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listVendors, type VendorVm } from '../api/vendorsApi';
import {
  FEE_MODEL_OPTIONS,
  listVendorCommercialTermsHistory,
  upsertVendorCommercialTerms,
  type CommissionSlab,
  type VendorCommercialTerms,
  type VendorFeeModel,
} from '../api/commercialTermsApi';

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function feeLabel(model: VendorFeeModel | undefined): string {
  return FEE_MODEL_OPTIONS.find((m) => m.id === model)?.label ?? model ?? '—';
}

function periodLabel(row: VendorCommercialTerms): string {
  const from = row.effectiveFrom ?? '—';
  const to = row.effectiveTo ?? 'present';
  return `${from} → ${to}`;
}

function termsDetail(row: VendorCommercialTerms): string {
  switch (row.feeModel) {
    case 'PER_ORDER_FLAT':
      return `₹${Number(row.perOrderFlatAmount ?? 0).toFixed(2)} / order`;
    case 'COMMISSION_PCT':
      return `${Number(row.commissionPercent ?? 0)}% of gross`;
    case 'HYBRID':
      return `₹${Number(row.monthlySubscriptionAmount ?? 0).toFixed(2)}/mo + ${Number(row.commissionPercent ?? 0)}%`;
    case 'MONTHLY_SUBSCRIPTION':
      return `₹${Number(row.monthlySubscriptionAmount ?? 0).toFixed(2)} / month`;
    case 'SLAB_COMMISSION': {
      const slabs = row.commissionSlabs ?? [];
      if (slabs.length === 0) return 'Slabs not set';
      return slabs
        .map((s) => `${s.uptoAmount == null ? 'Open' : `≤₹${s.uptoAmount}`} @ ${s.percent}%`)
        .join(' · ');
    }
    default:
      return 'No platform fee';
  }
}

function applyTermsToForm(
  terms: VendorCommercialTerms,
  setters: {
    setFeeModel: (v: VendorFeeModel) => void;
    setCommissionPercent: (v: string) => void;
    setPerOrderFlat: (v: string) => void;
    setMonthlySub: (v: string) => void;
    setBillingDay: (v: string) => void;
    setNotes: (v: string) => void;
    setSlabs: (v: CommissionSlab[]) => void;
  },
) {
  setters.setFeeModel(terms.feeModel ?? 'NONE');
  setters.setCommissionPercent(String(terms.commissionPercent ?? 0));
  setters.setPerOrderFlat(String(terms.perOrderFlatAmount ?? 0));
  setters.setMonthlySub(String(terms.monthlySubscriptionAmount ?? 0));
  setters.setBillingDay(String(terms.subscriptionBillingDay ?? 1));
  setters.setNotes(terms.notes ?? '');
  setters.setSlabs(
    terms.commissionSlabs && terms.commissionSlabs.length > 0
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
  const [slabs, setSlabs] = useState<CommissionSlab[]>([
    { uptoAmount: 10000, percent: 5 },
    { uptoAmount: null, percent: 3 },
  ]);
  const [loading, setLoading] = useState(true);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === vendorId) ?? null,
    [vendors, vendorId],
  );

  const formSetters = useMemo(
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

  const loadTerms = useCallback(
    async (id: string) => {
      setLoadingTerms(true);
      setError(null);
      try {
        const data = await listVendorCommercialTermsHistory(token, id);
        setCurrent(data.current ?? null);
        setHistory(data.history ?? []);
        if (data.current) applyTermsToForm(data.current, formSetters);
        setEffectiveFrom(isoToday());
      } catch (err) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load terms');
        setCurrent(null);
        setHistory([]);
      } finally {
        setLoadingTerms(false);
      }
    },
    [token, formSetters],
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
    if (!token || !vendorId) return;
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
      });
      await loadTerms(vendorId);
      setNotice(
        `Saved ${feeLabel(saved.feeModel)} from ${saved.effectiveFrom} → ${saved.effectiveTo ?? 'present'}. History updated below.`,
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell title="Vendor billing" onRefresh={() => (vendorId ? void loadTerms(vendorId) : undefined)}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card elevated style={styles.card}>
        <p style={styles.help}>
          Pick a vendor, set the fee model, choose when it starts. Older date ranges stay in history and still
          apply to orders placed in that period.
        </p>
        <div style={styles.filters}>
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
            placeholder="Select town…"
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
            placeholder="Select vendor…"
          />
        </div>
      </Card>

      {!vendorId ? (
        <Card style={styles.card}>
          <p style={styles.muted}>{loading ? 'Loading…' : 'Select a town and vendor to continue.'}</p>
        </Card>
      ) : loadingTerms ? (
        <Card style={styles.card}>
          <p style={styles.muted}>Loading billing terms…</p>
        </Card>
      ) : (
        <>
          {current ? (
            <Card style={styles.activeCard}>
              <div style={styles.activeHead}>
                <span style={styles.activeBadge}>Active now</span>
                <strong style={styles.activeModel}>{feeLabel(current.feeModel)}</strong>
              </div>
              <p style={styles.activePeriod}>{periodLabel(current)}</p>
              <p style={styles.activeDetail}>{termsDetail(current)}</p>
              {selectedVendor ? (
                <p style={styles.vendorLine}>
                  {selectedVendor.shopName || selectedVendor.businessName}
                  {selectedVendor.gstNumber ? ` · GST ${selectedVendor.gstNumber}` : ''}
                </p>
              ) : null}
            </Card>
          ) : null}

          <Card style={styles.card}>
            <h2 style={styles.h2}>Change fee model</h2>
            <div style={styles.modelList} role="listbox" aria-label="Fee model">
              {FEE_MODEL_OPTIONS.map((m) => {
                const selected = feeModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    style={selected ? styles.modelSelected : styles.modelOption}
                    onClick={() => setFeeModel(m.id)}
                  >
                    <span style={styles.modelTitle}>{m.label}</span>
                    <span style={selected ? styles.modelHelpSelected : styles.modelHelp}>{m.help}</span>
                  </button>
                );
              })}
            </div>

            <div style={styles.form}>
              {feeModel === 'PER_ORDER_FLAT' ? (
                <label style={styles.label}>
                  Flat amount per order (₹)
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
                  Commission %
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
                    Monthly subscription (₹)
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
                    Billing day (1–28)
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

              {feeModel === 'SLAB_COMMISSION' ? (
                <div style={styles.slabBlock}>
                  <div style={styles.slabHead}>
                    <strong>Slabs</strong>
                    <button
                      type="button"
                      style={styles.linkBtn}
                      onClick={() => setSlabs((prev) => [...prev, { uptoAmount: null, percent: 0 }])}
                    >
                      + Add
                    </button>
                  </div>
                  {slabs.map((slab, idx) => (
                    <div key={idx} style={styles.slabCard}>
                      <label style={styles.label}>
                        Upto ₹
                        <input
                          style={styles.input}
                          type="number"
                          min="0"
                          placeholder="blank = open"
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
                      </label>
                      <label style={styles.label}>
                        %
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
                      </label>
                      <button
                        type="button"
                        style={styles.removeBtn}
                        disabled={slabs.length <= 1}
                        onClick={() => setSlabs((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
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
                Notes (optional)
                <input
                  style={styles.input}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal note"
                />
              </label>
            </div>

            <Button disabled={saving} onClick={() => void onSave()}>
              {saving ? 'Saving…' : 'Save fee model'}
            </Button>
          </Card>

          <Card style={styles.card}>
            <h2 style={styles.h2}>History (from → to)</h2>
            {history.length === 0 ? (
              <p style={styles.muted}>No versions yet.</p>
            ) : (
              <ul style={styles.timeline}>
                {history.map((row) => (
                  <li key={row.id ?? `${row.effectiveFrom}-${row.feeModel}`} style={styles.timelineItem}>
                    <div style={styles.timelineTop}>
                      <strong>{periodLabel(row)}</strong>
                      {row.current ? <span style={styles.currentPill}>Current</span> : null}
                    </div>
                    <div style={styles.timelineModel}>{feeLabel(row.feeModel)}</div>
                    <div style={styles.timelineDetail}>{termsDetail(row)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </PortalShell>
  );
}

const SELECTED_GREEN = '#16a34a';
const SELECTED_GREEN_BG = '#dcfce7';
const SELECTED_GREEN_TEXT = '#14532d';

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.85rem' },
  help: { margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.45 },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
    gap: '0.65rem',
  },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' },
  h2: { margin: 0, fontSize: '1.05rem', fontWeight: 800, fontFamily: 'var(--font-display)' },

  activeCard: {
    display: 'grid',
    gap: '0.25rem',
    border: `2px solid ${SELECTED_GREEN}`,
    background: SELECTED_GREEN_BG,
    borderRadius: 'var(--radius-lg)',
    padding: '0.9rem 1rem',
  },
  activeHead: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' },
  activeBadge: {
    fontSize: '0.68rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: SELECTED_GREEN_TEXT,
    background: '#fff',
    border: `1px solid ${SELECTED_GREEN}`,
    borderRadius: '999px',
    padding: '0.15rem 0.5rem',
  },
  activeModel: { fontSize: '1.15rem', color: SELECTED_GREEN_TEXT, fontWeight: 800 },
  activePeriod: { margin: 0, fontWeight: 700, color: SELECTED_GREEN_TEXT, fontSize: '0.95rem' },
  activeDetail: { margin: 0, color: SELECTED_GREEN_TEXT, fontSize: '0.88rem', fontWeight: 600 },
  vendorLine: { margin: '0.35rem 0 0', color: SELECTED_GREEN_TEXT, fontSize: '0.8rem', opacity: 0.85 },

  modelList: { display: 'grid', gap: '0.4rem' },
  modelOption: {
    display: 'grid',
    gap: '0.15rem',
    textAlign: 'left',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    borderRadius: 'var(--radius-md)',
    padding: '0.65rem 0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
  },
  modelSelected: {
    display: 'grid',
    gap: '0.15rem',
    textAlign: 'left',
    border: `2px solid ${SELECTED_GREEN}`,
    background: SELECTED_GREEN_BG,
    borderRadius: 'var(--radius-md)',
    padding: '0.65rem 0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    color: SELECTED_GREEN_TEXT,
  },
  modelTitle: { fontWeight: 800, fontSize: '0.95rem' },
  modelHelp: { fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.3 },
  modelHelpSelected: { fontSize: '0.78rem', color: SELECTED_GREEN_TEXT, fontWeight: 600, lineHeight: 1.3, opacity: 0.9 },

  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
    gap: '0.65rem',
  },
  label: {
    display: 'grid',
    gap: '0.3rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    minWidth: 0,
  },
  input: {
    padding: '0.55rem 0.7rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.95rem',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },

  slabBlock: {
    gridColumn: '1 / -1',
    display: 'grid',
    gap: '0.5rem',
  },
  slabHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkBtn: {
    border: 'none',
    background: 'none',
    color: SELECTED_GREEN,
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
  },
  slabCard: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
    padding: '0.65rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-muted)',
  },
  removeBtn: {
    gridColumn: '1 / -1',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    borderRadius: 'var(--radius-md)',
    padding: '0.55rem 0.65rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    color: 'var(--text-muted)',
    width: '100%',
  },

  timeline: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: '0.55rem',
  },
  timelineItem: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.7rem 0.8rem',
    background: 'var(--bg)',
    display: 'grid',
    gap: '0.2rem',
  },
  timelineTop: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '0.35rem',
    alignItems: 'center',
  },
  currentPill: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: SELECTED_GREEN_TEXT,
    background: SELECTED_GREEN_BG,
    border: `1px solid ${SELECTED_GREEN}`,
    borderRadius: '999px',
    padding: '0.12rem 0.45rem',
  },
  timelineModel: { fontWeight: 800, fontSize: '0.95rem' },
  timelineDetail: { color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
};
