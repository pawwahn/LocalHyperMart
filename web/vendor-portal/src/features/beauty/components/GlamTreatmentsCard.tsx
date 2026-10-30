import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import {
  BEAUTY_SERVICE_CATEGORIES,
  BEAUTY_SERVICES,
  beautyServicesInCategory,
  saveBeautyRates,
  slugCustomTreatmentCode,
  type BeautyProfile,
  type BeautyRateRow,
  type BeautyServiceCategoryId,
} from '../api/beautyApi';

type TreatmentTab = BeautyServiceCategoryId | 'CUSTOM';

type CustomTreatmentRow = {
  key: string;
  code: string;
  label: string;
  price: string;
  minutes: string;
  paused: boolean;
};

function priceText(value: number): string {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? String(amount) : '';
}

function applyRatesToForm(rates: BeautyRateRow[] | undefined) {
  const nextPrices: Record<string, string> = {};
  const nextMinutes: Record<string, string> = {};
  const nextPaused: Record<string, boolean> = {};
  for (const service of BEAUTY_SERVICES) {
    const found = rates?.find((rate) => rate.serviceType === service.id);
    nextPrices[service.id] = found ? priceText(found.unitPrice) : '';
    nextMinutes[service.id] = found ? String(found.durationMinutes) : String(service.defaultMinutes);
    nextPaused[service.id] = Boolean(found?.paused);
  }
  const customs = rates?.filter((row) => row.serviceType.startsWith('CUS_')) ?? [];
  const customRows: CustomTreatmentRow[] = customs.map((row) => ({
    key: row.serviceType,
    code: row.serviceType,
    label: row.label ?? '',
    price: row.unitPrice ? priceText(row.unitPrice) : '',
    minutes: String(row.durationMinutes ?? 60),
    paused: Boolean(row.paused),
  }));
  return { nextPrices, nextMinutes, nextPaused, customRows };
}

function buildPayload(
  prices: Record<string, string>,
  minutes: Record<string, string>,
  paused: Record<string, boolean>,
  customRows: CustomTreatmentRow[],
) {
  const standardRates = BEAUTY_SERVICES.filter((service) => prices[service.id]?.trim()).map((service) => ({
    serviceType: service.id,
    unitPrice: Number(prices[service.id]),
    durationMinutes: Number(minutes[service.id] || service.defaultMinutes),
    paused: paused[service.id] === true,
  }));
  const customRates = customRows
    .filter((row) => row.label.trim() && row.price.trim())
    .map((row) => {
      const code = row.code.trim() || slugCustomTreatmentCode(row.label);
      return {
        serviceType: code,
        unitPrice: Number(row.price),
        durationMinutes: Number(row.minutes || 60),
        paused: row.paused,
      };
    });
  const customTreatments = customRows
    .filter((row) => row.label.trim() && row.price.trim())
    .map((row) => ({
      serviceCode: row.code.trim() || slugCustomTreatmentCode(row.label),
      label: row.label.trim(),
    }));
  return { rates: [...standardRates, ...customRates], customTreatments };
}

type Props = {
  token: string;
  profile: BeautyProfile | null;
  onSaved: (saved: BeautyProfile) => void;
  onError: (message: string) => void;
  onToast: (message: string) => void;
};

