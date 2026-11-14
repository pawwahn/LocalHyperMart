import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import {
  diagnosticsOwnerSessionFallback,
  fetchDiagnosticsSession,
  fetchMyDiagnostics,
  resolveDiagnosticsWrites,
  type DiagnosticsStaffSession,
} from '../api/diagnosticsApi';
import { isDiagnosticsVendor } from '@/features/shop/hooks/useHidesListings';

/**
 * True for a field collector: can run visits, cannot dispatch/catalog/staff/lab admin.
 * Managers who are also collection-capable stay on the full lab portal.
 */
export function isCollectionAgentOnly(session: DiagnosticsStaffSession | null | undefined): boolean {
  if (!session) return false;
  const writes = resolveDiagnosticsWrites(session);
  const title = String(session.title ?? '').toUpperCase();
  if (title === 'COLLECTION_AGENT') {
    return !writes.isAdmin && !writes.isManager;
  }
  return (
    writes.canCollection &&
    !writes.canDispatch &&
    !writes.canManageCatalog &&
    !writes.canManageStaff &&
    !writes.isAdmin &&
    !writes.isManager &&
    !writes.isTech
  );
}

export function useDiagnosticsStaffSession(): {
  staffSession: DiagnosticsStaffSession | null;
  writes: ReturnType<typeof resolveDiagnosticsWrites>;
  collectionAgentOnly: boolean;
  loading: boolean;
} {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const diagnosticsVendor = isDiagnosticsVendor(session?.serviceName);
  const [staffSession, setStaffSession] = useState<DiagnosticsStaffSession | null>(null);
  const [loading, setLoading] = useState(Boolean(token && diagnosticsVendor));

  useEffect(() => {
    if (!token || !diagnosticsVendor) {
      setStaffSession(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchDiagnosticsSession(token)
      .catch(() => fetchMyDiagnostics(token).then((me) => me.session ?? diagnosticsOwnerSessionFallback()))
      .then((sess) => {
        if (!cancelled) setStaffSession(sess);
      })
      .catch(() => {
        if (!cancelled) setStaffSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, diagnosticsVendor]);

  const writes = useMemo(() => resolveDiagnosticsWrites(staffSession), [staffSession]);
  const collectionAgentOnly = isCollectionAgentOnly(staffSession);

  return { staffSession, writes, collectionAgentOnly, loading };
}
