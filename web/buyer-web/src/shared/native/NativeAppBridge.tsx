import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from './bootstrapNativeApp';

const TAB_ROOTS = new Set(['/shop', '/categories', '/cart', '/wallet', '/more']);

/**
 * Android system Back: one screen back, or leave the app from a tab root.
 * This is a large part of “feels like a real app”.
 */
export function NativeAppBridge() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    let handle: { remove: () => Promise<void> } | null = null;

    void import('@capacitor/app').then(async ({ App }) => {
      const listener = await App.addListener('backButton', ({ canGoBack }) => {
        const atRoot = TAB_ROOTS.has(location.pathname) || location.pathname === '/login';
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
  }, [location.pathname, navigate]);

  return null;
}
