import { routerBasename } from '../../../shared/routerBasename';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PlatformBrandProvider } from '@hlm-brand';
import { ThemeProvider } from '@hlm-theme';
import { readDeliveryShell } from '@hlm-native';
import { AuthProvider, useAuth } from '@/shared/auth/AuthContext';
import { resolvePortalRole } from '@/shared/auth/session';
import { RequireAuth } from '@/shared/routing/RequireAuth';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { WrongAppShellPage } from '@/features/auth/pages/WrongAppShellPage';
import { LegalDocumentPage } from '@hlm-legal';
import { HubDashboardPage } from '@/features/hub/pages/HubDashboardPage';
import { HubAgentsPage } from '@/features/hub/pages/HubAgentsPage';
import { HubCodPage } from '@/features/hub/pages/HubCodPage';
import { HubMembershipPage } from '@/features/hub/pages/HubMembershipPage';
import { HubClaimsPage } from '@/features/hub/pages/HubClaimsPage';
import { HubReportsPage } from '@/features/hub/pages/HubReportsPage';
import { HubIncentivesPage } from '@/features/hub/pages/HubIncentivesPage';
import { HubAccountPage } from '@/features/hub/pages/HubAccountPage';
import { AgentHomePage } from '@/features/agent/pages/AgentHomePage';
import { AgentVendorPickupsPage } from '@/features/agent/pages/AgentVendorPickupsPage';
import { AgentBuyerDeliveriesPage } from '@/features/agent/pages/AgentBuyerDeliveriesPage';
import { AgentHistoryPage } from '@/features/agent/pages/AgentHistoryPage';
import { AgentPayPage } from '@/features/agent/pages/AgentPayPage';
import { AgentCodHandoverPage } from '@/features/agent/pages/AgentCodHandoverPage';
import { AgentAssignmentAlertProvider } from '@/features/agent/context/AgentAssignmentAlertContext';
import { DeliveryNativeBridge } from '@/shared/native/DeliveryNativeBridge';

function HomeRedirect() {
  const { session, isAuthenticated } = useAuth();
  const shell = readDeliveryShell();
  if (!isAuthenticated || !session) return <Navigate to="/login" replace />;
  const portalRole = resolvePortalRole(session);
  if (!portalRole) return <Navigate to="/login" replace />;

  if (shell === 'hub') {
    if (portalRole !== 'HUB_ADMIN') return <Navigate to="/wrong-app" replace />;
    return <Navigate to="/hub" replace />;
  }
  if (shell === 'agent') {
    if (portalRole !== 'DELIVERY_AGENT') return <Navigate to="/wrong-app" replace />;
    return <Navigate to="/agent" replace />;
  }

  return <Navigate to={portalRole === 'HUB_ADMIN' ? '/hub' : '/agent'} replace />;
}

export function AppRouter() {
  const shell = readDeliveryShell();
  const showHub = shell === 'all' || shell === 'hub';
  const showAgent = shell === 'all' || shell === 'agent';

  return (
    <ThemeProvider storageKey="hlm.koyakart.delivery.theme" defaultAccent="forest">
      <PlatformBrandProvider>
        <AuthProvider>
          <BrowserRouter basename={routerBasename()}>
            <AgentAssignmentAlertProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/wrong-app" element={<WrongAppShellPage />} />
                <Route path="/legal/:doc" element={<LegalDocumentPage homeTo="/login" />} />
                {showHub ? (
                  <Route element={<RequireAuth role="HUB_ADMIN" />}>
                    <Route path="/hub" element={<HubDashboardPage />} />
                    <Route path="/hub/boys" element={<HubAgentsPage />} />
                    <Route path="/hub/cod" element={<HubCodPage />} />
                    <Route path="/hub/memberships" element={<HubMembershipPage />} />
                    <Route path="/hub/claims" element={<HubClaimsPage />} />
                    <Route path="/hub/reports" element={<HubReportsPage />} />
                    <Route path="/hub/accounts" element={<HubAccountPage />} />
                    <Route path="/hub/incentives" element={<HubIncentivesPage />} />
                  </Route>
                ) : null}
                {showAgent ? (
                  <Route element={<RequireAuth role="DELIVERY_AGENT" />}>
                    <Route path="/agent" element={<AgentHomePage />} />
                    <Route path="/agent/pickups" element={<AgentVendorPickupsPage />} />
                    <Route path="/agent/deliveries" element={<AgentBuyerDeliveriesPage />} />
                    <Route path="/agent/history" element={<AgentHistoryPage />} />
                    <Route path="/agent/pay" element={<AgentPayPage />} />
                    <Route path="/agent/cod-handover" element={<AgentCodHandoverPage />} />
                  </Route>
                ) : null}
                <Route path="*" element={<HomeRedirect />} />
              </Routes>
              <DeliveryNativeBridge />
            </AgentAssignmentAlertProvider>
          </BrowserRouter>
        </AuthProvider>
      </PlatformBrandProvider>
    </ThemeProvider>
  );
}
