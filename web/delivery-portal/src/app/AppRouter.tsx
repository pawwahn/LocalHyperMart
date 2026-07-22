import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@hlm-theme';
import { AuthProvider, useAuth } from '@/shared/auth/AuthContext';
import { RequireAuth } from '@/shared/routing/RequireAuth';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { HubDashboardPage } from '@/features/hub/pages/HubDashboardPage';
import { HubAgentsPage } from '@/features/hub/pages/HubAgentsPage';
import { HubClaimsPage } from '@/features/hub/pages/HubClaimsPage';
import { HubReportsPage } from '@/features/hub/pages/HubReportsPage';
import { AgentHomePage } from '@/features/agent/pages/AgentHomePage';
import { AgentVendorPickupsPage } from '@/features/agent/pages/AgentVendorPickupsPage';
import { AgentBuyerDeliveriesPage } from '@/features/agent/pages/AgentBuyerDeliveriesPage';
import { AgentHistoryPage } from '@/features/agent/pages/AgentHistoryPage';

function HomeRedirect() {
  const { session, isAuthenticated } = useAuth();
  if (!isAuthenticated || !session) return <Navigate to="/login" replace />;
  return <Navigate to={session.portalRole === 'HUB_ADMIN' ? '/hub' : '/agent'} replace />;
}

export function AppRouter() {
  return (
    <ThemeProvider storageKey="hlm.delivery.theme" defaultAccent="ocean">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth role="HUB_ADMIN" />}>
              <Route path="/hub" element={<HubDashboardPage />} />
              <Route path="/hub/boys" element={<HubAgentsPage />} />
              <Route path="/hub/claims" element={<HubClaimsPage />} />
              <Route path="/hub/reports" element={<HubReportsPage />} />
            </Route>
            <Route element={<RequireAuth role="DELIVERY_AGENT" />}>
              <Route path="/agent" element={<AgentHomePage />} />
              <Route path="/agent/pickups" element={<AgentVendorPickupsPage />} />
              <Route path="/agent/deliveries" element={<AgentBuyerDeliveriesPage />} />
              <Route path="/agent/history" element={<AgentHistoryPage />} />
            </Route>
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
