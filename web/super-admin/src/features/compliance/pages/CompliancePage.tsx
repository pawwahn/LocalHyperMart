import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { Banner, Button, Card } from '@/shared/ui';
import { getPlatformSettings, type PlatformSettingsVm } from '@/features/settings/api/settingsApi';

const OPS_STORAGE_KEY = 'hlm.compliance.ops.v1';

type OpsChecks = {
  dpasFiled: boolean;
  lawyerReviewed: boolean;
  breachRunbookRead: boolean;
  penTestScheduled: boolean;
};

const DEFAULT_OPS: OpsChecks = {
  dpasFiled: false,
  lawyerReviewed: false,
  breachRunbookRead: false,
  penTestScheduled: false,
};

type CheckRow = {
  id: string;
  label: string;
  ok: boolean;
  hint: string;
  fixTo?: string;
};

function loadOps(): OpsChecks {
  try {
    const raw = localStorage.getItem(OPS_STORAGE_KEY);
    if (!raw) return DEFAULT_OPS;
    return { ...DEFAULT_OPS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_OPS;
  }
}

function saveOps(next: OpsChecks) {
  localStorage.setItem(OPS_STORAGE_KEY, JSON.stringify(next));
}

function phoneOk(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\D/g, '').slice(-10));
}

function buildProductChecks(s: PlatformSettingsVm | null): CheckRow[] {
  if (!s) {
    return [{ id: 'load', label: 'Platform settings loaded', ok: false, hint: 'Could not load settings' }];
  }
  return [
    {
      id: 'legalName',
      label: 'Supplier legal name',
      ok: Boolean(s.supplierLegalName?.trim()) && s.supplierLegalName.trim().length >= 3,
      hint: 'Settings → Billing identity',
      fixTo: '/settings',
    },
    {
      id: 'support',
      label: 'Buyer support phone',
      ok: phoneOk(s.supportPhone ?? ''),
      hint: 'Shown on login and legal screens',
      fixTo: '/settings',
    },
    {
      id: 'grievance',
      label: 'Grievance officer',
      ok: Boolean(s.grievanceOfficer?.trim()) && s.grievanceOfficer.trim().length >= 3,
      hint: 'DPDP grievance contact',
      fixTo: '/settings',
    },
    {
      id: 'terms',
      label: 'Terms text published',
      ok: (s.termsText?.length ?? 0) >= 400,
      hint: `${(s.termsText?.length ?? 0).toLocaleString('en-IN')} chars · v${s.legalVersion}`,
      fixTo: '/settings',
    },
    {
      id: 'privacy',
      label: 'Privacy text published',
      ok: (s.privacyText?.length ?? 0) >= 400,
      hint: `${(s.privacyText?.length ?? 0).toLocaleString('en-IN')} chars`,
      fixTo: '/settings',
    },
    {
      id: 'refund',
      label: 'Refund policy published',
      ok: (s.refundText?.length ?? 0) >= 200,
      hint: `${(s.refundText?.length ?? 0).toLocaleString('en-IN')} chars`,
      fixTo: '/settings',
    },
    {
      id: 'version',
      label: 'Legal version tracked',
      ok: (s.legalVersion ?? 0) >= 1 && Boolean(s.legalUpdatedAt),
      hint: s.legalUpdatedAt ? `Updated ${s.legalUpdatedAt}` : 'Set legal copy once',
      fixTo: '/settings',
    },
  ];
}

