import { useAuth } from '@/shared/auth/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { fetchPickupManifest, type AssignmentView, type PickupManifestView } from '../api/agentApi';

export function usePickupManifests(tasks: AssignmentView[]) {
  const { session } = useAuth();
  const [manifests, setManifests] = useState<Record<string, PickupManifestView>>({});
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const taskKey = useMemo(
    () =>
      tasks
        .map((t) => t.id)
        .sort()
        .join(','),
    [tasks],
  );

  useEffect(() => {
    if (!session || tasks.length === 0) {
      setManifests({});
      setFailedIds({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const next: Record<string, PickupManifestView> = {};
      const failed: Record<string, boolean> = {};

      await Promise.all(
        tasks.map(async (task) => {
          try {
            const manifest = await fetchPickupManifest(session.accessToken, task.id);
            if (!cancelled) next[task.id] = manifest;
          } catch {
            if (!cancelled) failed[task.id] = true;
          }
        }),
      );

      if (cancelled) return;
      setManifests(next);
      setFailedIds(failed);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // taskKey captures identity of assignment ids; reloadKey forces retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable key
  }, [session, taskKey, reloadKey]);

  function retryManifests() {
    setReloadKey((k) => k + 1);
  }

  function retryManifest(assignmentId: string) {
    if (!session) return;
    void (async () => {
      try {
        const manifest = await fetchPickupManifest(session.accessToken, assignmentId);
        setManifests((prev) => ({ ...prev, [assignmentId]: manifest }));
        setFailedIds((prev) => {
          const copy = { ...prev };
          delete copy[assignmentId];
          return copy;
        });
      } catch {
        setFailedIds((prev) => ({ ...prev, [assignmentId]: true }));
      }
    })();
  }

  return {
    manifests,
    failedIds,
    loadingManifests: loading,
    retryManifests,
    retryManifest,
  };
}
