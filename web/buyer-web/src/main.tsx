import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme } from '@hlm-theme';
import { injectGlobalStyles } from '@/shared/theme/globalStyles';
import { AppRouter } from '@/app/AppRouter';

injectGlobalStyles();
applyTheme({ mode: 'dark', accent: 'ocean' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