export function CompliancePage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [settings, setSettings] = useState<PlatformSettingsVm | null>(null);
  const [ops, setOps] = useState<OpsChecks>(() => loadOps());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setSettings(await getPlatformSettings(token));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load settings');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const productChecks = useMemo(() => buildProductChecks(settings), [settings]);
  const productOk = productChecks.every((c) => c.ok);
  const opsOk =
    ops.lawyerReviewed && ops.dpasFiled && ops.breachRunbookRead && ops.penTestScheduled;

  function toggleOps(key: keyof OpsChecks) {
    const next = { ...ops, [key]: !ops[key] };
    setOps(next);
    saveOps(next);
  }

  return (
    <PortalShell title="Compliance" subtitle="Launch readiness for legal, privacy, and ops" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading ? <p style={styles.muted}>Loading…</p> : null}

      <div style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <span style={styles.summaryLabel}>In-app legal</span>
          <strong style={productOk ? styles.ok : styles.warn}>{productOk ? 'Ready' : 'Needs work'}</strong>
        </Card>
        <Card style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Ops checklist</span>
          <strong style={opsOk ? styles.ok : styles.warn}>{opsOk ? 'Complete' : 'In progress'}</strong>
        </Card>
      </div>

      <Card style={styles.section}>
        <div style={styles.sectionHead}>
          <h2 style={styles.h2}>Product (Super Admin)</h2>
          <Link to="/settings" style={styles.link}>
            Open Settings
          </Link>
        </div>
        <ul style={styles.list}>
          {productChecks.map((row) => (
            <li key={row.id} style={styles.row}>
              <span style={row.ok ? styles.dotOk : styles.dotBad} aria-hidden />
              <span style={styles.rowBody}>
                <strong>{row.label}</strong>
                <span style={styles.hint}>{row.hint}</span>
              </span>
              {row.fixTo && !row.ok ? (
                <Link to={row.fixTo} style={styles.fix}>
                  Fix
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card style={styles.section}>
        <h2 style={styles.h2}>Ops & contracts (local tracker)</h2>
        <p style={styles.muted}>
          Tick when done. Stored in this browser only. Full matrix:{' '}
          <code style={styles.code}>docs/09_LEGAL_COMPLIANCE_MATRIX.md</code>
        </p>
        <ul style={styles.list}>
          <li style={styles.row}>
            <label style={styles.opsLabel}>
              <input
                type="checkbox"
                checked={ops.lawyerReviewed}
                onChange={() => toggleOps('lawyerReviewed')}
              />
              <span>
                <strong>Counsel reviewed published policies</strong>
                <span style={styles.hint}>Before public launch</span>
              </span>
            </label>
          </li>
          <li style={styles.row}>
            <label style={styles.opsLabel}>
              <input type="checkbox" checked={ops.dpasFiled} onChange={() => toggleOps('dpasFiled')} />
              <span>
                <strong>Processor agreements filed (AWS, Razorpay, SMS…)</strong>
                <span style={styles.hint}>docs/legal/PROCESSORS_AND_DPAs.md</span>
              </span>
            </label>
          </li>
          <li style={styles.row}>
            <label style={styles.opsLabel}>
              <input
                type="checkbox"
                checked={ops.breachRunbookRead}
                onChange={() => toggleOps('breachRunbookRead')}
              />
              <span>
                <strong>Breach runbook read with on-call</strong>
                <span style={styles.hint}>docs/legal/INCIDENT_AND_BREACH_RUNBOOK.md</span>
              </span>
            </label>
          </li>
          <li style={styles.row}>
            <label style={styles.opsLabel}>
              <input
                type="checkbox"
                checked={ops.penTestScheduled}
                onChange={() => toggleOps('penTestScheduled')}
              />
              <span>
                <strong>Pen test scheduled before public scale</strong>
                <span style={styles.hint}>06_SECURITY_REQUIREMENTS.md</span>
              </span>
            </label>
          </li>
        </ul>
      </Card>

      <Card style={styles.section}>
        <h2 style={styles.h2}>Quick links</h2>
        <div style={styles.links}>
          <Link to="/legal/privacy" style={styles.link}>
            Preview Privacy
          </Link>
          <Link to="/legal/terms" style={styles.link}>
            Preview Terms
          </Link>
          <Link to="/legal/oss" style={styles.link}>
            Open source notices
          </Link>
          <Link to="/vendors" style={styles.link}>
            Vendors (terms attestation on add)
          </Link>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void reload()}>
          Refresh status
        </Button>
      </Card>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  muted: { margin: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' },
  summaryCard: { display: 'grid', gap: '0.2rem', padding: '0.75rem' },
  summaryLabel: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' },
  ok: { fontSize: '1.1rem', color: 'var(--accent)' },
  warn: { fontSize: '1.1rem', color: 'var(--danger, #b91c1c)' },
  section: { display: 'grid', gap: '0.55rem' },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' },
  h2: { margin: 0, fontSize: '1rem', fontWeight: 800 },
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' },
  row: { display: 'flex', alignItems: 'flex-start', gap: '0.5rem' },
  rowBody: { display: 'grid', gap: '0.1rem', flex: 1 },
  hint: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' },
  dotOk: { width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', marginTop: 4 },
  dotBad: { width: 10, height: 10, borderRadius: '50%', background: 'var(--danger, #b91c1c)', marginTop: 4 },
  fix: { fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent)', flexShrink: 0 },
  link: { fontWeight: 800, color: 'var(--accent)', fontSize: '0.85rem' },
  links: { display: 'flex', flexWrap: 'wrap', gap: '0.65rem' },
  code: { fontSize: '0.78rem' },
  opsLabel: { display: 'flex', gap: '0.5rem', alignItems: 'flex-start', cursor: 'pointer', flex: 1 },
};
