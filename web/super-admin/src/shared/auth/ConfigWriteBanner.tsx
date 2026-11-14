import type { CSSProperties } from 'react';
import { Banner } from '@/shared/ui';
import { usePlatformAdminAccess } from './usePlatformAdminAccess';

type Props = {
  noun?: string;
};

export function ConfigWriteBanner({ noun = 'configuration' }: Props) {
  const { canWriteConfig } = usePlatformAdminAccess();
  if (canWriteConfig) return null;
  return (
    <Banner tone="info" style={styles.banner}>
      Read-only access — you can view {noun} but cannot save changes. Ask a super admin or someone with write access.
    </Banner>
  );
}

const styles: Record<string, CSSProperties> = {
  banner: { marginBottom: '0.75rem' },
};
