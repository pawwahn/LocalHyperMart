import { useMemo } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { resolvePlatformAdminAccess, type PlatformAdminAccess } from './platformAdminAccess';

export function usePlatformAdminAccess(): PlatformAdminAccess {
  const { session } = useAuth();
  return useMemo(() => resolvePlatformAdminAccess(session?.roles), [session?.roles]);
}
