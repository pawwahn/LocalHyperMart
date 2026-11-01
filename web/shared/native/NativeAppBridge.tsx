import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from './platform';

export type NativeAppBridgeProps = {
  /** Paths where system Back minimizes the app instead of history back. */
  tabRoots: readonly string[];
  loginPath?: string;
};

/**
 * Android system Back: one screen back, or minimize from a tab root / login.
 */
export function NativeAppBridge({ tabRoots, loginPath = '/login' }: NativeAppBridgeProps) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    let handle: { remove: () => Promise<void> } | null = null;

    void import('@capacitor/app').then(async ({ App }) => {
      const listener = await App.addListener('backButton', (ev: { canGoBack: boolean }) => {
        const { canGoBack } = ev;
        const roots = new Set(tabRoots);
        const atRoot = roots.has(location.pathname) || location.pathname === loginPath;
        if (!atRoot && (canGoBack || window.history.length > 1)) {
          navigate(-1);
          return;
        }
        void App.minimizeApp();
      });
      if (cancelled) {
        await listener.remove();
        return;
      }
      handle = listener;
    });

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [location.pathname, loginPath, navigate, tabRoots]);

  return null;
}
