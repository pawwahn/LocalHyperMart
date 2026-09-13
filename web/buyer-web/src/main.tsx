import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme } from '@hlm-theme';
import { injectGlobalStyles } from '@/shared/theme/globalStyles';
import { AppRouter } from '@/app/AppRouter';

applyTheme({ mode: 'light', accent: 'forest' });
injectGlobalStyles();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
