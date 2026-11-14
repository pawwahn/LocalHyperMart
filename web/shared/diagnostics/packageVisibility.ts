import type { DiagnosticsCatalogPackageRow, DiagnosticsCatalogTestRow } from './catalogTypes';
import { DIAGNOSTICS_REFERENCE_PACKAGES } from './referenceTests';

export type PackageMemberCheck = {
  ready: boolean;
  reason?: string;
};

function testMap(tests: DiagnosticsCatalogTestRow[]): Map<string, DiagnosticsCatalogTestRow> {
  const map = new Map<string, DiagnosticsCatalogTestRow>();
  for (const row of tests) {
    if (row.code) map.set(row.code.toUpperCase(), row);
  }
  return map;
}

/** Same rules as vendor-service getBookable + order-service shop detail. */
export function packageMemberCheck(
  memberCodes: string[],
  tests: DiagnosticsCatalogTestRow[],
  opts: { packageActive: boolean; packagePrice: number; packageId?: string },
): PackageMemberCheck {
  if (!opts.packageActive) {
    return { ready: false, reason: 'Package is hidden' };
  }
  if (!opts.packageId) {
    return { ready: false, reason: 'Save catalog after all member tests have rates' };
  }
  if (!Number.isFinite(opts.packagePrice) || opts.packagePrice <= 0) {
    return { ready: false, reason: 'Set a bundle price' };
  }
  if (memberCodes.length === 0) {
    return { ready: false, reason: 'Link at least one test' };
  }
  const byCode = testMap(tests);
  for (const code of memberCodes) {
    const test = byCode.get(code.toUpperCase());
    if (!test?.id) {
      const label = code.replace(/_/g, ' ');
      return { ready: false, reason: `Save rate for ${label} on Tests tab` };
    }
    if (test.active === false) {
      return { ready: false, reason: `Member test ${test.name} is hidden` };
    }
    if (!Number.isFinite(test.price) || test.price <= 0) {
      return { ready: false, reason: `Set rate for ${test.name} on Tests tab` };
    }
  }
  return { ready: true };
}

export function memberCodesForPackage(
  pkg: DiagnosticsCatalogPackageRow,
  tests: DiagnosticsCatalogTestRow[],
): string[] {
  if (pkg.code) {
    const ref = DIAGNOSTICS_REFERENCE_PACKAGES.find((p) => p.code === pkg.code);
    if (ref) return ref.memberTestCodes;
  }
  const idToCode = new Map(tests.filter((t) => t.id && t.code).map((t) => [t.id!, t.code!.toUpperCase()]));
  return (pkg.testIds ?? [])
    .map((id) => idToCode.get(id))
    .filter(Boolean) as string[];
}

export function resolvePackageTestIds(memberCodes: string[], testIdByCode: Map<string, string>): string[] {
  return memberCodes.map((code) => testIdByCode.get(code.toUpperCase())).filter(Boolean) as string[];
}

export function packageSaveIssue(name: string, memberCodes: string[], testIds: string[]): string | null {
  if (memberCodes.length === 0) return `${name}: add at least one member test`;
  if (testIds.length === 0) {
    return `${name}: save member test rates on the Tests tab, then save catalog again`;
  }
  if (testIds.length < memberCodes.length) {
    const missing = memberCodes.length - testIds.length;
    return `${name}: ${missing} member test(s) still missing a rate or are hidden`;
  }
  return null;
}

export function countBuyerReadyPackages(
  packages: DiagnosticsCatalogPackageRow[],
  tests: DiagnosticsCatalogTestRow[],
): number {
  return packages.filter((pkg) => {
    const members = memberCodesForPackage(pkg, tests);
    return packageMemberCheck(members, tests, {
      packageActive: pkg.active !== false,
      packagePrice: pkg.price,
      packageId: pkg.id,
    }).ready;
  }).length;
}
