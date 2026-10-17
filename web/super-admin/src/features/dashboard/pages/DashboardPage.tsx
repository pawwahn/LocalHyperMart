import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Card } from '@/shared/ui';
import { OpsInbox } from '../components/OpsInbox';

const LINKS = [
  {
    to: '/reports',
    title: 'Reports',
    body: 'GMV, GST by HSN, claims, payout aging, wallet liability, ads, and referral cash burn by candidate.',
  },
  {
    to: '/towns',
    title: 'Towns',
    body: 'Create towns, enable or disable order acceptance.',
  },
  {
    to: '/vendors',
    title: 'Vendors',
    body: 'Review registration requests and approve shops for a town.',
  },
  {
    to: '/catalog',
    title: 'Master catalog',
    body: 'Browse and add platform master items used by vendors.',
  },
  {
    to: '/scratch-cards',
    title: 'Scratch card gifts',
    body: 'Town-level wallet credit burned by scratch cards. Super admin only.',
  },
  {
    to: '/settlements',
    title: 'Payouts',
    body: 'Pay vendors, hubs, and agents. Collect hub franchise. Record UTR and mark paid.',
  },
  {
    to: '/settings',
    title: 'Platform settings',
    body: 'Legal policy URLs, grievance contact, maintenance flag.',
  },
];

export function DashboardPage() {
  const [refreshTick, setRefreshTick] = useState(0);
  return (
    <PortalShell title="Overview" onRefresh={() => setRefreshTick((n) => n + 1)}>
      <OpsInbox refreshTick={refreshTick} />
      <div style={styles.grid}>
        {LINKS.map((item) => (
          <Link key={item.to} to={item.to} style={styles.link}>
            <Card elevated style={styles.card}>
              <h2 style={styles.cardTitle}>{item.title}</h2>
              <p style={styles.cardBody}>{item.body}</p>
            </Card>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.45rem',
  },
  link: { textDecoration: 'none', color: 'inherit' },
  card: { display: 'grid', gap: '0.2rem' },
  cardTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.95rem',
    fontWeight: 800,
  },
  cardBody: { margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem' },
};
