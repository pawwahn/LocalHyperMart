import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme } from '@hlm-theme';
import { injectGlobalStyles } from '@/shared/theme/globalStyles';
import { AppRouter } from '@/app/AppRouter';

injectGlobalStyles();
// Shared default for guests; personal theme loads only after login.
applyTheme({ mode: 'light', accent: 'forest' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
