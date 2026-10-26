import { Card, Button, Banner } from '@/shared/ui';
import { formatMoney } from '@/features/reports/api/reportsApi';
import { useVendorGstFiling } from '@/features/reports/hooks/useVendorGstFiling';
import { DateRangePresetBar } from '@hlm-dates/DateRangePresetBar';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import type { CSSProperties } from 'react';

const styles: Record<string, CSSProperties> = {
  filterCard: { marginBottom: '0.75rem' },
  sectionTabs: { display: 'flex', gap: '0.35rem', marginBottom: '0.75rem', flexWrap: 'wrap' },
  sectionTab: {
    padding: '0.35rem 0.75rem',
    borderRadius: '999px',
    border: '1px solid var(--border, #d1d5db)',
    background: 'var(--surface, #fff)',
    cursor: 'pointer',
    fontSize: '0.82rem',
  },
  sectionTabOn: {
    padding: '0.35rem 0.75rem',
    borderRadius: '999px',
    border: '1px solid var(--primary, #166534)',
    background: 'var(--primary-soft, #ecfdf5)',
    fontWeight: 600,
    fontSize: '0.82rem',
  },
  intro: { fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', margin: '0 0 0.75rem' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(8rem, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' },
  kpi: { padding: '0.45rem 0.55rem', borderRadius: 8, background: 'var(--surface-muted, #f8fafc)' },
  kpiLabel: { fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' },
  kpiValue: { fontSize: '0.95rem', fontWeight: 600 },
  tableWrap: { overflowX: 'auto', marginTop: '0.5rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  th: { textAlign: 'left', padding: '0.35rem', borderBottom: '2px solid #166534', whiteSpace: 'nowrap' },
  td: { padding: '0.32rem 0.35rem', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' },
  tdRight: { padding: '0.32rem 0.35rem', borderBottom: '1px solid #e5e7eb', textAlign: 'right' },
  h3: { fontSize: '0.88rem', margin: '1rem 0 0.35rem' },
  actions: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' },
};

export function VendorGstFilingPanel({ active }: { active: boolean }) {
  const g = useVendorGstFiling(active);
  usePortalChrome({ title: 'Reports — GST filing', onRefresh: () => void g.reload() }, active);

  if (!active) return null;

  return (
    <>
      {g.error ? <Banner tone="danger">{g.error}</Banner> : null}

      <Card elevated padding="sm" style={styles.filterCard}>
        <DateRangePresetBar
          preset={g.preset}
          from={g.from}
          to={g.to}
          onPresetChange={g.setPreset}
          onFromChange={g.setFrom}
          onToChange={g.setTo}
          ariaLabel="GST report period"
        />
        <div style={{ ...styles.actions, marginTop: '0.5rem' }}>
          <label style={styles.checkLabel}>
            <input
              type="checkbox"
              checked={g.includeLines}
              onChange={(e) => g.setIncludeLines(e.target.checked)}
            />
            Line detail in Excel
          </label>
          <Button size="sm" onClick={() => void g.reload()} disabled={g.loading}>
            {g.loading ? 'Loading…' : 'Run'}
          </Button>
          <Button size="sm" variant="secondary" disabled={!g.gstReport} onClick={g.downloadExcel}>
            Excel pack
          </Button>
          <Button size="sm" variant="secondary" disabled={!g.gstReport} onClick={g.downloadCsv}>
            CSV
          </Button>
          <Button size="sm" variant="secondary" disabled={!g.gstReport} onClick={g.downloadPdf}>
            PDF summary
          </Button>
          <Button size="sm" variant="secondary" disabled={!g.gstReport} onClick={g.downloadGstr1B2c}>
            GSTR-1 B2C CSV
          </Button>
        </div>
      </Card>

      <p style={styles.intro}>
        Download the <strong>Excel pack</strong> (includes a <strong>GSTR1 B2CS</strong> sheet) or <strong>GSTR-1 B2C CSV</strong> for
        Table 7 B2C working in the GST portal / offline tool. Also: HSN, B2C bags, KoyaKart fee invoices for input tax.
        Customer tax PDFs remain on each buyer order.
        {!g.gstin ? ' Add your GSTIN under shop settings so exports show your registration.' : null}
      </p>

      {g.gstReport ? (
        <Card elevated padding="sm">
          <div style={styles.kpis}>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Delivered bags</div>
              <div style={styles.kpiValue}>{g.gstReport.deliveredBagCount}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Taxable</div>
              <div style={styles.kpiValue}>{formatMoney(g.gstReport.taxableTotal)}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>CGST</div>
              <div style={styles.kpiValue}>{formatMoney(g.gstReport.cgstTotal)}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>SGST</div>
              <div style={styles.kpiValue}>{formatMoney(g.gstReport.sgstTotal)}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>IGST</div>
              <div style={styles.kpiValue}>{formatMoney(g.gstReport.igstTotal)}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Total tax</div>
              <div style={styles.kpiValue}>{formatMoney(g.gstReport.taxTotal)}</div>
            </div>
          </div>

          <h3 style={styles.h3}>HSN summary (outward)</h3>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>HSN</th>
                  <th style={styles.th}>GST%</th>
                  <th style={styles.th}>Lines</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Taxable</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>CGST</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>SGST</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>IGST</th>
                </tr>
              </thead>
              <tbody>
                {g.gstReport.gstByHsn.map((r) => (
                  <tr key={`${r.hsn}-${r.gstPercent}`}>
                    <td style={styles.td}>{r.hsn}</td>
                    <td style={styles.td}>{r.gstPercent}</td>
                    <td style={styles.td}>{r.lines}</td>
                    <td style={styles.tdRight}>{formatMoney(r.taxable)}</td>
                    <td style={styles.tdRight}>{formatMoney(r.cgst)}</td>
                    <td style={styles.tdRight}>{formatMoney(r.sgst)}</td>
                    <td style={styles.tdRight}>{formatMoney(r.igst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={styles.h3}>Input tax — KoyaKart fee invoices (paid in period)</h3>
          <p style={styles.intro}>
            Download individual PDFs anytime from <strong>Payouts → Bill</strong> on each settlement.
          </p>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Invoice</th>
                  <th style={styles.th}>Paid</th>
                  <th style={styles.th}>Type</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Fee incl GST</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Taxable</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>CGST</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>SGST</th>
                </tr>
              </thead>
              <tbody>
                {g.inputTaxRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={styles.td}>
                      No paid KoyaKart fee invoices in this period.
                    </td>
                  </tr>
                ) : (
                  g.inputTaxRows.map((r) => (
                    <tr key={r.invoiceNumber}>
                      <td style={styles.td}>{r.invoiceNumber}</td>
                      <td style={styles.td}>{r.paidDate}</td>
                      <td style={styles.td}>{r.kind}</td>
                      <td style={styles.tdRight}>{formatMoney(r.serviceFeeInclGst)}</td>
                      <td style={styles.tdRight}>{formatMoney(r.taxable)}</td>
                      <td style={styles.tdRight}>{formatMoney(r.cgst)}</td>
                      <td style={styles.tdRight}>{formatMoney(r.sgst)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : g.loading ? (
        <p style={styles.intro}>Loading GST data…</p>
      ) : null}
    </>
  );
}

export const reportSectionTabStyles = {
  sectionTabs: styles.sectionTabs,
  sectionTab: styles.sectionTab,
  sectionTabOn: styles.sectionTabOn,
};
