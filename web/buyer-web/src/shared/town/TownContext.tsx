import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { listEnabledTowns, type TownVm } from '@/features/towns/api/townsApi';
import { apiRequest } from '@/shared/api/http';
import { useAuth } from '@/shared/auth/AuthContext';
import {
  loadTownPreference,
  saveTownPreference,
  type TownPreference,
} from './townPreference';

type TownContextValue = {
  towns: TownVm[];
  /** Empty until the buyer selects a town. */
  townId: string;
  townLabel: string;
  hasTown: boolean;
  loading: boolean;
  error: string | null;
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  selectTown: (town: TownVm) => void;
  reloadTowns: () => Promise<void>;
};

const TownContext = createContext<TownContextValue | null>(null);

function labelFor(pref: TownPreference | null, towns: TownVm[], townId: string): string {
  if (pref?.townId === townId && pref.displayName) {
    return pref.stateCode ? `${pref.displayName.replace(/\s*\(.*\)\s*$/, '')}, ${pref.stateCode}` : pref.displayName;
  }
  const match = towns.find((t) => t.id === townId);
  if (match) {
    const short = match.displayName.replace(/\s*\(.*\)\s*$/, '').trim() || match.displayName;
    return match.stateCode ? `${short}, ${match.stateCode}` : short;
  }
  return 'Choose your town';
}

export function TownProvider({ children }: { children: ReactNode }) {
  const { session, setSession } = useAuth();
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [pref, setPref] = useState<TownPreference | null>(() => loadTownPreference());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reloadTowns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listEnabledTowns();
      setTowns(items);
    } catch (err) {
      setTowns([]);
      setError(err instanceof Error ? err.message : 'Could not load towns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadTowns();
  }, [reloadTowns]);

  // Keep preference aligned with logged-in session town when present.
  useEffect(() => {
    if (!session?.townId) return;
    if (pref?.townId === session.townId) return;
    const match = towns.find((t) => t.id === session.townId);
    const next: TownPreference = {
      townId: session.townId,
      displayName: match?.displayName ?? pref?.displayName ?? 'Selected town',
      stateCode: match?.stateCode ?? pref?.stateCode,
    };
    saveTownPreference(next);
    setPref(next);
  }, [session?.townId, towns, pref?.townId, pref?.displayName, pref?.stateCode]);

  // Prompt until the buyer has a town (Gate A: no silent pilot-town fallback).
  useEffect(() => {
    if (loading) return;
    if (pref?.townId || session?.townId) return;
    if (towns.length === 0) return;
    setPickerOpen(true);
  }, [loading, pref?.townId, session?.townId, towns.length]);

  const townId = session?.townId || pref?.townId || '';
  const hasTown = Boolean(townId);
  const townLabel = hasTown ? labelFor(pref, towns, townId) : 'Choose your town';

  const selectTown = useCallback(
    (town: TownVm) => {
      const next: TownPreference = {
        townId: town.id,
        displayName: town.displayName,
        stateCode: town.stateCode,
      };
      saveTownPreference(next);
      setPref(next);
      setPickerOpen(false);

      if (session) {
        const updated = { ...session, townId: town.id };
        setSession(updated);
        void apiRequest('/api/v1/users/me', {
          method: 'PATCH',
          token: session.accessToken,
          body: { defaultTownId: town.id },
          timeoutMs: 8_000,
        }).catch(() => undefined);
      }
    },
    [session, setSession],
  );

  const value = useMemo(
    () => ({
      towns,
      townId,
      townLabel,
      hasTown,
      loading,
      error,
      pickerOpen,
      openPicker: () => setPickerOpen(true),
      closePicker: () => {
        // Keep picker open until a town is chosen.
        if (!session?.townId && !pref?.townId) return;
        setPickerOpen(false);
      },
      selectTown,
      reloadTowns,
    }),
    [towns, townId, townLabel, hasTown, loading, error, pickerOpen, selectTown, reloadTowns, session?.townId, pref?.townId],
  );

  return <TownContext.Provider value={value}>{children}</TownContext.Provider>;
}

export function useTown(): TownContextValue {
  const ctx = useContext(TownContext);
  if (!ctx) throw new Error('useTown must be used within TownProvider');
  return ctx;
}
