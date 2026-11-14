import type { TownDueLine, TownDueTown, TownDuesReport } from './townDuesApi';

function sumTown(towns: TownDueTown[], field: keyof Pick<TownDueTown, 'sendBill' | 'collect' | 'pay' | 'confirm'>) {
  return towns.reduce((total, town) => total + Number(town[field] || 0), 0);
}

function dueLineKey(line: TownDueLine): string {
  return [
    line.party,
    line.partyId ?? '',
    line.action,
    line.periodStart ?? '',
    line.periodEnd ?? '',
    Number(line.amount ?? 0).toFixed(2),
    line.what ?? '',
    line.reference ?? '',
    line.settlementId ?? '',
    line.submissionId ?? '',
  ].join('|');
}

function dedupeLines(lines: TownDueLine[]): TownDueLine[] {
  const seen = new Set<string>();
  const out: TownDueLine[] = [];
  for (const line of lines) {
    const key = dueLineKey(line);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

function totalsFromLines(lines: TownDueLine[]): Pick<TownDueTown, 'sendBill' | 'collect' | 'pay' | 'confirm'> {
  const totals = { sendBill: 0, collect: 0, pay: 0, confirm: 0 };
  for (const line of lines) {
    const amount = Number(line.amount || 0);
    if (line.action === 'SEND_BILL') totals.sendBill += amount;
    else if (line.action === 'COLLECT') totals.collect += amount;
    else if (line.action === 'PAY') totals.pay += amount;
    else if (line.action === 'CONFIRM') totals.confirm += amount;
  }
  return totals;
}

function finalizeTown(town: TownDueTown): TownDueTown {
  const lines = dedupeLines(town.lines ?? []);
  return { ...town, lines, ...totalsFromLines(lines) };
}

/** Combine ledger-only and open-work-only responses from Accounts. */
export function mergeTownDuesReports(ledger: TownDuesReport, open: TownDuesReport): TownDuesReport {
  const byTown = new Map<string, TownDueTown>();
  for (const town of ledger.towns ?? []) {
    byTown.set(town.townId, finalizeTown({ ...town, lines: [...(town.lines ?? [])] }));
  }
  for (const town of open.towns ?? []) {
    const existing = byTown.get(town.townId);
    if (existing) {
      existing.lines.push(...(town.lines ?? []));
    } else {
      byTown.set(town.townId, { ...town, lines: [...(town.lines ?? [])] });
    }
    byTown.set(town.townId, finalizeTown(byTown.get(town.townId)!));
  }
  const towns = [...byTown.values()].map(finalizeTown);
  return {
    from: open.from ?? ledger.from,
    to: open.to ?? ledger.to,
    sendBill: sumTown(towns, 'sendBill'),
    collect: sumTown(towns, 'collect'),
    pay: sumTown(towns, 'pay'),
    confirm: sumTown(towns, 'confirm'),
    townCount: towns.length,
    towns,
  };
}
