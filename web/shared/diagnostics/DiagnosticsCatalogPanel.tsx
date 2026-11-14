import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react';
import {
  DIAGNOSTICS_REFERENCE_PACKAGES,
  DIAGNOSTICS_REFERENCE_TESTS,
  slugDiagnosticsCustomCode,
} from './referenceTests';
import type { DiagnosticsCatalogPackageRow, DiagnosticsCatalogTestRow } from './catalogTypes';
import { packageMemberCheck } from './packageVisibility';

type Props = {
  /** When this changes (e.g. selected lab), drafts reset from server props. */
  catalogKey?: string;
  tests: DiagnosticsCatalogTestRow[];
  packages: DiagnosticsCatalogPackageRow[];
  canEdit: boolean;
  saving: boolean;
  onSave: (
    tests: DiagnosticsCatalogTestRow[],
    packages: Array<DiagnosticsCatalogPackageRow & { memberCodes?: string[] }>,
  ) => void;
};

type TestDraft = {
  key: string;
  id?: string;
  code: string;
  name: string;
  price: string;
  fastingNote: string;
  active: boolean;
  isCustom: boolean;
};

type PackageDraft = {
  key: string;
  id?: string;
  code: string;
  name: string;
  /** Buyer-facing “what’s covered” — saved with catalog. */
  coverageNote: string;
  price: string;
  active: boolean;
  memberCodes: string[];
  isCustom: boolean;
};

type CatalogTab = 'tests' | 'packages';

function testsToDrafts(tests: DiagnosticsCatalogTestRow[]): TestDraft[] {
  const byCode = new Map<string, DiagnosticsCatalogTestRow>();
  for (const row of tests) {
    if (row.code) byCode.set(row.code.toUpperCase(), row);
  }
  const refRows: TestDraft[] = DIAGNOSTICS_REFERENCE_TESTS.map((ref) => {
    const existing = byCode.get(ref.code);
    if (existing) byCode.delete(ref.code);
    return {
      key: ref.code,
      id: existing?.id,
      code: ref.code,
      name: existing?.name ?? ref.label,
      price: existing && existing.price > 0 ? String(existing.price) : '',
      fastingNote: existing?.fastingNote ?? ref.fastingNote ?? '',
      active: existing?.active !== false,
      isCustom: false,
    };
  });
  const customs = [...byCode.values()].map((row) => ({
    key: row.id ?? row.code ?? row.name,
    id: row.id,
    code: row.code ?? slugDiagnosticsCustomCode(row.name),
    name: row.name,
    price: row.price > 0 ? String(row.price) : '',
    fastingNote: row.fastingNote ?? '',
    active: row.active !== false,
    isCustom: true,
  }));
  return [...refRows, ...customs];
}

function memberCodesFromPackage(
  existing: DiagnosticsCatalogPackageRow | undefined,
  refMemberCodes: string[],
  testCodeById: Map<string, string | undefined>,
): string[] {
  const fromIds = (existing?.testIds ?? [])
    .map((id) => testCodeById.get(id))
    .filter((code): code is string => Boolean(code));
  if (fromIds.length > 0) return fromIds;
  return refMemberCodes;
}

