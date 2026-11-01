import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme } from '@hlm-theme';
import { injectGlobalStyles } from '@/shared/theme/globalStyles';
import { AppRouter } from '@/app/AppRouter';
import { bootstrapNativeApp } from '@hlm-native';

applyTheme({ mode: 'light', accent: 'forest' });
injectGlobalStyles();
void bootstrapNativeApp({ statusBarColor: '#009111' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
