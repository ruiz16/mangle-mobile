import { Route, Switch, useLocation } from 'wouter';
import { AppStateProvider, useAppState } from './context/AppState';
import BottomNav from './components/BottomNav';
import Toast from './components/Toast';
import Splash from './pages/Splash';
import Connect from './pages/Connect';
import Register from './pages/Register';
import Education from './pages/Education';
import Request from './pages/Request';
import Repayment from './pages/Repayment';
import Credential from './pages/Credential';
import Gacc from './pages/Gacc';
import Dev from './pages/Dev';
import type { NavTab } from './types';

// =============================================================================
// Mobile shell that wraps pages with status bar + bottom nav
// =============================================================================

function MobileShell({ children, showNav }: { children: React.ReactNode; showNav: boolean }) {
  const [, navigate] = useLocation();
  const { state } = useAppState();

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
    <div className="flex-1 bg-[#FBF9F4] rounded-[36px] overflow-hidden flex flex-col relative">
      {/* Status bar */}
      <div className="flex justify-between items-center px-6 pt-3 pb-1 text-slate-800 text-[11px] font-bold z-40">
        <span>{new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] bg-[#2A5C3C] text-white font-extrabold px-1.5 py-0.5 rounded leading-none">MiniPay</span>
          <i className="fa-solid fa-signal" />
          <i className="fa-solid fa-wifi" />
          <i className="fa-solid fa-battery-full text-xs" />
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto flex flex-col no-scrollbar">
        {children}
      </div>

      {/* Bottom Nav */}
      {showNav && (
        <BottomNav activeTab={currentTab} onNavigate={handleNav} alertDot={state.nodeAlert} />
      )}

      {/* Toast */}
      <Toast />
    </div>
  );
}

// =============================================================================
// App Root
// =============================================================================

export default function App() {
  return (
    <AppStateProvider>
      <div className="h-full flex flex-col bg-slate-950">
        <Switch>
          <Route path="/dev">
            <MobileShell showNav={false}>
              <Dev />
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
      </div>
    </AppStateProvider>
  );
}
