import { useEffect, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { Button, TextField } from '@/shared/ui';
import { getTown, updateTownCoverage, type TownVm } from '../api/townsApi';

type Props = {
  town: TownVm;
  token: string;
  onClose: () => void;
  onSaved: (message: string) => void;
};

function parseCoord(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function TownAreaDialog({ town, token, onClose, onSaved }: Props) {
  const [radius, setRadius] = useState('10');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [pincodes, setPincodes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getTown(token, town.id)
      .then((detail) => {
        if (cancelled) return;
        setRadius(String(detail.coverageRadiusKm ?? 10));
        setLatitude(detail.latitude == null ? '' : String(detail.latitude));
        setLongitude(detail.longitude == null ? '' : String(detail.longitude));
        setPincodes((detail.pincodes ?? []).join(', '));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load the town');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, town.id]);

  async function save() {
    const pins = pincodes
      .split(',')
      .map((pin) => pin.trim())
      .filter(Boolean);
    const lat = parseCoord(latitude);
    const lng = parseCoord(longitude);
    if (!pins.length) {
      setError('Add at least one pincode');
      return;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('Latitude and longitude must be numbers');
      return;
    }
    if ((lat == null) !== (lng == null)) {
      setError('Set both latitude and longitude, or leave both empty');
      return;
    }
    const km = Number(radius);
    if (!Number.isFinite(km) || km < 0.5 || km > 100) {
      setError('Coverage must be between 0.5 and 100 km');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateTownCoverage(token, town.id, {
        coverageRadiusKm: km,
        pincodes: pins,
        latitude: lat,
        longitude: lng,
      });
      onSaved(`${town.displayName} delivery area saved`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.backdrop} role="presentation" onClick={() => { if (!busy) onClose(); }}>
      <div
        style={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="town-area-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <h2 id="town-area-title" style={styles.title}>Delivery area</h2>
          <button type="button" style={styles.close} disabled={busy} onClick={onClose}>
            Close
          </button>
        </div>
        <p style={styles.sub}>
          {town.displayName}. GPS suggests this town inside the radius. Orders are allowed only for these pincodes.
        </p>
        {error ? <p style={styles.error}>{error}</p> : null}
        {loading ? <p style={styles.sub}>Loading…</p> : null}
        <div style={styles.row}>
          <TextField
            label="Latitude"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            inputMode="decimal"
            placeholder="15.823"
            disabled={loading || busy}
          />
          <TextField
            label="Longitude"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            inputMode="decimal"
            placeholder="80.352"
            disabled={loading || busy}
          />
          <TextField
            label="Radius km"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            inputMode="decimal"
            disabled={loading || busy}
          />
        </div>
        <TextField
          label="Pincodes"
          value={pincodes}
          onChange={(e) => setPincodes(e.target.value)}
          placeholder="523155, 523187"
          disabled={loading || busy}
        />
        <div style={styles.actions}>
          <Button disabled={loading || busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save area'}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(16, 24, 40, 0.42)',
    zIndex: 80,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
  },
  sheet: {
    width: 'min(440px, 100%)',
    background: 'var(--bg-elevated, #fff)',
    borderRadius: 12,
    border: '1px solid var(--border)',
    padding: '0.7rem 0.75rem',
    display: 'grid',
    gap: '0.45rem',
    boxShadow: '0 16px 40px rgba(16, 24, 40, 0.18)',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' },
  title: { margin: 0, fontSize: '1rem', fontWeight: 800 },
  close: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 44,
  },
  sub: { margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.35 },
  error: { margin: 0, color: '#b91c1c', fontSize: '0.78rem' },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 110px), 1fr))',
    gap: '0.4rem',
  },
  actions: { display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' },
};
