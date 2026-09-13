import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, TextField } from '@/shared/ui';
import { AdminHistoryPanel, LastChangeStrip } from '@/shared/audit/AdminHistoryPanel';
import {
  GOVT_ID_OPTIONS,
  updateHub,
  type AdminHubVm,
  type GovtIdType,
} from '../api/hubsApi';

type Props = {
  hub: AdminHubVm;
  townLabel: string;
  token: string;
  onClose: () => void;
  onSaved: (hub: AdminHubVm, message: string) => void;
};

export function HubDetailDialog({ hub, townLabel, token, onClose, onSaved }: Props) {
  const [panel, setPanel] = useState<'edit' | 'log'>('edit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [name, setName] = useState(hub.name);
  const [address, setAddress] = useState(hub.address ?? '');
  const [phone, setPhone] = useState(hub.phone);
  const [status, setStatus] = useState<'ACTIVE' | 'DISABLED'>(hub.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE');
  const [govtIdType, setGovtIdType] = useState<GovtIdType>(
    (GOVT_ID_OPTIONS.some((o) => o.value === hub.govtIdType) ? hub.govtIdType : 'AADHAAR') as GovtIdType,
  );
  const [govtIdNumber, setGovtIdNumber] = useState(hub.govtIdNumber ?? '');
  const [reference1Name, setReference1Name] = useState(hub.reference1Name ?? '');
  const [reference1Phone, setReference1Phone] = useState(hub.reference1Phone ?? '');
  const [reference2Name, setReference2Name] = useState(hub.reference2Name ?? '');
  const [reference2Phone, setReference2Phone] = useState(hub.reference2Phone ?? '');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [busy, onClose]);

  async function onSave() {
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError('Enter a valid 10-digit hub phone');
      return;
    }
    const r1 = reference1Phone.trim();
    const r2 = reference2Phone.trim();
    if (!/^[6-9]\d{9}$/.test(r1) || !/^[6-9]\d{9}$/.test(r2)) {
      setError('Enter valid 10-digit reference phones');
      return;
    }
    if (r1 === r2 || r1 === phone.trim() || r2 === phone.trim()) {
      setError('Reference phones must differ from each other and the hub phone');
      return;
    }
    if (!reference1Name.trim() || !reference2Name.trim()) {
      setError('Both references need a name');
      return;
    }
    const idRaw = govtIdNumber.replace(/\s/g, '').trim();
    const replacingId = idRaw.length > 0 && !idRaw.includes('*');
    if (replacingId && govtIdType === 'AADHAAR' && !/^\d{12}$/.test(idRaw)) {
      setError('Aadhaar number must be 12 digits');
      return;
    }
    if (replacingId && idRaw.length < 4) {
      setError('Enter government ID number');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await updateHub(token, hub.hubId, {
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim(),
        status,
        govtIdType,
        govtIdNumber: replacingId ? idRaw : undefined,
        reference1Name: reference1Name.trim(),
        reference1Phone: r1,
        reference2Name: reference2Name.trim(),
        reference2Phone: r2,
      });
      setGovtIdNumber(saved.govtIdNumber ?? '');
      setSavedNotice('Saved and logged.');
      setHistoryTick((n) => n + 1);
      setPanel('log');
      onSaved(saved, `Hub updated · ${saved.name}`);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      style={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hub-detail-title"
        style={styles.dialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <style>{`@media (max-width: 640px) { .hub-edit-grid { grid-template-columns: 1fr !important; } }`}</style>
        <div style={styles.head}>
          <div>
            <h2 id="hub-detail-title" style={styles.title}>
              {hub.name}
            </h2>
            <p style={styles.sub}>{townLabel}</p>
          </div>
          <div style={styles.headRight}>
            <div style={styles.viewTabs} role="tablist" aria-label="Edit or change log">
              <button
                type="button"
                role="tab"
                aria-selected={panel === 'edit'}
                style={panel === 'edit' ? styles.viewTabActive : styles.viewTab}
                onClick={() => setPanel('edit')}
              >
                Edit
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panel === 'log'}
                style={panel === 'log' ? styles.viewTabActive : styles.viewTab}
                onClick={() => setPanel('log')}
              >
                Change log
              </button>
            </div>
            <button type="button" style={styles.close} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        {error ? <Banner tone="danger">{error}</Banner> : null}
        {savedNotice ? <Banner tone="success">{savedNotice}</Banner> : null}

        {panel === 'edit' ? (
          <>
            {token ? (
              <LastChangeStrip
                token={token}
                screen="hubs"
                townId={hub.townId}
                refreshTick={historyTick}
                onSeeAll={() => setPanel('log')}
              />
            ) : null}
            <div style={styles.body}>
              <div className="hub-edit-grid" style={styles.grid}>
                <TextField label="Hub name" value={name} onChange={(e) => setName(e.target.value)} />
                <TextField
                  label="Hub phone"
                  value={phone}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
                <div style={styles.span2}>
                  <TextField
                    label="Address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <label style={styles.field}>
                  Hub status
                  <select
                    style={styles.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'DISABLED')}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </label>
                <TextField label="Admin login" value={hub.adminPhone ?? hub.phone} disabled />
              </div>

              <p style={styles.section}>Government proof</p>
              <div className="hub-edit-grid" style={styles.grid}>
                <label style={styles.field}>
                  ID type
                  <select
                    style={styles.select}
                    value={govtIdType}
                    onChange={(e) => setGovtIdType(e.target.value as GovtIdType)}
                  >
                    {GOVT_ID_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <TextField
                  label={govtIdType === 'AADHAAR' ? 'ID number (type new 12 digits to replace)' : 'ID number (type new to replace)'}
                  value={govtIdNumber}
                  onChange={(e) => setGovtIdNumber(e.target.value)}
                  placeholder={hub.govtIdNumber || 'Stored ID'}
                />
              </div>

              <p style={styles.section}>Reference 1</p>
              <div className="hub-edit-grid" style={styles.grid}>
                <TextField label="Name" value={reference1Name} onChange={(e) => setReference1Name(e.target.value)} />
                <TextField
                  label="Phone"
                  value={reference1Phone}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) => setReference1Phone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>

              <p style={styles.section}>Reference 2</p>
              <div className="hub-edit-grid" style={styles.grid}>
                <TextField label="Name" value={reference2Name} onChange={(e) => setReference2Name(e.target.value)} />
                <TextField
                  label="Phone"
                  value={reference2Phone}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) => setReference2Phone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>
            </div>
            <div style={styles.footer}>
              <Button variant="ghost" disabled={busy} onClick={onClose}>
                Close
              </Button>
              <Button disabled={busy} onClick={() => void onSave()}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </>
        ) : token ? (
          <div style={styles.log}>
            <AdminHistoryPanel
              token={token}
              screen="hubs"
              townId={hub.townId}
              title="Change log"
              embedded
              tall
              refreshTick={historyTick}
            />
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    background: 'rgba(2, 6, 12, 0.5)',
    display: 'grid',
    placeItems: 'center',
    padding: '0.75rem',
  },
  dialog: {
    width: 'min(720px, 100%)',
    maxHeight: 'min(92vh, 820px)',
    overflow: 'auto',
    background: 'var(--bg-elevated)',
    borderRadius: 16,
    padding: '0.85rem 0.9rem 0.85rem',
    display: 'grid',
    gap: '0.55rem',
    boxShadow: '0 18px 48px rgba(2, 6, 12, 0.28)',
  },
  head: { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' },
  headRight: { display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800 },
  sub: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
  viewTabs: {
    display: 'flex',
    gap: 3,
    padding: 3,
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg)',
  },
  viewTab: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.78rem',
    padding: '0.28rem 0.6rem',
    borderRadius: 6,
    cursor: 'pointer',
  },
  viewTabActive: {
    appearance: 'none',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.78rem',
    padding: '0.28rem 0.6rem',
    borderRadius: 6,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-card)',
  },
  close: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: 'pointer',
  },
  body: { display: 'grid', gap: '0.45rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.4rem 0.55rem',
  },
  span2: { gridColumn: '1 / -1', minWidth: 0 },
  section: {
    margin: '0.2rem 0 0',
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  field: {
    display: 'grid',
    gap: '0.25rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    minWidth: 0,
  },
  select: {
    padding: '0.55rem 0.65rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    font: 'inherit',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    width: '100%',
    boxSizing: 'border-box',
  },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' },
  log: { minHeight: 0 },
};
