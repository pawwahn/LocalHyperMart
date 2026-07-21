import type { CSSProperties } from 'react';
import { ThemePicker } from './ThemePicker';

/** Floating theme control for login screens (no PortalShell). */
export function LoginThemeCorner() {
  return (
    <div style={styles.corner}>
      <ThemePicker />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  corner: {
    position: 'fixed',
    top: '0.85rem',
    right: '0.85rem',
    zIndex: 40,
  },
};
