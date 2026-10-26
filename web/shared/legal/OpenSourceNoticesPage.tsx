import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import bundle from './oss-licenses.bundle.json';

type LicenseRow = {
  name: string;
  version?: string;
  license?: string;
  repository?: string;
};

type OssBundle = {
  generatedAt?: string;
  apps?: Record<string, LicenseRow[]>;
  _note?: string;
};

type Props = {
  homeTo?: string;
};

export function OpenSourceNoticesPage({ homeTo = '/' }: Props) {
  const [query, setQuery] = useState('');
  const data = bundle as OssBundle;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: Array<LicenseRow & { app: string }> = [];
    for (const [app, list] of Object.entries(data.apps ?? {})) {
      for (const row of list ?? []) {
        const hay = `${app} ${row.name} ${row.license ?? ''}`.toLowerCase();
        if (q && !hay.includes(q)) continue;
        out.push({ ...row, app });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [data.apps, query]);

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        <Link to={homeTo} style={styles.back}>
          ← Back
        </Link>
        <h1 style={styles.title}>Open source notices</h1>
        <p style={styles.p}>
          Third-party software used in KoyaKart web apps. Regenerate before app-store release with{' '}
          <code style={styles.code}>scripts/generate-oss-licenses.ps1</code>.
        </p>
        {data.generatedAt ? (
          <p style={styles.meta}>Bundle generated {new Date(data.generatedAt).toLocaleString('en-IN')}</p>
        ) : null}
        <input
          type="search"
          placeholder="Filter packages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={styles.search}
        />
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Package</th>
                <th style={styles.th}>App</th>
                <th style={styles.th}>License</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} style={styles.td}>
                    No packages match. Run the generate script to populate the full list.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.app}-${row.name}-${row.version}`}>
                    <td style={styles.td}>
                      <strong>{row.name}</strong>
                      {row.version ? <span style={styles.ver}> @{row.version}</span> : null}
                      {row.repository ? (
                        <>
                          <br />
                          <a href={row.repository} style={styles.repo} target="_blank" rel="noreferrer">
                            Source
                          </a>
                        </>
                      ) : null}
                    </td>
                    <td style={styles.td}>{row.app}</td>
                    <td style={styles.td}>{row.license ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p style={styles.p}>
          Platform use is governed by our{' '}
          <Link to="/legal/terms" style={styles.link}>
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/legal/privacy" style={styles.link}>
            Privacy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: { minHeight: '100vh', padding: '0.75rem', background: 'var(--bg)' },
  card: { width: 'min(820px, 100%)', margin: '0 auto', display: 'grid', gap: '0.5rem' },
  back: { color: 'var(--accent)', fontWeight: 800, textDecoration: 'none', fontSize: '0.88rem' },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800 },
  p: { margin: 0, fontSize: '0.84rem', lineHeight: 1.45, color: 'var(--text)' },
  meta: { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  code: { fontSize: '0.8rem' },
  search: {
    minHeight: 40,
    borderRadius: 10,
    border: '1px solid var(--border)',
    padding: '0 0.65rem',
    fontSize: '0.88rem',
  },
  tableWrap: { overflow: 'auto', maxHeight: '62vh', border: '1px solid var(--border)', borderRadius: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th: {
    textAlign: 'left',
    padding: '0.45rem 0.55rem',
    background: 'var(--bg-muted)',
    fontWeight: 800,
    position: 'sticky',
    top: 0,
  },
  td: { padding: '0.4rem 0.55rem', borderTop: '1px solid var(--border)', verticalAlign: 'top' },
  ver: { color: 'var(--text-muted)', fontWeight: 600 },
  repo: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)' },
  link: { color: 'var(--accent)', fontWeight: 700 },
};
