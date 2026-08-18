import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import { Button } from '@/shared/ui';
import { AddressForm, type AddressFormValues } from './AddressForm';
import type { AddressDto } from '../api/shopApi';

type Props = {
  open: boolean;
  addresses: AddressDto[];
  selectedId: string;
  townLabel: string;
  hasTown: boolean;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNeedTown: () => void;
  onCreate: (values: AddressFormValues) => Promise<boolean>;
};

function lineFor(a: AddressDto) {
  return [a.line1, a.line2, a.pincode].filter(Boolean).join(', ');
}

export function AddressPickerSheet({
  open,
  addresses,
  selectedId,
  townLabel,
  hasTown,
  busy,
  error,
  onClose,
  onSelect,
  onNeedTown,
  onCreate,
}: Props) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [adding, setAdding] = useState(false);

  if (!open) return null;

  function pick(id: string) {
    onSelect(id);
    setAdding(false);
    onClose();
  }

  return (
    <div
      style={styles.backdrop}
      role="presentation"
      onClick={() => {
        if (!busy) {
          setAdding(false);
          onClose();
        }
      }}
    >
      <div
        style={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="address-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.head}>
          <h2 id="address-picker-title" style={styles.title}>
            {adding ? 'Add address' : 'Deliver to'}
          </h2>
          <button
            type="button"
            style={styles.closeLink}
            disabled={busy}
            onClick={() => {
              if (adding) {
                setAdding(false);
                return;
              }
              onClose();
            }}
          >
            {adding ? 'Back' : 'Close'}
          </button>
        </div>
        <p style={styles.sub}>
          {hasTown ? townLabel : 'Choose a town first'}
        </p>

        {adding ? (
          <AddressForm
            key="picker-new"
            phone={session?.phone ?? ''}
            busy={busy}
            error={error}
            onCancel={() => setAdding(false)}
            onSubmit={async (values) => {
              const ok = await onCreate(values);
              if (ok) {
                setAdding(false);
                onClose();
              }
            }}
          />
        ) : (
          <>
            {addresses.length === 0 ? (
              <p style={styles.muted}>No saved address for this town yet.</p>
            ) : (
              <ul style={styles.list} className="hlm-hide-scrollbar">
                {addresses.map((a) => {
                  const selected = a.id === selectedId;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        style={{
                          ...styles.addrBtn,
                          ...(selected ? styles.addrBtnSelected : null),
                        }}
                        onClick={() => pick(a.id)}
                      >
                        <span style={styles.addrName}>{a.label || 'Address'}</span>
                        <span style={styles.addrMeta}>
                          {a.recipientName} · {lineFor(a)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div style={styles.actions}>
              <Button
                size="sm"
                fullWidth
                disabled={busy}
                onClick={() => {
                  if (!hasTown) {
                    onNeedTown();
                    return;
                  }
                  setAdding(true);
                }}
              >
                Add new address
              </Button>
              <button
                type="button"
                style={styles.manageLink}
                onClick={() => {
                  onClose();
                  navigate('/addresses');
                }}
              >
                Manage saved addresses
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.4)',
    zIndex: 80,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
  },
  sheet: {
    width: 'min(400px, 100%)',
    background: 'var(--bg-elevated)',
    borderRadius: 16,
    border: '1px solid var(--border)',
    padding: '0.85rem 0.9rem 0.95rem',
    display: 'grid',
    gap: '0.45rem',
    boxShadow: 'var(--shadow-elevated)',
    maxHeight: 'min(78vh, 560px)',
    overflow: 'auto',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  closeLink: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 700,
    fontSize: '0.82rem',
    cursor: 'pointer',
    padding: '0.15rem 0.25rem',
  },
  sub: { margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.3 },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: '0.28rem',
  },
  addrBtn: {
    width: '100%',
    textAlign: 'left',
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--bg)',
    padding: '0.5rem 0.65rem',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.12rem',
    minHeight: 44,
  },
  addrBtnSelected: {
    borderColor: 'var(--accent)',
    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-elevated))',
  },
  addrName: {
    fontWeight: 800,
    color: 'var(--text)',
    fontSize: '0.88rem',
  },
  addrMeta: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' },
  actions: { display: 'grid', gap: '0.35rem' },
  manageLink: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '0.25rem',
  },
};
