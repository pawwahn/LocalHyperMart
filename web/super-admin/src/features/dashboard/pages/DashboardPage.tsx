import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner, Card } from '@/shared/ui';

const LINKS = [
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
    to: '/store-listings',
    title: 'Store listings report',
    body: 'See what a specific vendor is listing in a town. Filter and download CSV.',
  },
  {
    to: '/settlements',
    title: 'Vendor payouts',
    body: 'Pay vendors for day/week/month orders. Record mode, UTR, and mark paid.',
  },
  {
    to: '/settings',
    title: 'Platform settings',
    body: 'Legal policy URLs, grievance contact, maintenance flag.',
  },
];

export function DashboardPage() {
  return (
    <PortalShell title="Overview">
      <Banner tone="info">
        Soft-launch ops desk — payments and SMS still stubbed; focus on towns, vendors, and catalog.
      </Banner>
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
    gap: '0.85rem',
  },
  link: { textDecoration: 'none', color: 'inherit' },
  card: { display: 'grid', gap: '0.4rem', minHeight: 120 },
  cardTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.2rem',
    fontWeight: 800,
  },
  cardBody: { margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' },
};
