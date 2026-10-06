import {

  createContext,

  useCallback,

  useContext,

  useEffect,

  useRef,

  useState,

  type CSSProperties,
  type ReactNode,

} from 'react';

import { useAuth } from '@/shared/auth/AuthContext';

import {
  acknowledgeAgentShopAlert,
  fetchMyAssignments,
  fetchPendingAgentShopAlerts,
  toAssignmentView,
  type AgentShopAlertDto,
  type AssignmentView,
} from '../api/agentApi';

import { AgentNewAssignmentDialog } from '../components/AgentNewAssignmentDialog';
import { AgentShopReminderDialog } from '../components/AgentShopReminderDialog';

import {

  ensureNotificationPermission,

  notifyAgentAssignment,

  startAssignmentAlertLoop,

  stopAssignmentAlertLoop,

  subscribeAssignmentAlertAudio,

  unlockAssignmentAlertAudio,

} from '../lib/assignmentAlertSound';



const POLL_MS_DESKTOP = 10_000;

const POLL_MS_MOBILE = 5_000;

const DEFAULT_ALERT_LABEL = 'New job';



function agentPollIntervalMs(): number {

  if (typeof window === 'undefined') return POLL_MS_DESKTOP;

  const mobile =

    window.matchMedia('(pointer: coarse)').matches ||

    window.matchMedia('(max-width: 767px)').matches ||

    window.matchMedia('(display-mode: standalone)').matches;

  return mobile ? POLL_MS_MOBILE : POLL_MS_DESKTOP;

}



function legHintFor(job: AssignmentView): string | null {

  if (job.legType === 'PICKUP') return 'Pick up from shop → hub';

  if (job.legType === 'LAST_MILE') return 'Deliver to customer home';

  if (job.legType === 'VENDOR_DIRECT') return 'Shop → customer home';

  return null;

}



type AgentAssignmentAlertContextValue = {

  /** Bumps when a new active assignment appears — agent pages can refresh lists. */

  assignAlertVersion: number;

  soundReady: boolean;

  notificationsReady: boolean;

  enableSound: () => Promise<boolean>;

  enableNotifications: () => Promise<boolean>;

};



const AgentAssignmentAlertContext = createContext<AgentAssignmentAlertContextValue | null>(null);



export function useAgentAssignmentAlert(): AgentAssignmentAlertContextValue {

  const ctx = useContext(AgentAssignmentAlertContext);

  if (!ctx) {

    return {

      assignAlertVersion: 0,

      soundReady: false,

      notificationsReady: false,

      enableSound: async () => false,

      enableNotifications: async () => false,

    };

  }

  return ctx;

}



