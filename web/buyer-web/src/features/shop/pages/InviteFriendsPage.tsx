import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { useShop } from '../hooks/useShop';
import { Banner, Button, LoadingBlock } from '@/shared/ui';
import { ApiError } from '@/shared/api/http';
import { getReferralMe, type ReferralMeVm } from '../api/referralApi';

function shortLink(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url, window.location.origin);
    const path = u.pathname === '/' ? '' : u.pathname;
    const q = u.search ? u.search : '';
    const host = u.host.replace(/^www\./, '');
    const text = `${host}${path}${q}`;
    return text.length > 42 ? `${text.slice(0, 40)}…` : text;
  } catch {
    return url.length > 42 ? `${url.slice(0, 40)}…` : url;
  }
}

export function InviteFriendsPage() {
  const { session } = useAuth();
  const { cart } = useShop();
  const token = session?.accessToken ?? '';
  const [info, setInfo] = useState<ReferralMeVm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      setInfo(await getReferralMe(token));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load referrals');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(t);
  }, [notice]);

  async function copyText(text: string, label: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copied`);
    } catch {
      setNotice('Could not copy — try Share instead');
    }
  }

  async function shareInvite() {
    if (!info?.shareMessage) return;
    setNotice(null);
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'KoYaKart invite',
          text: info.shareMessage,
          url: info.shareLink || undefined,
        });
        setNotice('Thanks for sharing!');
      } else {
        await copyText(info.shareMessage, 'Invite message');
      }
    } catch {
      /* dismissed */
    }
  }

  const friendAmt = info ? Math.round(info.refereeRewardAmount) : 0;
  const youAmt = info ? Math.round(info.referrerRewardAmount) : 0;

  return (
    <PortalShell
      title="Invite friends"
      showDeliveryBanner={false}
      onRefresh={() => void reload()}
      cartCount={cart?.itemCount ?? 0}
      cartTotalLabel={cart?.payableLabel}
    >
      <div style={styles.page}>
        {notice ? (
          <div style={styles.toast} role="status">
            {notice}
          </div>
        ) : null}
        {error ? <Banner tone="danger">{error}</Banner> : null}

        {loading ? (
          <LoadingBlock label="Loading your invite…" />
        ) : !info?.programEnabled ? (
          <div style={styles.emptyHero}>
            <span style={styles.emptyIcon} aria-hidden>🎁</span>
            <p style={styles.emptyTitle}>Referrals coming soon</p>
            <p style={styles.emptySub}>When the program opens, you’ll earn wallet credit for every friend who orders.</p>
          </div>
        ) : (
          <>
            <section style={styles.hero}>
              <div style={styles.heroGlow} aria-hidden />
              <p style={styles.heroEyebrow}>Your invite code</p>
              <button
                type="button"
                style={styles.codeBtn}
                onClick={() => void copyText(info.code, 'Code')}
                title="Tap to copy code"
              >
                <span style={styles.codeText}>{info.code}</span>
                <span style={styles.codeTap}>Tap to copy</span>
              </button>
              <p style={styles.heroTagline}>
                Friends order local groceries · you both earn <strong>wallet credit</strong>
              </p>
            </section>

            <div style={styles.rewardRow}>
              <div style={styles.rewardCard}>
                <span style={styles.rewardLabel}>Friend gets</span>
                <span style={styles.rewardValue}>₹{friendAmt}</span>
                <span style={styles.rewardHint}>on signup</span>
              </div>
              <div style={styles.rewardDivider} aria-hidden />
              <div style={styles.rewardCard}>
                <span style={styles.rewardLabel}>You get</span>
                <span style={styles.rewardValue}>₹{youAmt}</span>
                <span style={styles.rewardHint}>first delivery</span>
              </div>
            </div>

            <ol style={styles.steps}>
              <li style={styles.stepItem}>
                <span style={styles.stepNo}>1</span>
                <span>Share code or link</span>
              </li>
              <li style={styles.stepItem}>
                <span style={styles.stepNo}>2</span>
                <span>Friend registers before first order</span>
              </li>
              <li style={styles.stepItem}>
                <span style={styles.stepNo}>3</span>
                <span>You earn when their order is delivered</span>
              </li>
            </ol>

            <div style={styles.linkCard}>
              <div style={styles.linkMain}>
                <span style={styles.linkLabel}>Share link</span>
                <span style={styles.linkValue} title={info.shareLink}>
                  {shortLink(info.shareLink)}
                </span>
              </div>
              <button type="button" style={styles.chipBtn} onClick={() => void copyText(info.shareLink, 'Link')}>
                Copy
              </button>
            </div>

            <div style={styles.actions}>
              <Button fullWidth size="lg" onClick={() => void shareInvite()}>
                Share invite
              </Button>
              <button
                type="button"
                style={styles.ghostBtn}
                onClick={() => void copyText(info.shareMessage, 'Message')}
              >
                Copy full message
              </button>
            </div>
          </>
        )}
      </div>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'grid',
    gap: '0.65rem',
    paddingBottom: '0.5rem',
  },
  toast: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    padding: '0.45rem 0.65rem',
    borderRadius: 10,
    background: 'color-mix(in srgb, var(--accent) 18%, var(--bg-elevated))',
    border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
    color: 'var(--text)',
    fontSize: '0.82rem',
    fontWeight: 700,
    textAlign: 'center',
    boxShadow: '0 6px 20px color-mix(in srgb, var(--accent) 12%, transparent)',
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    padding: '1rem 1rem 0.9rem',
    background: 'linear-gradient(135deg, #0C831F 0%, #149A2C 52%, #1B5E20 100%)',
    color: '#fff',
    boxShadow: '0 10px 28px color-mix(in srgb, #0C831F 35%, transparent)',
  },
  heroGlow: {
    position: 'absolute',
    right: '-12%',
    top: '-30%',
    width: '55%',
    height: '90%',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(247,206,70,0.45) 0%, transparent 68%)',
    pointerEvents: 'none',
  },
  heroEyebrow: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    opacity: 0.88,
  },
  codeBtn: {
    marginTop: '0.35rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.15rem',
    width: '100%',
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
  },
  codeText: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.65rem, 6vw, 2rem)',
    fontWeight: 800,
    letterSpacing: '0.12em',
    lineHeight: 1.1,
    textShadow: '0 2px 12px rgba(0,0,0,0.15)',
  },
  codeTap: {
    fontSize: '0.72rem',
    fontWeight: 700,
    opacity: 0.85,
    padding: '0.15rem 0.5rem',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.16)',
  },
  heroTagline: {
    margin: '0.65rem 0 0',
    fontSize: '0.82rem',
    lineHeight: 1.45,
    opacity: 0.92,
    maxWidth: '28rem',
  },
  rewardRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'stretch',
    gap: '0.35rem',
    padding: '0.55rem 0.65rem',
    borderRadius: 14,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
  },
  rewardCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.1rem',
    textAlign: 'center',
  },
  rewardDivider: {
    width: 1,
    background: 'var(--border)',
    margin: '0.15rem 0',
  },
  rewardLabel: {
    fontSize: '0.68rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
  },
  rewardValue: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    fontWeight: 800,
    color: 'var(--accent)',
    lineHeight: 1.1,
  },
  rewardHint: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  steps: {
    margin: 0,
    padding: '0.55rem 0.65rem',
    listStyle: 'none',
    display: 'grid',
    gap: '0.4rem',
    borderRadius: 14,
    background: 'color-mix(in srgb, var(--accent) 6%, var(--bg-elevated))',
    border: '1px solid color-mix(in srgb, var(--accent) 14%, var(--border))',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.82rem',
    fontWeight: 600,
    lineHeight: 1.35,
    color: 'var(--text)',
  },
  stepNo: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1.35rem',
    height: '1.35rem',
    marginRight: '0.45rem',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 800,
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    flexShrink: 0,
  },
  linkCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.55rem',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  linkMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
  },
  linkLabel: {
    fontSize: '0.68rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
  },
  linkValue: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chipBtn: {
    flexShrink: 0,
    border: '1px solid color-mix(in srgb, var(--accent) 40%, var(--border))',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    fontWeight: 800,
    fontSize: '0.78rem',
    padding: '0.35rem 0.65rem',
    borderRadius: 999,
    cursor: 'pointer',
  },
  actions: {
    display: 'grid',
    gap: '0.35rem',
    marginTop: '0.15rem',
  },
  ghostBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent-hover)',
    fontWeight: 700,
    fontSize: '0.82rem',
    padding: '0.35rem',
    cursor: 'pointer',
  },
  emptyHero: {
    textAlign: 'center',
    padding: '1.5rem 0.75rem',
    borderRadius: 16,
    border: '1px dashed var(--border)',
    background: 'var(--bg-elevated)',
  },
  emptyIcon: {
    fontSize: '2rem',
    display: 'block',
    marginBottom: '0.35rem',
  },
  emptyTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.05rem',
  },
  emptySub: {
    margin: '0.35rem 0 0',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    lineHeight: 1.45,
  },
};
