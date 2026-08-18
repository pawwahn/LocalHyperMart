import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { Banner, Button, EmptyState } from '@/shared/ui';
import { AddressForm } from '../components/AddressForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useShop } from '../hooks/useShop';

export function AddressesPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const {
    addresses,
    cart,
    townLabel,
    hasTown,
    openTownPicker,
    selectedAddressId,
    setSelectedAddressId,
    busy,
    error,
    notice,
    doCreateAddress,
    doUpdateAddress,
    doDeleteAddress,
  } = useShop();
  const [editingId, setEditingId] = useState<string | null | 'new'>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteTarget = addresses.find((a) => a.id === deleteId);
  const editing = editingId && editingId !== 'new' ? addresses.find((a) => a.id === editingId) : null;

  return (
    <PortalShell
      title="Saved addresses"
      subtitle={hasTown ? townLabel : 'Choose a town first'}
      showDeliveryBanner={false}
      cartCount={cart?.itemCount ?? 0}
      cartTotalLabel={cart?.payableLabel}
    >
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete this address?"
        description={
          deleteTarget
            ? `${deleteTarget.label || 'Address'} · ${deleteTarget.line1} will be removed.`
            : 'This address will be removed.'
        }
        confirmLabel="Delete"
        cancelLabel="Keep"
        danger
        busy={busy}
        onConfirm={() => {
          if (!deleteId) return;
          const id = deleteId;
          void (async () => {
            const ok = await doDeleteAddress(id);
            if (ok) setDeleteId(null);
          })();
        }}
        onClose={() => {
          if (!busy) setDeleteId(null);
        }}
      />

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      {editingId ? (
        <AddressForm
          key={editingId}
          phone={session?.phone ?? ''}
          busy={busy}
          mode={editing ? 'edit' : 'create'}
          error={error}
          initial={
            editing
              ? {
                  label: editing.label ?? 'Home',
                  recipientName: editing.recipientName,
                  recipientPhone: editing.recipientPhone,
                  line1: editing.line1,
                  line2: editing.line2 ?? '',
                  landmark: editing.landmark ?? '',
                  pincode: editing.pincode ?? '',
                }
              : undefined
          }
          onCancel={() => setEditingId(null)}
          onSubmit={async (values) => {
            if (!hasTown) {
              openTownPicker();
              return;
            }
            const ok =
              editingId === 'new'
                ? await doCreateAddress(values)
                : await doUpdateAddress(editingId, values);
            if (ok) setEditingId(null);
          }}
        />
      ) : addresses.length === 0 ? (
        <EmptyState
          icon="📍"
          title="No saved addresses"
          description={`Add a delivery address for ${hasTown ? townLabel : 'your town'}.`}
          actionLabel={hasTown ? 'Add address' : 'Choose town'}
          onAction={() => {
            if (!hasTown) {
              openTownPicker();
              return;
            }
            setEditingId('new');
          }}
        />
      ) : (
        <div style={styles.list}>
          {addresses.map((a) => {
            const selected = a.id === selectedAddressId;
            return (
              <div key={a.id} style={selected ? styles.cardActive : styles.card}>
                <button type="button" style={styles.pick} onClick={() => setSelectedAddressId(a.id)}>
                  <strong>{a.label || 'Address'}</strong>
                  <span style={styles.meta}>
                    {a.recipientName} · {a.recipientPhone}
                  </span>
                  <span style={styles.meta}>
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ''}
                    {a.pincode ? `, ${a.pincode}` : ''}
                  </span>
                  {selected ? <span style={styles.using}>Using for orders</span> : null}
                </button>
                <div style={styles.actions}>
                  <button type="button" style={styles.linkBtn} disabled={busy} onClick={() => setEditingId(a.id)}>
                    Edit
                  </button>
                  <button type="button" style={styles.dangerBtn} disabled={busy} onClick={() => setDeleteId(a.id)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
          <Button
            variant="ghost"
            fullWidth
            disabled={busy}
            onClick={() => {
              if (!hasTown) {
                openTownPicker();
                return;
              }
              setEditingId('new');
            }}
          >
            Add another address
          </Button>
          <Button variant="ghost" fullWidth onClick={() => navigate('/cart')}>
            Back to basket
          </Button>
        </div>
      )}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  list: { display: 'grid', gap: '0.45rem' },
  card: {
    display: 'flex',
    gap: '0.45rem',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '0.55rem 0.65rem',
  },
  cardActive: {
    display: 'flex',
    gap: '0.45rem',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent)',
    borderRadius: 12,
    padding: '0.55rem 0.65rem',
  },
  pick: {
    flex: 1,
    minWidth: 0,
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.12rem',
    color: 'var(--text)',
    padding: 0,
  },
  meta: { fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.3 },
  using: { fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent)' },
  actions: { display: 'flex', gap: '0.25rem', flexShrink: 0 },
  linkBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.75rem',
    cursor: 'pointer',
    minHeight: 36,
    padding: '0.25rem 0.4rem',
  },
  dangerBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--danger)',
    fontWeight: 800,
    fontSize: '0.75rem',
    cursor: 'pointer',
    minHeight: 36,
    padding: '0.25rem 0.4rem',
  },
};