export function AgentAssignmentAlertProvider({ children }: { children: ReactNode }) {

  const { session, isAuthenticated } = useAuth();

  const isAgent = isAuthenticated && session?.portalRole === 'DELIVERY_AGENT';

  const [assignAlertVersion, setAssignAlertVersion] = useState(0);

  const [soundReady, setSoundReady] = useState(false);

  const [notificationsReady, setNotificationsReady] = useState(

    () => typeof Notification !== 'undefined' && Notification.permission === 'granted',

  );

  const [dialogJob, setDialogJob] = useState<AssignmentView | null>(null);

  const [shopReminder, setShopReminder] = useState<AgentShopAlertDto | null>(null);

  const [shopAckBusy, setShopAckBusy] = useState(false);

  const alertQueue = useRef<AssignmentView[]>([]);



  const knownIds = useRef<Set<string>>(new Set());

  const seeded = useRef(false);

  const knownShopAlertIds = useRef<Set<string>>(new Set());

  const shopAlertsSeeded = useRef(false);



  const enableNotifications = useCallback(async () => {

    const ok = await ensureNotificationPermission();

    setNotificationsReady(ok);

    return ok;

  }, []);



  const enableSound = useCallback(async () => {

    const ok = await unlockAssignmentAlertAudio();

    if (ok && dialogJob) {

      const label = dialogJob.subOrderNumber || dialogJob.orderNumber || DEFAULT_ALERT_LABEL;

      startAssignmentAlertLoop(`New delivery. ${label}`);

    }

    return ok;

  }, [dialogJob]);



  const showNextDialog = useCallback(() => {

    const next = alertQueue.current.shift() ?? null;

    setDialogJob(next);

    if (next) {

      const label = next.subOrderNumber || next.orderNumber || 'New job';

      startAssignmentAlertLoop(`New delivery. ${label}`);

    } else {

      stopAssignmentAlertLoop();

    }

  }, []);



  const acknowledgeDialog = useCallback(() => {

    stopAssignmentAlertLoop();

    if (alertQueue.current.length > 0) {

      showNextDialog();

    } else {

      setDialogJob(null);

    }

  }, [showNextDialog]);



  const fireNewAssignments = useCallback((newcomers: AssignmentView[]) => {

    if (newcomers.length === 0) return;

    setAssignAlertVersion((v) => v + 1);



    for (const job of newcomers) {

      const label = job.subOrderNumber || job.orderNumber;

      notifyAgentAssignment(

        'KoyaKart — New delivery',

        label ? `Assigned: ${label}` : 'You have a new delivery job',

      );

    }

    void enableNotifications();



    alertQueue.current.push(...newcomers);

    if (!dialogJob) {

      showNextDialog();

    }

  }, [dialogJob, enableNotifications, showNextDialog]);



  useEffect(() => subscribeAssignmentAlertAudio(setSoundReady), []);



  useEffect(() => {

    if (!isAgent) {

      stopAssignmentAlertLoop();

      setDialogJob(null);

      alertQueue.current = [];

    }

  }, [isAgent]);



  useEffect(() => {

    if (!isAgent || soundReady) return;

    const unlock = () => {

      void unlockAssignmentAlertAudio();

    };

    document.addEventListener('pointerdown', unlock, { passive: true });

    document.addEventListener('keydown', unlock);

    document.addEventListener('touchstart', unlock, { passive: true });

    return () => {

      document.removeEventListener('pointerdown', unlock);

      document.removeEventListener('keydown', unlock);

      document.removeEventListener('touchstart', unlock);

    };

  }, [isAgent, soundReady]);



  useEffect(() => {

    if (!isAgent || !session?.accessToken) {

      knownIds.current = new Set();

      seeded.current = false;

      knownShopAlertIds.current = new Set();

      shopAlertsSeeded.current = false;

      setShopReminder(null);

      return;

    }



    let cancelled = false;

    const pollMs = agentPollIntervalMs();



    async function poll() {

      if (cancelled) return;

      try {

        const list = await fetchMyAssignments(session!.accessToken, {

          scope: 'active',

          page: 0,

          size: 100,

        });

        if (cancelled) return;

        const open = (list.items ?? [])

          .map(toAssignmentView)

          .filter((a) => a.status === 'ASSIGNED' || a.status === 'IN_PROGRESS');

        const currentIds = new Set(open.map((a) => a.id));



        if (!seeded.current) {

          knownIds.current = currentIds;

          seeded.current = true;

          return;

        }



        const newcomers = open.filter((a) => !knownIds.current.has(a.id));

        knownIds.current = currentIds;



        if (newcomers.length > 0) {

          fireNewAssignments(newcomers);

        }

        const shopAlerts = await fetchPendingAgentShopAlerts(session!.accessToken);

        if (cancelled) return;

        const shopIds = new Set(shopAlerts.map((a) => a.alertId));

        if (!shopAlertsSeeded.current) {

          knownShopAlertIds.current = shopIds;

          shopAlertsSeeded.current = true;

          if (shopAlerts.length > 0 && !dialogJob) {

            setShopReminder(shopAlerts[0]);

            startAssignmentAlertLoop(

              `${shopAlerts[0].shopName ?? 'Shop'} is calling you for ${shopAlerts[0].subOrderNumber ?? 'delivery'}`,

            );

          }

        } else {

          const newShopAlerts = shopAlerts.filter((a) => !knownShopAlertIds.current.has(a.alertId));

          knownShopAlertIds.current = shopIds;

          if (newShopAlerts.length > 0) {

            setAssignAlertVersion((v) => v + 1);

            const first = newShopAlerts[0];

            const label = first.subOrderNumber || first.orderNumber || 'delivery';

            notifyAgentAssignment(

              'KoyaKart — Shop calling',

              `${first.shopName ?? 'Shop'} needs you for ${label}`,

            );

            void enableNotifications();

            setShopReminder(first);

            startAssignmentAlertLoop(`${first.shopName ?? 'Shop'} is calling you for ${label}`);

          }

        }

      } catch {

        /* ignore transient poll errors */

      }

    }



    void poll();

    const timer = window.setInterval(() => void poll(), pollMs);

    const onVisible = () => {

      if (!document.hidden) void poll();

    };

    const onFocus = () => void poll();

    document.addEventListener('visibilitychange', onVisible);

    window.addEventListener('focus', onFocus);

    window.addEventListener('pageshow', onFocus);



    return () => {

      cancelled = true;

      window.clearInterval(timer);

      document.removeEventListener('visibilitychange', onVisible);

      window.removeEventListener('focus', onFocus);

      window.removeEventListener('pageshow', onFocus);

    };

  }, [isAgent, session?.accessToken, fireNewAssignments, dialogJob, enableNotifications]);

  const acknowledgeShopReminder = useCallback(async () => {

    if (!session?.accessToken || !shopReminder) return;

    setShopAckBusy(true);

    try {

      await acknowledgeAgentShopAlert(session.accessToken, shopReminder.alertId);

      stopAssignmentAlertLoop();

      setShopReminder(null);

      setAssignAlertVersion((v) => v + 1);

    } catch {

      /* keep dialog open */

    } finally {

      setShopAckBusy(false);

    }

  }, [session?.accessToken, shopReminder]);



  const value: AgentAssignmentAlertContextValue = {

    assignAlertVersion,

    soundReady,

    notificationsReady,

    enableSound,

    enableNotifications,

  };



  const dialogLabel =

    dialogJob?.subOrderNumber || dialogJob?.orderNumber || 'New delivery job';



  return (

    <AgentAssignmentAlertContext.Provider value={value}>

      {children}

      {isAgent && !notificationsReady ? (

        <div style={bannerStyles.wrap} role="status">

          <span style={bannerStyles.text}>Allow notifications for alerts when the app is in background.</span>

          <button type="button" style={bannerStyles.btn} onClick={() => void enableNotifications()}>

            Enable

          </button>

        </div>

      ) : null}

      <AgentNewAssignmentDialog

        open={Boolean(dialogJob)}

        orderLabel={dialogLabel}

        legHint={dialogJob ? legHintFor(dialogJob) : null}

        soundReady={soundReady}

        onEnableSound={() => void enableSound()}

        onAcknowledge={acknowledgeDialog}

      />

      <AgentShopReminderDialog

        open={Boolean(shopReminder) && !dialogJob}

        shopName={shopReminder?.shopName?.trim() || 'Shop'}

        bagNumber={shopReminder?.subOrderNumber}

        soundReady={soundReady}

        busy={shopAckBusy}

        onEnableSound={() => void enableSound()}

        onAcknowledge={() => void acknowledgeShopReminder()}

      />

    </AgentAssignmentAlertContext.Provider>

  );

}



const bannerStyles: Record<string, CSSProperties> = {

  wrap: {

    position: 'fixed',

    left: '50%',

    transform: 'translateX(-50%)',

    bottom: 'calc(var(--tabbar-h, 3.5rem) + env(safe-area-inset-bottom, 0px) + 0.35rem)',

    zIndex: 45,

    width: 'min(calc(100% - 1rem), var(--shell-max, 28rem))',

    display: 'flex',

    alignItems: 'center',

    gap: '0.5rem',

    padding: '0.45rem 0.6rem',

    borderRadius: 10,

    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-elevated))',

    border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',

    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.12)',

    fontSize: '0.72rem',

    fontWeight: 650,

    lineHeight: 1.25,

  },

  text: { flex: 1, minWidth: 0, color: 'var(--text)' },

  btn: {

    flexShrink: 0,

    border: 'none',

    borderRadius: 8,

    padding: '0.35rem 0.55rem',

    background: 'var(--accent)',

    color: '#fff',

    fontWeight: 800,

    fontSize: '0.72rem',

    cursor: 'pointer',

  },

};


