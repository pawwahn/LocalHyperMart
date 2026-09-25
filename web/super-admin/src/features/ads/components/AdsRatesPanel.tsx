import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import {
  fetchAdRates,
  saveAdRates,
  money,
  type AdPeriodRate,
  type AdRateCard,
  type AdSlotRate,
} from '../api/adsBillingApi';

type Props = {
  token: string;
  onSaved?: () => void;
};

type PeriodKey = 'day' | 'week' | 'month' | 'year';
type SlotKey = 'homeHero' | 'homeMidGrid' | 'cartUpsell';
type ChargeKey = 'oneTown' | 'extraTown' | 'allTowns';

type PeriodDraft = { oneTown: string; extraTown: string; allTowns: string };
type SlotDraft = Record<PeriodKey, PeriodDraft>;
type Draft = {
  taxPercent: string;
  notes: string;
  homeHero: SlotDraft;
  homeMidGrid: SlotDraft;
  cartUpsell: SlotDraft;
};

const SLOTS: { key: SlotKey; label: string; hint: string }[] = [
  { key: 'homeHero', label: 'Main ad', hint: 'Home strip' },
  { key: 'homeMidGrid', label: 'Mid-grid ad', hint: 'Each carousel slide' },
  { key: 'cartUpsell', label: 'Cart ad', hint: 'Cart / checkout' },
];

const PERIODS: { key: PeriodKey; label: string; hint: string }[] = [
  { key: 'day', label: 'Per day', hint: 'Calendar days, billed 1:1.' },
  { key: 'week', label: 'Per week', hint: 'Units = ceil(days ÷ 7).' },
  { key: 'month', label: 'Per month', hint: 'Units = ceil(days ÷ 30).' },
  { key: 'year', label: 'Per year', hint: 'Units = ceil(days ÷ 365).' },
];

const CHARGES: { key: ChargeKey; label: string }[] = [
  { key: 'oneTown', label: '1 town' },
  { key: 'extraTown', label: 'Extra town' },
  { key: 'allTowns', label: 'All towns' },
];

function emptyPeriod(): PeriodDraft {
  return { oneTown: '0', extraTown: '0', allTowns: '0' };
}

function fromPeriod(p?: AdPeriodRate | null): PeriodDraft {
  return {
    oneTown: String(p?.oneTown ?? 0),
    extraTown: String(p?.extraTown ?? 0),
    allTowns: String(p?.allTowns ?? 0),
  };
}

function fromSlot(s?: AdSlotRate | null): SlotDraft {
  return {
    day: fromPeriod(s?.day),
    week: fromPeriod(s?.week),
    month: fromPeriod(s?.month),
    year: fromPeriod(s?.year),
  };
}

function fromCard(card: AdRateCard): Draft {
  return {
    taxPercent: String(card.taxPercent ?? 0),
    notes: card.notes ?? '',
    homeHero: fromSlot(card.homeHero),
    homeMidGrid: fromSlot(card.homeMidGrid),
    cartUpsell: fromSlot(card.cartUpsell),
  };
}