function packagesToDrafts(tests: DiagnosticsCatalogTestRow[], packages: DiagnosticsCatalogPackageRow[]): PackageDraft[] {
  const testCodeById = new Map(tests.filter((t) => t.id && t.code).map((t) => [t.id!, t.code!.toUpperCase()]));
  const byCode = new Map<string, DiagnosticsCatalogPackageRow>();
  for (const row of packages) {
    if (row.code) byCode.set(row.code.toUpperCase(), row);
  }
  const refRows: PackageDraft[] = DIAGNOSTICS_REFERENCE_PACKAGES.map((ref) => {
    const existing = byCode.get(ref.code);
    if (existing) byCode.delete(ref.code);
    const memberCodes = memberCodesFromPackage(existing, ref.memberTestCodes, testCodeById);
    return {
      key: ref.code,
      id: existing?.id,
      code: ref.code,
      name: existing?.name ?? ref.label,
      coverageNote: existing?.description ?? '',
      price: existing && existing.price > 0 ? String(existing.price) : '',
      active: existing?.active !== false,
      memberCodes: memberCodes as string[],
      isCustom: false,
    };
  });
  const customs = [...byCode.values()].map((row) => ({
    key: row.id ?? row.code ?? row.name,
    id: row.id,
    code: row.code ?? slugDiagnosticsCustomCode(row.name),
    name: row.name,
    coverageNote: row.description ?? '',
    price: row.price > 0 ? String(row.price) : '',
    active: row.active !== false,
    memberCodes: memberCodesFromPackage(row, [], testCodeById),
    isCustom: true,
  }));
  return [...refRows, ...customs];
}

