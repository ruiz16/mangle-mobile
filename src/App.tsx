import { Route, Switch, useLocation } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queries/client';
import { useEduProgreso } from './queries/educacion';
import { useMiAlerta } from './queries/gacc';
import { AppStateProvider, useAppState } from './context/AppState';
import { useMiniPay } from './hooks/useMiniPay';
import { showToast } from './components/Toast';
import BottomNav from './components/BottomNav';
import Toast from './components/Toast';
import ErrorModal from './components/ErrorModal';
import BackendGuard from './components/BackendGuard';
import WalletChip from './components/WalletChip';
import Splash from './pages/Splash';
import Connect from './pages/Connect';
import Register from './pages/Register';
import Education from './pages/Education';
import Request from './pages/Request';
import Repayment from './pages/Repayment';
import Credential from './pages/Credential';
import Wallet from './pages/Wallet';
import Gacc from './pages/Gacc';
import Dev from './pages/Dev';
import PruebaWallet from './pages/PruebaWallet';
import type { NavTab } from './types';

// =============================================================================
// Constants
// =============================================================================

const CHIP_ROUTES = ['/request', '/repayment'];

// =============================================================================
// Mobile shell that wraps pages with status bar + bottom nav
// =============================================================================

function MobileShell({ children, showNav }: { children: React.ReactNode; showNav: boolean }) {
  const [, navigate] = useLocation();
  const { progress: eduProgress } = useEduProgreso();
  const { alerta: nodeAlerta } = useMiAlerta();

  const handleNav = (tab: NavTab) => {
    const paths: Record<NavTab, string> = {
      education: '/education',
      request: '/request',
      gacc: '/gacc',
      repayment: '/repayment',
      credential: '/credential',
    };
    navigate(paths[tab]);
  };

  // Determine active tab from URL
  const [location] = useLocation();
  const tabMap: Record<string, NavTab> = {
    '/education': 'education',
    '/request': 'request',
    '/gacc': 'gacc',
    '/repayment': 'repayment',
    '/credential': 'credential',
  };
  const currentTab = tabMap[location] ?? 'education';

  return (
    <div className="flex-1 bg-canvas overflow-hidden flex flex-col relative">
      {showNav && CHIP_ROUTES.includes(location) && (
        <div className="absolute top-3 right-4 z-30">
          <WalletChip />
        </div>
      )}

      {/* Status bar */}
      {/* <div className="flex justify-between items-center px-6 pt-3 pb-1 text-slate-800 text-[11px] font-bold z-40">
        <span>{new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] bg-primary text-white font-extrabold px-1.5 py-0.5 rounded leading-none">MiniPay</span>
          <i className="fa-solid fa-signal" />
          <i className="fa-solid fa-wifi" />
          <i className="fa-solid fa-battery-full text-xs" />
        </div>
      </div> */}

      {/* Page content */}
      <div className="flex-1 overflow-y-auto flex flex-col no-scrollbar">
        {children}
      </div>

      {/* Bottom Nav */}
      {showNav && (
        <BottomNav activeTab={currentTab} onNavigate={handleNav} alertDot={nodeAlerta} eduComplete={eduProgress >= 100} />
      )}
    </div>
  );
}

// =============================================================================
// App Root
// =============================================================================

function GlobalOverlays() {
  const { state, clearErrorModal } = useAppState();
  if (!state.errorModal) return null;
  return (
    <ErrorModal
      title={state.errorModal.title}
      message={state.errorModal.message}
      action={state.errorModal.action}
      onClose={clearErrorModal}
    />
  );
}

// =============================================================================
// DisconnectGuard — handles wallet disconnect and network loss globally
// =============================================================================
//
// Always mounted inside AppStateProvider. When the wallet disconnects or the
// browser goes offline while a session is active, clears auth and redirects
// to /connect so the user re-authenticates cleanly.
// =============================================================================

function DisconnectGuard() {
  const { state, clearAuth } = useAppState();
  const [, navigate] = useLocation();

  useMiniPay({
    onDisconnect: () => {
      // Only act if there's an active session — avoids infinite redirects
      // when the event fires on /connect before auth completes.
      if (!state.authToken) return;
      clearAuth();
      navigate('/connect');
      showToast('Sesión cerrada', 'Tu billetera se desconectó o perdiste conexión.', 'info');
    },
  });

  return null;
}

export default function App() {
  return (
    <AppStateProvider>
      <QueryClientProvider client={queryClient}>
      <div className="h-full flex flex-col bg-ink-950">
        <BackendGuard>
          <Toast />
          <GlobalOverlays />
          <DisconnectGuard />
          <Switch>
            
            <Route path="/dev">
              <MobileShell showNav={false}>
                <Dev />
              </MobileShell>
            </Route>

            <Route path="/prueba-wallet">
              <MobileShell showNav={false}>
                <PruebaWallet />
              </MobileShell>
            </Route>

            <Route path="/connect">
              <MobileShell showNav={false}>
                <Connect />
              </MobileShell>
            </Route>

            <Route path="/register">
              <MobileShell showNav={false}>
                <Register />
              </MobileShell>
            </Route>

            <Route path="/education">
              <MobileShell showNav={true}>
                <Education />
              </MobileShell>
            </Route>

            <Route path="/request">
              <MobileShell showNav={true}>
                <Request />
              </MobileShell>
            </Route>

            <Route path="/repayment">
              <MobileShell showNav={true}>
                <Repayment />
              </MobileShell>
            </Route>

            <Route path="/credential">
              <MobileShell showNav={true}>
                <Credential />
              </MobileShell>
            </Route>

            <Route path="/wallet">
              <MobileShell showNav={true}>
                <Wallet />
              </MobileShell>
            </Route>

            <Route path="/gacc">
              <MobileShell showNav={true}>
                <Gacc />
              </MobileShell>
            </Route>

            {/* Splash (default) */}
            <Route>
              <MobileShell showNav={false}>
                <Splash />
              </MobileShell>
            </Route>
          </Switch>
        </BackendGuard>
      </div>
      </QueryClientProvider>
    </AppStateProvider>
  );
}
