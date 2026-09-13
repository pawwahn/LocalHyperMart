import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, ConfirmDialog, TextField } from '@/shared/ui';
import { AdminHistoryPanel } from '@/shared/audit/AdminHistoryPanel';
import {
  cancelMembershipCash,
  confirmMembershipCash,
  fetchMembershipMembers,
  fetchMembershipPackHistory,
  fetchMembershipPurchases,
  fetchMembershipReport,
  fetchPendingCash,
  getMembershipSettings,
  giftMembership,
  saveMembershipSettings,
  type MembershipMember,
  type MembershipPackRevision,
  type MembershipPurchase,
  type MembershipReport,
  type MembershipSettings,
  type MembershipSlabCode,
} from '../api/membershipsApi';

function isoIst(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function money(n?: number | null): string {
  return `₹${Number(n ?? 0).toFixed(2)}`;
}

function slabLabel(slab: MembershipSlabCode): string {
  if (slab === 'HALF_YEAR') return '6 months';
  if (slab === 'ANNUAL') return 'Annual';
  return '3 months';
}

function when(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function whenFull(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function packsEqual(a: MembershipSettings, b: MembershipSettings): boolean {
  return (
    a.membershipEnabled === b.membershipEnabled &&
    a.membershipQuarterlyPrice === b.membershipQuarterlyPrice &&
    a.membershipQuarterlyCredits === b.membershipQuarterlyCredits &&
    a.membershipHalfYearPrice === b.membershipHalfYearPrice &&
    a.membershipHalfYearCredits === b.membershipHalfYearCredits &&
    a.membershipAnnualPrice === b.membershipAnnualPrice &&
    a.membershipAnnualCredits === b.membershipAnnualCredits
  );
}

function packChangeLines(from: MembershipSettings, to: MembershipSettings): string[] {
  const lines: string[] = [];
  if (from.membershipEnabled !== to.membershipEnabled) {
    lines.push(to.membershipEnabled ? 'Selling: off → on' : 'Selling: on → off');
  }
  const slabs: Array<[string, number, number, number, number]> = [
    [
      '3 months',
      from.membershipQuarterlyPrice,
      to.membershipQuarterlyPrice,
      from.membershipQuarterlyCredits,
      to.membershipQuarterlyCredits,
    ],
    [
      '6 months',
      from.membershipHalfYearPrice,
      to.membershipHalfYearPrice,
      from.membershipHalfYearCredits,
      to.membershipHalfYearCredits,
    ],
    [
      'Annual',
      from.membershipAnnualPrice,
      to.membershipAnnualPrice,
      from.membershipAnnualCredits,
      to.membershipAnnualCredits,
    ],
  ];
  for (const [label, fp, tp, fc, tc] of slabs) {
    if (fp !== tp) lines.push(`${label} price ₹${fp} → ₹${tp}`);
    if (fc !== tc) lines.push(`${label} deliveries ${fc} → ${tc}`);
  }
  return lines;
}

const EMPTY: MembershipSettings = {
  membershipEnabled: false,
  membershipQuarterlyPrice: 0,
  membershipQuarterlyCredits: 0,
  membershipHalfYearPrice: 0,
  membershipHalfYearCredits: 0,
  membershipAnnualPrice: 0,
  membershipAnnualCredits: 0,
};

export function MembershipsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const to = isoIst();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 29);
  const [from, setFrom] = useState(isoIst(fromDate));
  const [toDate, setToDate] = useState(to);
  const [settings, setSettings] = useState<MembershipSettings>(EMPTY);
  const [savedSettings, setSavedSettings] = useState<MembershipSettings>(EMPTY);
  const [history, setHistory] = useState<MembershipPackRevision[]>([]);
  const [report, setReport] = useState<MembershipReport | null>(null);
  const [members, setMembers] = useState<MembershipMember[]>([]);
  const [purchases, setPurchases] = useState<MembershipPurchase[]>([]);
  const [pending, setPending] = useState<MembershipPurchase[]>([]);
  const [giftPhone, setGiftPhone] = useState('');
  const [giftSlab, setGiftSlab] = useState<MembershipSlabCode>('QUARTERLY');
  const [confirm, setConfirm] = useState<
    | { kind: 'save' }
    | { kind: 'gift' }
    | { kind: 'cash'; action: 'confirm' | 'cancel'; purchaseId: string; phone: string }
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const giftCredits =
    giftSlab === 'ANNUAL'
      ? settings.membershipAnnualCredits
      : giftSlab === 'HALF_YEAR'
        ? settings.membershipHalfYearCredits
        : settings.membershipQuarterlyCredits;

  const reload = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [cfg, hist, rep, mem, buys, cash] = await Promise.all([
        getMembershipSettings(token),
        fetchMembershipPackHistory(token).catch(() => [] as MembershipPackRevision[]),
        fetchMembershipReport(token, { from, to: toDate }),
        fetchMembershipMembers(token),
        fetchMembershipPurchases(token),
        fetchPendingCash(token),
      ]);
      setSettings(cfg);
      setSavedSettings(cfg);
      setHistory(hist);
      setReport(rep);
      setMembers(mem);
      setPurchases(buys);
      setPending(cash);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load memberships');
    }
  }, [token, from, toDate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function askSaveConfirm() {
    setError(null);
    setNotice(null);
    if (packsEqual(settings, savedSettings)) {
      setError('No pack changes to save');
      return;
    }
    setConfirm({ kind: 'save' });
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await saveMembershipSettings(token, settings);
      setSettings(next);
      setSavedSettings(next);
      setNotice('Packs saved. Buyers already subscribed keep their old snapshot.');
      setConfirm(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Save failed');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  function askGiftConfirm() {
    const phone = giftPhone.trim();
    setError(null);
    setNotice(null);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit buyer mobile before gifting');
      return;
    }
    if (giftCredits <= 0) {
      setError('Set free deliveries on this slab before gifting');
      return;
    }
    setConfirm({ kind: 'gift' });
  }

  async function onGift() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const row = await giftMembership(token, { phone: giftPhone.trim(), slab: giftSlab });
      setNotice(`Gifted ${row.creditsGranted} deliveries to ${row.buyerPhone}`);
      setGiftPhone('');
      setConfirm(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Gift failed');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm(purchaseId: string) {
    setBusy(true);
    setError(null);
    try {
      await confirmMembershipCash(token, { purchaseId });
      setNotice('Cash confirmed. Credits added.');
      setConfirm(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Confirm failed');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  async function onCancelCash(purchaseId: string) {
    setBusy(true);
    setError(null);
    try {
      await cancelMembershipCash(token, purchaseId);
      setNotice('Cash request cancelled.');
      setConfirm(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Cancel failed');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  function closeConfirm() {
    if (!busy) setConfirm(null);
  }

  const saveLines = confirm?.kind === 'save' ? packChangeLines(savedSettings, settings) : [];
  const confirmCopy =
    confirm?.kind === 'save'
      ? {
          title: 'Save these pack changes?',
          description:
            (saveLines.length ? saveLines.join('. ') + '. ' : '') +
            'New buyers get the new prices. Existing members keep the pack they already bought.',
          confirmLabel: 'Save packs',
          danger: false,
          run: () => void onSave(),
        }
      : confirm?.kind === 'gift'
        ? {
            title: 'Gift this pack?',
            description: `Add the ${slabLabel(giftSlab)} pack (${giftCredits} free deliveries) to ${giftPhone.trim()}? This is free of charge and cannot be undone from this screen.`,
            confirmLabel: 'Gift pack',
            danger: false,
            run: () => void onGift(),
          }
        : confirm?.kind === 'cash' && confirm.action === 'confirm'
          ? {
              title: 'Confirm cash received?',
              description: `Mark cash received for ${confirm.phone} and add membership credits?`,
              confirmLabel: 'Confirm cash',
              danger: false,
              run: () => void onConfirm(confirm.purchaseId),
            }
          : confirm?.kind === 'cash'
            ? {
                title: 'Cancel cash request?',
                description: `Cancel the pending cash pack for ${confirm.phone}? Credits will not be added.`,
                confirmLabel: 'Cancel request',
                danger: true,
                run: () => void onCancelCash(confirm.purchaseId),
              }
            : null;

  return (
    <PortalShell title="Memberships" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card style={styles.card}>
        <div style={styles.row}>
          <strong style={styles.h2}>Platform switch</strong>
          <button
            type="button"
            role="switch"
            aria-checked={settings.membershipEnabled}
            style={settings.membershipEnabled ? styles.switchOn : styles.switchOff}
            onClick={() => setSettings((s) => ({ ...s, membershipEnabled: !s.membershipEnabled }))}
          >
            <span style={settings.membershipEnabled ? styles.knobOn : styles.knobOff} />
          </button>
          <span style={styles.hint}>{settings.membershipEnabled ? 'Selling on' : 'Selling off — members still use leftover credits'}</span>
        </div>
        <div style={styles.slabs}>
          <SlabFields
            label="3 months"
            price={settings.membershipQuarterlyPrice}
            credits={settings.membershipQuarterlyCredits}
            onPrice={(n) => setSettings((s) => ({ ...s, membershipQuarterlyPrice: n }))}
            onCredits={(n) => setSettings((s) => ({ ...s, membershipQuarterlyCredits: n }))}
          />
          <SlabFields
            label="6 months"
            price={settings.membershipHalfYearPrice}
            credits={settings.membershipHalfYearCredits}
            onPrice={(n) => setSettings((s) => ({ ...s, membershipHalfYearPrice: n }))}
            onCredits={(n) => setSettings((s) => ({ ...s, membershipHalfYearCredits: n }))}
          />
          <SlabFields
            label="Annual"
            price={settings.membershipAnnualPrice}
            credits={settings.membershipAnnualCredits}
            onPrice={(n) => setSettings((s) => ({ ...s, membershipAnnualPrice: n }))}
            onCredits={(n) => setSettings((s) => ({ ...s, membershipAnnualCredits: n }))}
          />
        </div>
        <div style={styles.row}>
          <Button size="sm" onClick={askSaveConfirm} disabled={busy}>
            Save packs
          </Button>
          <span style={styles.hint}>Same prices in every town. Towns page can only stop selling.</span>
        </div>
      </Card>

      <Card style={styles.card}>
        <strong style={styles.h2}>Pack history</strong>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Ver</th>
              <th style={styles.th}>When</th>
              <th style={styles.th}>Sell</th>
              <th style={styles.th}>3 mo</th>
              <th style={styles.th}>6 mo</th>
              <th style={styles.th}>Annual</th>
              <th style={styles.th}>What changed</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={7} style={styles.empty}>
                  No confirmed pack saves yet. Save packs after the popup to start the log.
                </td>
              </tr>
            ) : (
              history.map((row) => (
                <tr key={row.id || String(row.versionNo)}>
                  <td style={styles.td}>v{row.versionNo}</td>
                  <td style={styles.td}>{whenFull(row.createdAt)}</td>
                  <td style={styles.td}>{row.sellingEnabled ? 'On' : 'Off'}</td>
                  <td style={styles.td}>
                    {money(row.quarterlyPrice)} / {row.quarterlyCredits}
                  </td>
                  <td style={styles.td}>
                    {money(row.halfYearPrice)} / {row.halfYearCredits}
                  </td>
                  <td style={styles.td}>
                    {money(row.annualPrice)} / {row.annualCredits}
                  </td>
                  <td style={{ ...styles.td, whiteSpace: 'normal' }}>{row.changeSummary || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Card style={styles.card}>
        <div style={styles.row}>
          <strong style={styles.h2}>Gift pack</strong>
          <TextField
            label="Buyer phone"
            value={giftPhone}
            onChange={(e) => setGiftPhone(e.target.value)}
            placeholder="98765…"
          />
          <label style={styles.field}>
            Slab
            <select
              value={giftSlab}
              onChange={(e) => setGiftSlab(e.target.value as MembershipSlabCode)}
              style={styles.input}
            >
              <option value="QUARTERLY">3 months</option>
              <option value="HALF_YEAR">6 months</option>
              <option value="ANNUAL">Annual</option>
            </select>
          </label>
          <Button size="sm" onClick={askGiftConfirm} disabled={busy || giftPhone.trim().length < 10}>
            Gift
          </Button>
        </div>
      </Card>

      {confirmCopy ? (
        <ConfirmDialog
          open
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.confirmLabel}
          cancelLabel="Back"
          danger={confirmCopy.danger}
          busy={busy}
          onConfirm={confirmCopy.run}
          onClose={closeConfirm}
        />
      ) : null}

      <div style={styles.row}>
        <label style={styles.field}>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={styles.input} />
        </label>
        <label style={styles.field}>
          To
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={styles.input} />
        </label>
        <Button size="sm" onClick={() => void reload()} disabled={busy}>
          Run report
        </Button>
      </div>

      {report ? (
        <div style={styles.kpis}>
          <Kpi label="Active members" value={String(report.activeMembers)} hint="Usable credits now" />
          <Kpi label="Expiring 7d" value={String(report.expiringIn7Days)} hint="Need renew" />
          <Kpi label="Credits left" value={String(report.usableCreditsOutstanding)} hint="Not yet used" />
          <Kpi label="Packs sold" value={String(report.packsSold)} hint={money(report.paidRevenue)} />
          <Kpi label="Gifts" value={String(report.gifts)} hint="No revenue" />
          <Kpi label="Cash pending" value={String(report.cashPending)} hint="Hub to confirm" />
          <Kpi label="Granted" value={String(report.creditsGranted)} hint="Credits issued" />
          <Kpi label="Deliveries waived" value={String(report.deliveriesWaived)} hint={money(report.deliveryFeeWaived)} />
          <Kpi label="Credits restored" value={String(report.creditsRestored)} hint="We cancelled / failed" />
        </div>
      ) : null}

      {pending.length > 0 ? (
        <Card style={styles.card}>
          <h2 style={styles.h2}>Pending cash</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Slab</th>
                <th style={styles.th}>₹</th>
                <th style={styles.th}>Credits</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.purchaseId}>
                  <td style={styles.td}>{p.buyerPhone}</td>
                  <td style={styles.td}>{p.slab}</td>
                  <td style={styles.td}>{money(p.price)}</td>
                  <td style={styles.td}>{p.creditsGranted}</td>
                  <td style={styles.td}>
                    <Button
                      size="sm"
                      onClick={() =>
                        setConfirm({
                          kind: 'cash',
                          action: 'confirm',
                          purchaseId: p.purchaseId,
                          phone: p.buyerPhone || 'this buyer',
                        })
                      }
                      disabled={busy}
                    >
                      Confirm
                    </Button>{' '}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setConfirm({
                          kind: 'cash',
                          action: 'cancel',
                          purchaseId: p.purchaseId,
                          phone: p.buyerPhone || 'this buyer',
                        })
                      }
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <div style={styles.split}>
        <Card style={styles.card}>
          <h2 style={styles.h2}>Members</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Slab</th>
                <th style={styles.th}>Left</th>
                <th style={styles.th}>Until</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={4} style={styles.empty}>
                    No members yet.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.buyerId}>
                    <td style={styles.td}>{m.phone ?? m.buyerId.slice(0, 8)}</td>
                    <td style={styles.td}>{m.lastSlab}</td>
                    <td style={styles.td}>{m.usableCredits}</td>
                    <td style={styles.td}>{when(m.expiresAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
        <Card style={styles.card}>
          <h2 style={styles.h2}>Purchases</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Pay</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Credits</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={4} style={styles.empty}>
                    No purchases yet.
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p.purchaseId}>
                    <td style={styles.td}>{p.buyerPhone}</td>
                    <td style={styles.td}>{p.channel}</td>
                    <td style={styles.td}>{p.status}</td>
                    <td style={styles.td}>{p.creditsGranted}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
        {token ? <AdminHistoryPanel token={token} screen="memberships" refreshTick={notice ? notice.length : 0} /> : null}
      </div>
    </PortalShell>
  );
}

function SlabFields({
  label,
  price,
  credits,
  onPrice,
  onCredits,
}: {
  label: string;
  price: number;
  credits: number;
  onPrice: (n: number) => void;
  onCredits: (n: number) => void;
}) {
  return (
    <div style={styles.slab}>
      <strong style={styles.slabTitle}>{label}</strong>
      <label style={styles.field}>
        Price ₹
        <input
          style={styles.input}
          inputMode="decimal"
          value={String(price)}
          onChange={(e) => onPrice(Number(e.target.value) || 0)}
        />
      </label>
      <label style={styles.field}>
        Free deliveries
        <input
          style={styles.input}
          inputMode="numeric"
          value={String(credits)}
          onChange={(e) => onCredits(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        />
      </label>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={styles.kpi}>
      <span style={styles.kpiLabel}>{label}</span>
      <strong style={styles.kpiValue}>{value}</strong>
      <span style={styles.kpiHint}>{hint}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { padding: '0.55rem 0.65rem', marginBottom: '0.45rem' },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '0.45rem' },
  h2: { margin: 0, fontSize: '0.92rem', fontWeight: 800 },
  hint: { fontSize: '0.72rem', color: 'var(--text-muted)' },
  slabs: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.4rem', margin: '0.4rem 0' },
  slab: { display: 'grid', gap: '0.28rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem' },
  slabTitle: { fontSize: '0.78rem' },
  field: { display: 'grid', gap: '0.15rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  input: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.35rem 0.5rem',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    minHeight: 34,
    minWidth: 90,
  },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.4rem', margin: '0.35rem 0' },
  kpi: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.4rem 0.5rem',
    display: 'grid',
    gap: '0.05rem',
  },
  kpiLabel: { fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' },
  kpiValue: { fontFamily: 'var(--font-display)', fontSize: '1.05rem' },
  kpiHint: { fontSize: '0.65rem', color: 'var(--text-muted)' },
  split: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.45rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  th: { textAlign: 'left', padding: '0.25rem 0.3rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' },
  td: { padding: '0.28rem 0.3rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  empty: { padding: '0.55rem', color: 'var(--text-muted)', textAlign: 'center' },
  switchOn: {
    width: 44,
    height: 26,
    borderRadius: 999,
    border: 'none',
    background: 'var(--accent)',
    position: 'relative',
    cursor: 'pointer',
  },
  switchOff: {
    width: 44,
    height: 26,
    borderRadius: 999,
    border: 'none',
    background: 'var(--border)',
    position: 'relative',
    cursor: 'pointer',
  },
  knobOn: { position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff' },
  knobOff: { position: 'absolute', top: 3, left: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff' },
};