function formatRate(price: string): string {
  const n = Number(price);
  if (!price.trim() || !Number.isFinite(n) || n <= 0) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const CATALOG_SKIN = `
.hlm-diag-catalog-root {
  color-scheme: light;
  color: #0f172a;
}
.hlm-diag-catalog-root button.hlm-diag-catalog-tabBtn {
  color: #0f766e;
}
.hlm-diag-catalog-root button.hlm-diag-catalog-tabBtn[aria-selected="true"] {
  color: #0f172a;
}
.hlm-diag-catalog-root button.hlm-diag-catalog-tabBtn span:first-child {
  font-weight: 900;
}
@media (max-width: 720px) {
  .hlm-diag-catalog-root .hlm-diag-pkgRowTop {
    grid-template-columns: 1fr !important;
    gap: 0.35rem !important;
  }
  .hlm-diag-catalog-root .hlm-diag-pkgRow {
    gap: 0.35rem !important;
    padding: 0.55rem 0.5rem !important;
  }
  .hlm-diag-catalog-root .hlm-diag-pkgRowHead {
    display: none !important;
  }
  .hlm-diag-catalog-root .hlm-diag-pkgStatusRow {
    display: flex;
    justify-content: flex-end;
  }
}
`;

export function DiagnosticsCatalogPanel({ catalogKey, tests, packages, canEdit, saving, onSave }: Props) {
  const pkgMemberAddId = useId();
  const [testDrafts, setTestDrafts] = useState<TestDraft[]>(() => testsToDrafts(tests));
  const [packageDrafts, setPackageDrafts] = useState<PackageDraft[]>(() => packagesToDrafts(tests, packages));
  const [customTestName, setCustomTestName] = useState('');
  const [customPkgName, setCustomPkgName] = useState('');
  const [tab, setTab] = useState<CatalogTab>('tests');

  const serverCatalogSig = useMemo(
    () =>
      JSON.stringify({
        catalogKey: catalogKey ?? '',
        tests: tests.map((t) => [t.id, t.code, t.price, t.active, t.fastingNote]),
        packages: packages.map((p) => [p.id, p.code, p.price, p.active, p.testIds, p.description]),
      }),
    [catalogKey, tests, packages],
  );

  useEffect(() => {
    setTestDrafts(testsToDrafts(tests));
    setPackageDrafts(packagesToDrafts(tests, packages));
  }, [serverCatalogSig, tests, packages]);

  const pricedTestCount = testDrafts.filter((row) => row.price.trim()).length;

  const catalogTests = useMemo((): DiagnosticsCatalogTestRow[] => {
    const byCode = new Map<string, DiagnosticsCatalogTestRow>();
    for (const row of tests) {
      if (row.code) byCode.set(row.code.toUpperCase(), row);
    }
    for (const draft of testDrafts) {
      byCode.set(draft.code.toUpperCase(), {
        id: draft.id,
        code: draft.code,
        name: draft.name,
        price: draft.price.trim() ? Math.max(0, Number(draft.price) || 0) : 0,
        fastingNote: draft.fastingNote || undefined,
        active: draft.active,
        homeCollection: true,
      });
    }
    return [...byCode.values()];
  }, [tests, testDrafts]);

  const buyerReadyPackageCount = useMemo(
    () =>
      packageDrafts.filter((row) =>
        packageMemberCheck(row.memberCodes, catalogTests, {
          packageActive: row.active,
          packagePrice: row.price.trim() ? Number(row.price) : 0,
          packageId: row.id,
        }).ready,
      ).length,
    [packageDrafts, catalogTests],
  );

  const testColumns = useMemo(() => {
    const mid = Math.ceil(testDrafts.length / 2);
    return [
      testDrafts.slice(0, mid).map((row, offset) => ({ row, index: offset })),
      testDrafts.slice(mid).map((row, offset) => ({ row, index: mid + offset })),
    ];
  }, [testDrafts]);

  const codeToTestId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of tests) {
      if (row.id && row.code) map.set(row.code.toUpperCase(), row.id);
    }
    for (const draft of testDrafts) {
      if (draft.id) map.set(draft.code.toUpperCase(), draft.id);
    }
    return map;
  }, [tests, testDrafts]);

  /** Tests that can be bundled into a package: reference menu + any custom rows on this lab. */
  const packageMemberOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { value: string; label: string; isCustom: boolean }[] = [];
    for (const t of DIAGNOSTICS_REFERENCE_TESTS) {
      const key = t.code.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ value: t.code, label: t.label, isCustom: false });
    }
    for (const row of catalogTests) {
      if (!row.code) continue;
      const key = row.code.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ value: row.code, label: row.name, isCustom: true });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [catalogTests]);

  function labelForMemberCode(code: string): string {
    const upper = code.toUpperCase();
    const ref = DIAGNOSTICS_REFERENCE_TESTS.find((t) => t.code === upper);
    if (ref) return ref.label;
    const row = catalogTests.find((t) => t.code?.toUpperCase() === upper);
    return row?.name ?? code;
  }

  function togglePackageMember(pkgIndex: number, rawCode: string, add: boolean) {
    const upper = rawCode.toUpperCase();
    setPackageDrafts((prev) =>
      prev.map((item, i) => {
        if (i !== pkgIndex) return item;
        if (add) {
          if (item.memberCodes.some((c) => c.toUpperCase() === upper)) return item;
          return { ...item, memberCodes: [...item.memberCodes, rawCode.trim()] };
        }
        return { ...item, memberCodes: item.memberCodes.filter((c) => c.toUpperCase() !== upper) };
      }),
    );
  }

  function applyReferenceMenu() {
    setTestDrafts(testsToDrafts([]));
    setPackageDrafts(packagesToDrafts([], []));
  }

  function addCustomTest() {
    const name = customTestName.trim();
    if (!name) return;
    setTestDrafts((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        code: slugDiagnosticsCustomCode(name),
        name,
        price: '',
        fastingNote: '',
        active: true,
        isCustom: true,
      },
    ]);
    setCustomTestName('');
  }

  function addCustomPackage() {
    const name = customPkgName.trim();
    if (!name) return;
    setPackageDrafts((prev) => [
      ...prev,
      {
        key: `pkg-${Date.now()}`,
        code: slugDiagnosticsCustomCode(name),
        name,
        coverageNote: '',
        price: '',
        active: true,
        memberCodes: [],
        isCustom: true,
      },
    ]);
    setCustomPkgName('');
  }

  function commitSave() {
    const outTests: DiagnosticsCatalogTestRow[] = testDrafts
      .filter((row) => row.name.trim() && row.price.trim())
      .map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name.trim(),
        price: Math.max(0, Number(row.price) || 0),
        fastingNote: row.fastingNote.trim() || undefined,
        active: row.active,
        homeCollection: true,
      }));
    const outPackages = packageDrafts
      .filter((row) => row.name.trim() && row.price.trim() && row.memberCodes.length > 0)
      .map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name.trim(),
        description: row.coverageNote.trim() || undefined,
        price: Math.max(0, Number(row.price) || 0),
        active: row.active,
        memberCodes: row.memberCodes,
        testIds: row.memberCodes
          .map((code) => codeToTestId.get(code.toUpperCase()))
          .filter(Boolean) as string[],
      }));
    onSave(outTests, outPackages);
  }

  return (
    <section className="hlm-diag-catalog-root" style={styles.card}>
      <style>{CATALOG_SKIN}</style>
      <h2 style={styles.h2}>Lab catalog</h2>
      <p style={styles.lead}>
        Default reference tests and packages — set optional starter rates for this lab, or leave blank for the vendor to
        fill in their portal.
      </p>
      <div style={styles.tabBar} role="tablist" aria-label="Catalog sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tests'}
          className="hlm-diag-catalog-tabBtn"
          style={tab === 'tests' ? styles.tabOn : styles.tabOff}
          onClick={() => setTab('tests')}
        >
          <span>Tests</span>
          <span style={styles.tabCount}>{pricedTestCount}/{testDrafts.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'packages'}
          className="hlm-diag-catalog-tabBtn"
          style={tab === 'packages' ? styles.tabOn : styles.tabOff}
          onClick={() => setTab('packages')}
        >
          <span>Packages</span>
          <span style={styles.tabCount} title="Patients see only buyer-ready packages">
            {buyerReadyPackageCount}/{packageDrafts.length}
          </span>
        </button>
      </div>
      <p style={styles.sub}>
        {tab === 'tests' ? (
          <>
            Price individual tests — buyers see only <strong>Visible</strong> rows with a rate set.
          </>
        ) : (
          <>
            Bundle priced tests into packages — member tests must be saved on the <strong>Tests</strong> tab first.
          </>
        )}
      </p>
      {canEdit ? (
        <div style={styles.actions}>
          <button type="button" style={styles.chip} onClick={applyReferenceMenu}>
            Load reference menu
          </button>
          <button type="button" style={styles.primary} disabled={saving} onClick={commitSave}>
            {saving ? 'Saving…' : 'Save catalog'}
          </button>
        </div>
      ) : (
        <p style={styles.muted}>Catalog changes require lab admin or manager.</p>
      )}

      {tab === 'tests' ? (
        <>
      <div style={styles.testsBoard}>
        {testColumns.map((column, colIdx) => (
          <div key={colIdx} style={colIdx === 0 ? styles.testsCol : styles.testsColLast}>
            {column.map(({ row, index }, rowIdx) => {
              const rateLabel = formatRate(row.price);
              return (
                <div
                  key={row.key}
                  style={{
                    ...styles.testRow,
                    ...(rowIdx % 2 === 1 ? styles.testRowAlt : null),
                    ...(row.active ? styles.testRowLive : styles.testRowMuted),
                  }}
                >
                  <div style={styles.testRowName} title={row.name}>
                    <span style={styles.testEmoji} aria-hidden>
                      {row.isCustom ? '✨' : '🧪'}
                    </span>
                    <span style={styles.testTitle}>{row.name}</span>
                  </div>
                  <div style={styles.testRateCell}>
                    <span style={styles.testRateBadge} aria-label={`Rate ₹${rateLabel}`}>
                      ₹{rateLabel}
                    </span>
                    {canEdit ? (
                      <input
                        style={styles.testRateInput}
                        inputMode="decimal"
                        placeholder="Rate"
                        aria-label={`Edit rate for ${row.name}`}
                        disabled={!canEdit}
                        value={row.price}
                        onChange={(e) =>
                          setTestDrafts((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, price: e.target.value.replace(/[^\d.]/g, '') } : item,
                            ),
                          )
                        }
                      />
                    ) : null}
                  </div>
                  <input
                    style={styles.testFastingInput}
                    placeholder="Fasting / prep"
                    disabled={!canEdit}
                    value={row.fastingNote}
                    onChange={(e) =>
                      setTestDrafts((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, fastingNote: e.target.value } : item)),
                      )
                    }
                  />
                  <button
                    type="button"
                    disabled={!canEdit}
                    style={row.active ? styles.visiblePill : styles.hiddenPill}
                    onClick={() =>
                      setTestDrafts((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, active: !item.active } : item)),
                      )
                    }
                  >
                    {row.active ? 'Visible' : 'Hidden'}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {canEdit ? (
        <div style={styles.customAddBox}>
          <input
            style={styles.customName}
            placeholder="Custom test name"
            value={customTestName}
            onChange={(e) => setCustomTestName(e.target.value)}
          />
          <button type="button" style={styles.chipAccent} onClick={addCustomTest}>
            + Add custom test
          </button>
        </div>
      ) : null}
        </>
      ) : (
        <>
      <p style={styles.pkgHint}>
        <strong>{buyerReadyPackageCount}</strong> of {packageDrafts.length} packages appear to patients. Rows marked{' '}
        <strong>Not live</strong> need every included test priced and visible on the Tests tab. Use <strong>+ Add test…</strong>{' '}
        to change members, then <strong>Save catalog</strong>.
      </p>
      <div style={styles.pkgRows}>
        <div className="hlm-diag-pkgRowHead" style={styles.pkgRowHead} aria-hidden>
          <span>Package</span>
          <span>Rate</span>
          <span>Includes</span>
          <span>Status</span>
        </div>
        {packageDrafts.map((row, index) => {
          const rateLabel = formatRate(row.price);
          const liveCheck = packageMemberCheck(row.memberCodes, catalogTests, {
            packageActive: row.active,
            packagePrice: row.price.trim() ? Number(row.price) : 0,
            packageId: row.id,
          });
          const statusLabel = !row.active ? 'Hidden' : liveCheck.ready ? 'Visible' : 'Not live';
          const statusStyle = !row.active
            ? styles.hiddenPill
            : liveCheck.ready
              ? styles.visiblePill
              : styles.warnPill;
          return (
            <div
              key={row.key}
              className="hlm-diag-pkgRow"
              style={{
                ...styles.pkgRow,
                ...(row.active ? styles.pkgRowActive : styles.pkgRowMuted),
              }}
            >
              <div className="hlm-diag-pkgRowTop" style={styles.pkgRowTop}>
                <div style={styles.pkgRowName} title={row.name}>
                  <span style={styles.pkgEmoji} aria-hidden>
                    📦
                  </span>
                  <span style={styles.pkgTitle}>{row.name}</span>
                </div>
                <div style={styles.pkgRateCell}>
                  <span style={styles.pkgRateBadge} aria-label={`Bundle rate ₹${rateLabel}`}>
                    ₹{rateLabel}
                  </span>
                  {canEdit ? (
                    <input
                      style={styles.pkgRateInput}
                      inputMode="decimal"
                      placeholder="Rate"
                      aria-label={`Edit rate for ${row.name}`}
                      value={row.price}
                      onChange={(e) =>
                        setPackageDrafts((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, price: e.target.value.replace(/[^\d.]/g, '') } : item,
                          ),
                        )
                      }
                    />
                  ) : null}
                </div>
                <div style={styles.pkgMembers}>
                  {row.memberCodes.length === 0 ? (
                    <span style={styles.tagMissing}>No tests in this package — add tests below</span>
                  ) : (
                    <div style={styles.memberChipRow}>
                      {row.memberCodes.map((code) => (
                        <span key={code} style={styles.memberChip} title={code}>
                          {labelForMemberCode(code)}
                          {canEdit ? (
                            <button
                              type="button"
                              style={styles.memberChipRemove}
                              aria-label={`Remove ${labelForMemberCode(code)} from package`}
                              onClick={() => togglePackageMember(index, code, false)}
                            >
                              ×
                            </button>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  )}
                  {!liveCheck.ready && liveCheck.reason ? (
                    <span style={styles.tagWarn}>{liveCheck.reason}</span>
                  ) : null}
                  {canEdit ? (
                    <div style={styles.memberAddRow}>
                      <label htmlFor={`${pkgMemberAddId}-${index}`} style={styles.srOnly}>
                        Add a test to {row.name}
                      </label>
                      <select
                        id={`${pkgMemberAddId}-${index}`}
                        style={styles.memberAddSelect}
                        value=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          togglePackageMember(index, v, true);
                          e.target.value = '';
                        }}
                      >
                        <option value="">+ Add test…</option>
                        {packageMemberOptions.map((opt) => {
                          const taken = row.memberCodes.some((c) => c.toUpperCase() === opt.value.toUpperCase());
                          return (
                            <option key={opt.value} value={opt.value} disabled={taken}>
                              {opt.isCustom ? `${opt.label} (custom)` : opt.label}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ) : null}
                </div>
                <div className="hlm-diag-pkgStatusRow">
                  <button
                    type="button"
                    disabled={!canEdit}
                    style={statusStyle}
                    title={liveCheck.reason}
                    onClick={() =>
                      setPackageDrafts((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, active: !item.active } : item)),
                      )
                    }
                  >
                    {statusLabel}
                  </button>
                </div>
              </div>
              {canEdit ? (
                <label style={styles.pkgCoverageWrap}>
                  <span style={styles.pkgCoverageLabel}>What&apos;s covered (buyers see this)</span>
                  <textarea
                    style={styles.pkgCoverageTextarea}
                    rows={4}
                    maxLength={4000}
                    placeholder="e.g. CBC, ESR, Iron, TIBC, Ferritin — home collection included"
                    aria-label={`What's covered for ${row.name}`}
                    value={row.coverageNote}
                    onChange={(e) =>
                      setPackageDrafts((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, coverageNote: e.target.value } : item)),
                      )
                    }
                  />
                </label>
              ) : row.coverageNote.trim() ? (
                <p style={styles.pkgCoverageReadonly} title={row.coverageNote}>
                  {row.coverageNote}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {canEdit ? (
        <div style={styles.customAddBox}>
          <input
            style={styles.customName}
            placeholder="Custom package name"
            value={customPkgName}
            onChange={(e) => setCustomPkgName(e.target.value)}
          />
          <button type="button" style={styles.chipAccent} onClick={addCustomPackage}>
            + Add custom package
          </button>
        </div>
      ) : null}
        </>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    display: 'grid',
    gap: '0.55rem',
    padding: '0.65rem 0.75rem 0.75rem',
    borderRadius: 14,
    border: '1px solid #99f6e4',
    background: 'linear-gradient(165deg, #ffffff 0%, #f0fdfa 55%, #ecfeff 100%)',
    boxShadow: '0 6px 20px rgba(15, 118, 110, 0.08)',
  },
  h2: { margin: 0, fontSize: '1rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#134e4a' },
  lead: { margin: '0.15rem 0 0.35rem', fontSize: '0.72rem', lineHeight: 1.45, color: '#475569', fontWeight: 600 },
  tabBar: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 3,
    padding: 3,
    borderRadius: 10,
    background: '#f0fdfa',
    border: '1px solid #99f6e4',
  },
  tabOff: {
    minHeight: 38,
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: '#0f766e',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
  },
  tabOn: {
    minHeight: 38,
    border: 'none',
    borderRadius: 8,
    background: '#fff',
    color: '#0f172a',
    fontWeight: 900,
    fontSize: '0.78rem',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(15, 118, 110, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
  },
  tabCount: {
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.1rem 0.35rem',
    borderRadius: 999,
    background: 'rgba(15, 118, 110, 0.1)',
    color: '#0f766e',
    fontVariantNumeric: 'tabular-nums',
  },
  sub: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' },
  mutedSmall: { margin: '0.15rem 0', fontSize: '0.68rem', color: 'var(--text-muted)' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  chip: {
    minHeight: 36,
    borderRadius: 999,
    border: '1px solid #99f6e4',
    background: 'rgba(255,255,255,0.9)',
    padding: '0 0.75rem',
    fontWeight: 700,
    color: '#0f766e',
  },
  chipAccent: {
    minHeight: 36,
    borderRadius: 999,
    border: '1px dashed #5eead4',
    background: '#fff',
    padding: '0 0.75rem',
    fontWeight: 800,
    color: '#0f766e',
  },
  primary: {
    minHeight: 36,
    border: 0,
    borderRadius: 10,
    background: 'linear-gradient(180deg, #0d9488 0%, #0f766e 100%)',
    color: '#fff',
    fontWeight: 800,
    padding: '0 0.85rem',
    boxShadow: '0 2px 8px rgba(15, 118, 110, 0.25)',
  },
  testsBoard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #cbd5e1',
    background: '#fff',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
  },
  testsCol: {
    display: 'grid',
    alignContent: 'start',
    borderRight: '1px solid #e2e8f0',
    minWidth: 0,
  },
  testsColLast: {
    display: 'grid',
    alignContent: 'start',
    minWidth: 0,
  },
  testRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 0.95fr) auto',
    gap: '0.3rem 0.35rem',
    alignItems: 'center',
    padding: '0.32rem 0.45rem',
    borderBottom: '1px solid #f1f5f9',
    minWidth: 0,
  },
  testRowAlt: { background: '#fafafa' },
  testRowLive: { boxShadow: 'inset 3px 0 0 #2dd4bf' },
  testRowMuted: { opacity: 0.82, boxShadow: 'inset 3px 0 0 #e2e8f0' },
  testRowName: { display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 },
  testEmoji: {
    width: 22,
    height: 22,
    borderRadius: 6,
    background: '#ecfdf5',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.72rem',
    flexShrink: 0,
  },
  testTitle: {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: '#1e293b',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  testRateCell: { display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 },
  testRateBadge: {
    fontSize: '0.72rem',
    fontWeight: 900,
    color: '#0f766e',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: 7,
    padding: '0.15rem 0.35rem',
    minWidth: '2.75rem',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
  testRateInput: {
    width: '3.75rem',
    minHeight: 28,
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: '0 0.3rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    background: '#f8fafc',
  },
  testFastingInput: {
    minHeight: 28,
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: '0 0.35rem',
    fontSize: '0.68rem',
    color: '#475569',
    background: '#f8fafc',
    minWidth: 0,
  },
  visiblePill: {
    minHeight: 28,
    minWidth: '4.1rem',
    borderRadius: 999,
    border: '1px solid #34d399',
    background: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)',
    color: '#047857',
    fontWeight: 800,
    fontSize: '0.62rem',
    padding: '0 0.35rem',
    flexShrink: 0,
  },
  hiddenPill: {
    minHeight: 28,
    minWidth: '4.1rem',
    borderRadius: 999,
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#64748b',
    fontWeight: 800,
    fontSize: '0.62rem',
    padding: '0 0.35rem',
    flexShrink: 0,
  },
  warnPill: {
    minHeight: 28,
    minWidth: '4.6rem',
    borderRadius: 999,
    border: '1px solid #fcd34d',
    background: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)',
    color: '#92400e',
    fontWeight: 800,
    fontSize: '0.62rem',
    padding: '0 0.35rem',
    flexShrink: 0,
    cursor: 'help',
  },
  customRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' },
  customAddBox: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    alignItems: 'center',
    padding: '0.45rem 0.5rem',
    borderRadius: 10,
    border: '1px dashed #99f6e4',
    background: 'rgba(255,255,255,0.65)',
  },
  customName: {
    flex: '1 1 10rem',
    minHeight: 36,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '0 0.45rem',
    background: '#fff',
  },
  pkgHint: { margin: '-0.15rem 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' },
  pkgRows: {
    display: 'grid',
    gap: 0,
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #cbd5e1',
    background: '#fff',
  },
  pkgRowHead: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) auto minmax(0, 1fr) auto',
    gap: '0.35rem 0.45rem',
    padding: '0.32rem 0.5rem',
    background: '#f0fdfa',
    borderBottom: '1px solid #cbd5e1',
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  pkgRowTop: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) auto minmax(0, 1fr) auto',
    gap: '0.35rem 0.45rem',
    alignItems: 'center',
    minWidth: 0,
  },
  pkgRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    padding: '0.38rem 0.5rem',
    borderBottom: '1px solid #f1f5f9',
    minWidth: 0,
  },
  pkgCoverageWrap: { display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 },
  pkgCoverageLabel: {
    fontSize: '0.58rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  pkgCoverageTextarea: {
    width: '100%',
    minHeight: '4.25rem',
    resize: 'vertical' as const,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '0.35rem 0.45rem',
    fontSize: '0.68rem',
    lineHeight: 1.45,
    color: '#334155',
    background: '#f8fafc',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  pkgCoverageReadonly: {
    margin: 0,
    fontSize: '0.65rem',
    lineHeight: 1.45,
    color: '#64748b',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  pkgRowActive: { boxShadow: 'inset 3px 0 0 #2dd4bf', background: '#fff' },
  pkgRowMuted: { opacity: 0.82, boxShadow: 'inset 3px 0 0 #e2e8f0', background: '#fafafa' },
  pkgRowName: { display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 },
  pkgEmoji: { fontSize: '0.85rem', lineHeight: 1, flexShrink: 0 },
  pkgTitle: { fontSize: '0.76rem', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pkgRateCell: { display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 },
  pkgRateBadge: {
    fontSize: '0.78rem',
    fontWeight: 900,
    color: '#0f766e',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: 8,
    padding: '0.2rem 0.45rem',
    minWidth: '3.25rem',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
  pkgRateInput: {
    width: '4.25rem',
    minHeight: 30,
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '0 0.35rem',
    fontSize: '0.72rem',
    fontWeight: 700,
  },
  pkgMembers: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '0.28rem',
    minWidth: 0,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
  memberChipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.22rem',
    alignItems: 'center',
    minWidth: 0,
  },
  memberChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.12rem',
    maxWidth: '100%',
    fontSize: '0.62rem',
    padding: '0.12rem 0.28rem 0.12rem 0.35rem',
    borderRadius: 999,
    background: '#f0fdf4',
    color: '#047857',
    fontWeight: 700,
    border: '1px solid #bbf7d0',
    lineHeight: 1.25,
  },
  memberChipRemove: {
    margin: 0,
    padding: '0 0.18rem',
    border: 'none',
    background: 'transparent',
    color: '#166534',
    fontSize: '0.95rem',
    fontWeight: 900,
    lineHeight: 1,
    cursor: 'pointer',
    borderRadius: 4,
  },
  memberAddRow: { display: 'flex', minWidth: 0 },
  memberAddSelect: {
    flex: 1,
    minWidth: 0,
    minHeight: 30,
    border: '1px dashed #94a3b8',
    borderRadius: 8,
    padding: '0.15rem 0.35rem',
    fontSize: '0.64rem',
    fontWeight: 700,
    color: '#0f766e',
    background: '#fff',
  },
  tagCompact: {
    fontSize: '0.62rem',
    padding: '0.12rem 0.35rem',
    borderRadius: 999,
    background: '#f0fdf4',
    color: '#047857',
    fontWeight: 700,
    maxWidth: '7.5rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tagMore: { fontSize: '0.62rem', fontWeight: 800, color: '#64748b' },
  tagMissing: {
    fontSize: '0.62rem',
    fontWeight: 700,
    color: '#64748b',
    fontStyle: 'italic',
    lineHeight: 1.35,
  },
  tagWarn: {
    flex: '1 1 100%',
    fontSize: '0.62rem',
    fontWeight: 700,
    color: '#92400e',
    lineHeight: 1.35,
  },
};