function num(raw: string): number {
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function toPeriod(x: PeriodDraft): AdPeriodRate {
  return { oneTown: num(x.oneTown), extraTown: num(x.extraTown), allTowns: num(x.allTowns) };
}

function toSlot(d: SlotDraft): AdSlotRate {
  return { day: toPeriod(d.day), week: toPeriod(d.week), month: toPeriod(d.month), year: toPeriod(d.year) };
}

function draftSnapshot(d: Draft): string {
  return JSON.stringify(d);
}

export function AdsRatesPanel({ token, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchAdRates(token)
      .then((card) => {
        if (!cancelled) {
          const next = fromCard(card);
          setDraft(next);
          setSavedSnapshot(draftSnapshot(next));
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load rates');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isDirty = useMemo(() => {
    if (!draft || savedSnapshot == null) return false;
    return draftSnapshot(draft) !== savedSnapshot;
  }, [draft, savedSnapshot]);

  function patch(slot: SlotKey, period: PeriodKey, field: ChargeKey, value: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const current = prev[slot][period] ?? emptyPeriod();
      return {
        ...prev,
        [slot]: {
          ...prev[slot],
          [period]: { ...current, [field]: value },
        },
      };
    });
  }

  async function onSave() {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const saved = await saveAdRates(token, {
        taxPercent: num(draft.taxPercent),
        notes: draft.notes.trim() || undefined,
        homeHero: toSlot(draft.homeHero),
        homeMidGrid: toSlot(draft.homeMidGrid),
        cartUpsell: toSlot(draft.cartUpsell),
      });
      const next = fromCard(saved);
      setDraft(next);
      setSavedSnapshot(draftSnapshot(next));
      setOk('Rate card saved. New bills use these prices; existing invoices keep their snapshot.');
      onSaved?.();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !draft) {
    return <p style={styles.muted}>{error ?? 'Loading rate card…'}</p>;
  }

  return (
    <div style={styles.wrap}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {ok ? <Banner tone="success">{ok}</Banner> : null}
      <Card padding="sm" style={styles.card}>
        <div style={styles.head}>
          <div>
            <h2 style={styles.h2}>Rate card</h2>
            <p style={styles.hint}>
              1 town is the base. Extra town adds for each additional town. All towns is a flat network price.
            </p>
          </div>
          <Button disabled={saving || !isDirty} onClick={() => void onSave()}>
            {saving ? 'Saving…' : 'Save rates'}
          </Button>
        </div>
        <div style={styles.metaRow}>
          <label style={styles.field}>
            GST %
            <input
              style={styles.input}
              inputMode="decimal"
              value={draft.taxPercent}
              onChange={(e) => setDraft({ ...draft, taxPercent: e.target.value })}
            />
          </label>
          <label style={{ ...styles.field, flex: 1 }}>
            Notes
            <input
              style={styles.input}
              value={draft.notes}
              maxLength={500}
              placeholder="Optional"
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
        </div>
      </Card>

      {PERIODS.map((period) => (
        <Card key={period.key} padding="sm" style={styles.periodCard}>
          <div style={styles.periodHead}>
            <h3 style={styles.periodTitle}>{period.label}</h3>
            <p style={styles.periodHint}>{period.hint}</p>
          </div>
          <div style={styles.grid}>
            <div style={styles.slotRow}>
              <span style={styles.colHead}>Placement</span>
              {CHARGES.map((c) => (
                <span key={c.key} style={{ ...styles.colHead, textAlign: 'right' }}>
                  {c.label}
                </span>
              ))}
            </div>
            {SLOTS.map((slot) => {
              const rates = draft[slot.key][period.key] ?? emptyPeriod();
              return (
                <div key={slot.key} style={styles.slotRow}>
                  <div style={styles.slotName}>
                    <strong>{slot.label}</strong>
                    <span style={styles.slotHint}>{slot.hint}</span>
                  </div>
                  {CHARGES.map((c) => (
                    <label key={c.key} style={styles.moneyWrap}>
                      <span style={styles.srOnly}>
                        {slot.label} {period.label} {c.label}
                      </span>
                      <span style={styles.rupee}>₹</span>
                      <input
                        style={styles.money}
                        inputMode="decimal"
                        value={rates[c.key]}
                        onChange={(e) => patch(slot.key, period.key, c.key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <p style={styles.example}>
        Example · per day · 3 towns · 10 days: ({money(num(draft.homeHero.day.oneTown))} +{' '}
        {money(num(draft.homeHero.day.extraTown))} × 2) × 10 for the main ad.
      </p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.55rem' },
  muted: { margin: 0, color: 'var(--text-muted)', fontWeight: 600 },
  card: { display: 'grid', gap: '0.45rem' },
  head: { display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  h2: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800 },
  hint: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.35, maxWidth: 560 },
  metaRow: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'end' },
  field: { display: 'grid', gap: '0.2rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', minWidth: 88 },
  input: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.42rem 0.55rem',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 700,
    minWidth: 0,
  },
  periodCard: { display: 'grid', gap: '0.4rem' },
  periodHead: { display: 'flex', alignItems: 'baseline', gap: '0.55rem', flexWrap: 'wrap' },
  periodTitle: { margin: 0, fontSize: '0.92rem', fontWeight: 800 },
  periodHint: { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 },
  grid: { display: 'grid', gap: '0.3rem' },
  colHead: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    padding: '0 0.45rem',
  },
  slotRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(7.5rem, 0.9fr) repeat(3, minmax(7rem, 1fr))',
    gap: '0.35rem',
    alignItems: 'center',
  },
  slotName: { display: 'grid', gap: '0.05rem', minWidth: 0 },
  slotHint: { fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' },
  moneyWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.2rem',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0 0.45rem',
    background: 'var(--bg)',
    minWidth: 0,
  },
  rupee: { fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)' },
  money: {
    flex: 1,
    minWidth: 0,
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontWeight: 700,
    padding: '0.42rem 0',
    textAlign: 'right',
    outline: 'none',
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
  },
  example: { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' },
};
