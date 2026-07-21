const TOWN_KEY = 'hlm.buyer.town';

export type TownPreference = {
  townId: string;
  displayName: string;
  stateCode?: string;
};

export function loadTownPreference(): TownPreference | null {
  try {
    const raw = localStorage.getItem(TOWN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TownPreference;
    if (!parsed?.townId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveTownPreference(pref: TownPreference): void {
  localStorage.setItem(TOWN_KEY, JSON.stringify(pref));
}

export function clearTownPreference(): void {
  localStorage.removeItem(TOWN_KEY);
}
