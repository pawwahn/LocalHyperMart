import type { TownDueTown, TownDuesReport } from './townDuesApi';

function sumTown(towns: TownDueTown[], field: keyof Pick<TownDueTown, 'sendBill' | 'collect' | 'pay' | 'confirm'>) {
  return towns.reduce((total, town) => total + Number(town[field] || 0), 0);
}

/** Combine ledger-only and open-work-only responses from Accounts. */
export function mergeTownDuesReports(ledger: TownDuesReport, open: TownDuesReport): TownDuesReport {
  const byTown = new Map<string, TownDueTown>();
  for (const town of ledger.towns ?? []) {
    byTown.set(town.townId, {
      ...town,
      lines: [...(town.lines ?? [])],
    });
  }
  for (const town of open.towns ?? []) {
    const existing = byTown.get(town.townId);
    if (existing) {
      existing.lines.push(...(town.lines ?? []));
      existing.sendBill = Number(existing.sendBill || 0) + Number(town.sendBill || 0);
      existing.collect = Number(existing.collect || 0) + Number(town.collect || 0);
      existing.pay = Number(existing.pay || 0) + Number(town.pay || 0);
      existing.confirm = Number(existing.confirm || 0) + Number(town.confirm || 0);
    } else {
      byTown.set(town.townId, {
        ...town,
        lines: [...(town.lines ?? [])],
      });
    }
  }
  const towns = [...byTown.values()];
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
