import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyStoredTheme } from '@hlm-theme';
import { injectGlobalStyles } from '@/shared/theme/globalStyles';
import { AppRouter } from '@/app/AppRouter';
import { bootstrapNativeApp, readDeliveryShell } from '@hlm-native';

injectGlobalStyles();
applyStoredTheme('hlm.koyakart.delivery.theme', 'forest');

const shell = readDeliveryShell();
const statusBarColor = shell === 'agent' ? '#0f766e' : shell === 'hub' ? '#2563eb' : '#2563eb';
void bootstrapNativeApp({ statusBarColor });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
