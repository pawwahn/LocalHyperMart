import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyStoredTheme } from '@hlm-theme';
import { injectGlobalStyles } from '@/shared/theme/globalStyles';
import { AppRouter } from '@/app/AppRouter';

injectGlobalStyles();
applyStoredTheme('hlm.vendor.theme', 'forest');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
