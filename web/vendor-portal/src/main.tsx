import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme } from '@hlm-theme';
import { injectGlobalStyles } from '@/shared/theme/globalStyles';
import { AppRouter } from '@/app/AppRouter';
import { bootstrapNativeApp } from '@hlm-native';

injectGlobalStyles();
applyTheme({ mode: 'light', accent: 'forest' });
void bootstrapNativeApp({ statusBarColor: '#1B8B4C' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
