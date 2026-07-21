import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import {
  approveRegistration,
  createRegistrationRequest,
  listRegistrationRequests,
  listVendors,
  rejectRegistration,
  type VendorRegistrationVm,
  type VendorVm,
} from '../api/vendorsApi';

const PILOT_TOWN = 'a1111111-1111-4111-8111-111111111111';

export function VendorsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState(PILOT_TOWN);
  const [requests, setRequests] = useState<VendorRegistrationVm[]>([]);
  const [vendors, setVendors] = useState<VendorVm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [t, pending, active] = await Promise.all([
        listTowns(token),
        listRegistrationRequests(token, 'PENDING'),
        listVendors(token, townId),
      ]);
      setTowns(t);
      setRequests(pending);
      setVendors(active);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load vendors');
    }
  }, [token, townId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSubmitRequest() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await createRegistrationRequest(token, {
        townId,
        businessName: businessName.trim(),
        ownerName: ownerName.trim() || undefined,
        phone: phone.trim(),
        shopName: shopName.trim(),
        address: address.trim() || undefined,
      });
      setNotice('Registration request submitted');
      setBusinessName('');
      setOwnerName('');
      setPhone('');
      setShopName('');
      setAddress('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  async function onApprove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await approveRegistration(token, id);
      setNotice('Vendor approved');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  }

  async function onReject(id: string) {
    const reason = window.prompt('Reject reason') ?? '';
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await rejectRegistration(token, id, reason.trim());
      setNotice('Request rejected');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Vendors" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card>
        <label style={styles.label}>
          Town
          <select
            style={styles.select}
            value={townId}
            onChange={(e) => setTownId(e.target.value)}
          >
            {towns.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayName}
              </option>
            ))}
            {towns.length === 0 ? <option value={PILOT_TOWN}>Pilot Narsaraopet</option> : null}
          </select>
        </label>
      </Card>

      <Card>
        <h2 style={styles.sectionTitle}>Submit registration (hub / SA)</h2>
        <div style={styles.formGrid}>
          <TextField label="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <TextField label="Shop name" value={shopName} onChange={(e) => setShopName(e.target.value)} />
          <TextField label="Owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" />
          <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <Button
          disabled={busy || !businessName.trim() || !shopName.trim() || !phone.trim()}
          onClick={() => void onSubmitRequest()}
        >
          Submit request
        </Button>
      </Card>

      <Card>
        <h2 style={styles.sectionTitle}>Pending approvals</h2>
        <div style={styles.list}>
          {requests.length === 0 ? (
            <p style={styles.muted}>No pending requests.</p>
          ) : (
            requests.map((req) => (
              <div key={req.id} style={styles.row}>
                <div>
                  <strong>{req.shopName}</strong>
                  <p style={styles.muted}>
                    {req.businessName} · {req.phone} · {req.status}
                  </p>
                </div>
                <div style={styles.actions}>
                  <Button size="sm" disabled={busy} onClick={() => void onApprove(req.id)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => void onReject(req.id)}>
                    Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <h2 style={styles.sectionTitle}>Active vendors in town</h2>
        <div style={styles.list}>
          {vendors.length === 0 ? (
            <p style={styles.muted}>No vendors listed.</p>
          ) : (
            vendors.map((v) => (
              <div key={v.id} style={styles.row}>
                <div>
                  <strong>{v.shopName ?? v.businessName}</strong>
                  <p style={styles.muted}>
                    {v.phone} · {v.status}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  sectionTitle: { margin: '0 0 0.85rem', fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800 },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.75rem',
    marginBottom: '0.85rem',
  },
  list: { display: 'grid', gap: '0.65rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'center',
    padding: '0.65rem 0',
    borderBottom: '1px solid var(--border)',
  },
  actions: { display: 'flex', gap: '0.4rem' },
  muted: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' },
  label: { display: 'grid', gap: '0.35rem', fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 },
  select: {
    padding: '0.75rem 0.95rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
};