export function GlamTreatmentsCard({ token, profile, onSaved, onError, onToast }: Props) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const [paused, setPaused] = useState<Record<string, boolean>>({});
  const [customRows, setCustomRows] = useState<CustomTreatmentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [treatmentTab, setTreatmentTab] = useState<TreatmentTab>('MAKEUP');

  const visibleServices = useMemo(
    () => (treatmentTab === 'CUSTOM' ? [] : beautyServicesInCategory(treatmentTab)),
    [treatmentTab],
  );

  useEffect(() => {
    const applied = applyRatesToForm(profile?.rates);
    setPrices(applied.nextPrices);
    setMinutes(applied.nextMinutes);
    setPaused(applied.nextPaused);
    setCustomRows(applied.customRows);
  }, [profile?.rates, profile?.vendorId]);

  const savedForm = useMemo(() => applyRatesToForm(profile?.rates), [profile?.rates, profile?.vendorId]);
  const dirty = useMemo(() => {
    const saved = buildPayload(savedForm.nextPrices, savedForm.nextMinutes, savedForm.nextPaused, savedForm.customRows);
    const draft = buildPayload(prices, minutes, paused, customRows);
    return JSON.stringify(saved) !== JSON.stringify(draft);
  }, [savedForm, prices, minutes, paused, customRows]);

  function addCustomTreatment() {
    setCustomRows((prev) => [...prev, { key: `new-${Date.now()}`, code: '', label: '', price: '', minutes: '60', paused: false }]);
  }

  async function save() {
    if (!token || saving) return;
    const body = buildPayload(prices, minutes, paused, customRows);
    for (const row of body.rates) {
      if (!Number.isFinite(row.unitPrice) || row.unitPrice <= 0) {
        onError('Each treatment with a price must be greater than zero');
        return;
      }
    }
    setSaving(true);
    try {
      const saved = await saveBeautyRates(token, body);
      onSaved(saved);
      onToast(`Saved ${body.rates.filter((r) => !r.paused).length} visible treatment${body.rates.length === 1 ? '' : 's'} for customers`);
    } catch (err) {
      onError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save treatments');
    } finally {
      setSaving(false);
    }
  }

  if (!profile?.enabled) return null;

  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <span style={styles.step} aria-hidden>
          ₹
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={styles.title}>Treatments &amp; prices</p>
          <p style={styles.sub}>
            Your prices override town defaults and appear in the buyer app. Use <strong>Hidden</strong> until a service is ready.
          </p>
        </div>
      </div>

      <div style={styles.categoryTabs} role="tablist" aria-label="Treatment categories">
        {BEAUTY_SERVICE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={treatmentTab === cat.id}
            style={treatmentTab === cat.id ? styles.categoryTabOn : styles.categoryTab}
            onClick={() => setTreatmentTab(cat.id)}
          >
            <span aria-hidden>{cat.emoji}</span> {cat.label}
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={treatmentTab === 'CUSTOM'}
          style={treatmentTab === 'CUSTOM' ? styles.categoryTabOn : styles.categoryTab}
          onClick={() => setTreatmentTab('CUSTOM')}
        >
          <span aria-hidden>➕</span> Custom
          {customRows.length > 0 ? <span style={styles.tabBadge}>{customRows.length}</span> : null}
        </button>
      </div>

      {treatmentTab !== 'CUSTOM' ? (
        <div style={styles.rateGrid}>
          <span style={styles.colHead}>Treatment</span>
          <span style={styles.colHead}>Price ₹</span>
          <span style={styles.colHead}>Mins</span>
          <span style={styles.colHead}>Buyers see?</span>
          {visibleServices.map((service) => (
            <Fragment key={service.id}>
              <span style={styles.serviceLabel}>
                {service.emoji} {service.label}
              </span>
              <input
                style={styles.price}
                inputMode="decimal"
                placeholder="—"
                value={prices[service.id] ?? ''}
                onChange={(e) => setPrices((prev) => ({ ...prev, [service.id]: e.target.value.replace(/[^\d.]/g, '') }))}
              />
              <input
                style={styles.price}
                inputMode="numeric"
                value={minutes[service.id] ?? ''}
                onChange={(e) => setMinutes((prev) => ({ ...prev, [service.id]: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
              />
              <button
                type="button"
                style={paused[service.id] ? styles.hiddenBtn : styles.visibleBtn}
                disabled={!prices[service.id]?.trim()}
                title={!prices[service.id]?.trim() ? 'Add a price first' : undefined}
                onClick={() => setPaused((prev) => ({ ...prev, [service.id]: !prev[service.id] }))}
              >
                {paused[service.id] ? 'Hidden' : 'Visible'}
              </button>
            </Fragment>
          ))}
        </div>
      ) : (
        <div style={styles.customBlock}>
          <p style={styles.customTitle}>Custom treatments</p>
          <p style={styles.customSub}>Packages or services not in the standard catalog.</p>
          {customRows.length === 0 ? (
            <p style={styles.customEmpty}>No custom treatments yet — add one below.</p>
          ) : null}
          {customRows.map((row, index) => (
            <div key={row.key} style={styles.customRow}>
              <input
                style={styles.customName}
                placeholder="e.g. Gel pedicure"
                value={row.label}
                onChange={(e) =>
                  setCustomRows((prev) => prev.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)))
                }
              />
              <input
                style={styles.price}
                inputMode="decimal"
                placeholder="₹"
                value={row.price}
                onChange={(e) =>
                  setCustomRows((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, price: e.target.value.replace(/[^\d.]/g, '') } : item)),
                  )
                }
              />
              <input
                style={styles.price}
                inputMode="numeric"
                placeholder="min"
                value={row.minutes}
                onChange={(e) =>
                  setCustomRows((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, minutes: e.target.value.replace(/\D/g, '').slice(0, 3) } : item)),
                  )
                }
              />
              <button
                type="button"
                style={row.paused ? styles.hiddenBtn : styles.visibleBtn}
                onClick={() => setCustomRows((prev) => prev.map((item, i) => (i === index ? { ...item, paused: !item.paused } : item)))}
              >
                {row.paused ? 'Hidden' : 'Visible'}
              </button>
              <button type="button" style={styles.removeBtn} aria-label="Remove treatment" onClick={() => setCustomRows((prev) => prev.filter((_, i) => i !== index))}>
                ×
              </button>
            </div>
          ))}
          <button type="button" style={styles.chip} onClick={addCustomTreatment}>
            + Add custom treatment
          </button>
        </div>
      )}

      <div style={styles.actions}>
        <button type="button" style={styles.primary} disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? 'Saving…' : dirty ? 'Save treatments' : 'Treatments saved'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    padding: '0.55rem 0.65rem',
    borderRadius: 14,
    border: '1px solid #f9a8d4',
    background: 'linear-gradient(135deg, #fff 0%, #fdf2f8 100%)',
    boxShadow: '0 4px 14px rgba(190, 24, 93, 0.06)',
    display: 'grid',
    gap: '0.45rem',
  },
  head: { display: 'flex', gap: '0.5rem', alignItems: 'flex-start' },
  step: {
    width: 32,
    height: 32,
    borderRadius: 10,
    background: '#fce7f3',
    color: '#831843',
    fontWeight: 900,
    fontSize: '0.85rem',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  title: { margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#831843', letterSpacing: '-0.02em' },
  sub: { margin: '0.12rem 0 0', fontSize: '0.65rem', lineHeight: 1.35, color: '#6b7280', fontWeight: 600 },
  categoryTabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.3rem',
    padding: '0.25rem',
    borderRadius: 12,
    border: '1px solid #fce7f3',
    background: '#fff',
  },
  categoryTab: {
    flex: '1 1 auto',
    minHeight: 34,
    padding: '0.25rem 0.45rem',
    borderRadius: 9,
    border: '1px solid transparent',
    background: 'transparent',
    color: '#6b7280',
    fontWeight: 700,
    fontSize: '0.65rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  categoryTabOn: {
    flex: '1 1 auto',
    minHeight: 34,
    padding: '0.25rem 0.45rem',
    borderRadius: 9,
    border: '1px solid #f9a8d4',
    background: '#fdf2f8',
    color: '#831843',
    fontWeight: 800,
    fontSize: '0.65rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 6px rgba(190, 24, 93, 0.08)',
  },
  tabBadge: {
    marginLeft: '0.2rem',
    padding: '0 0.3rem',
    borderRadius: 999,
    background: '#fce7f3',
    color: '#9d174d',
    fontSize: '0.58rem',
    fontWeight: 800,
  },
  rateGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(8rem, 1fr) 4.5rem 3.5rem 5rem',
    gap: '0.3rem 0.4rem',
    alignItems: 'center',
  },
  colHead: { fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9ca3af' },
  serviceLabel: { fontSize: '0.72rem', fontWeight: 700, color: '#111827' },
  price: {
    minHeight: 34,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '0 0.35rem',
    fontWeight: 700,
    fontSize: '0.75rem',
    width: '100%',
  },
  visibleBtn: {
    minHeight: 34,
    borderRadius: 8,
    border: '1px solid #86efac',
    background: '#ecfdf5',
    color: '#166534',
    fontWeight: 800,
    fontSize: '0.65rem',
    cursor: 'pointer',
  },
  hiddenBtn: {
    minHeight: 34,
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#f3f4f6',
    color: '#6b7280',
    fontWeight: 800,
    fontSize: '0.65rem',
    cursor: 'pointer',
  },
  customBlock: { display: 'grid', gap: '0.35rem' },
  customEmpty: { margin: 0, fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600 },
  customTitle: { margin: 0, fontSize: '0.78rem', fontWeight: 800, color: '#374151' },
  customSub: { margin: 0, fontSize: '0.62rem', color: '#6b7280', fontWeight: 600 },
  customRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' },
  customName: {
    flex: '1 1 8rem',
    minHeight: 34,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '0 0.4rem',
    fontWeight: 700,
    fontSize: '0.75rem',
  },
  removeBtn: {
    minHeight: 34,
    minWidth: 34,
    borderRadius: 8,
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#b91c1c',
    fontWeight: 900,
    fontSize: '1rem',
    lineHeight: 1,
  },
  chip: {
    alignSelf: 'flex-start',
    minHeight: 34,
    padding: '0 0.65rem',
    borderRadius: 999,
    border: '1px dashed #d1d5db',
    background: '#fff',
    fontWeight: 700,
    fontSize: '0.68rem',
    color: '#374151',
  },
  actions: { display: 'flex', justifyContent: 'flex-end' },
  primary: {
    minHeight: 38,
    padding: '0 0.85rem',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.72rem',
    boxShadow: '0 4px 12px rgba(190, 24, 93, 0.25)',
  },
};
