import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ShopPauseControl = {
  acceptingOrders: boolean;
  busy?: boolean;
  onToggle: () => void;
};

export type PortalChromeConfig = {
  title: string;
  onRefresh?: () => void;
  shopPause?: ShopPauseControl;
};

type PortalChromeContextValue = {
  config: PortalChromeConfig;
  setConfig: (next: PortalChromeConfig) => void;
};

const PortalChromeContext = createContext<PortalChromeContextValue | null>(null);

const DEFAULT_CONFIG: PortalChromeConfig = { title: 'Vendor' };

export function PortalChromeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PortalChromeConfig>(DEFAULT_CONFIG);
  return (
    <PortalChromeContext.Provider value={{ config, setConfig }}>
      {children}
    </PortalChromeContext.Provider>
  );
}

/** Register header title / refresh / pause for the active screen. */
export function usePortalChrome(config: PortalChromeConfig, active = true) {
  const ctx = useContext(PortalChromeContext);
  if (!ctx) {
    throw new Error('usePortalChrome requires PortalChromeProvider');
  }

  const onRefreshRef = useRef(config.onRefresh);
  onRefreshRef.current = config.onRefresh;
  const shopPauseRef = useRef(config.shopPause);
  shopPauseRef.current = config.shopPause;

  const { setConfig } = ctx;
  const hasRefresh = Boolean(config.onRefresh);
  const acceptingOrders = config.shopPause?.acceptingOrders;
  const shopBusy = config.shopPause?.busy;
  const hasShopPause = Boolean(config.shopPause);

  useLayoutEffect(() => {
    if (!active) return;
    setConfig({
      title: config.title,
      onRefresh: hasRefresh ? () => onRefreshRef.current?.() : undefined,
      shopPause: hasShopPause
        ? {
            acceptingOrders: acceptingOrders ?? true,
            busy: shopBusy,
            onToggle: () => shopPauseRef.current?.onToggle(),
          }
        : undefined,
    });
  }, [
    active,
    config.title,
    hasRefresh,
    hasShopPause,
    acceptingOrders,
    shopBusy,
    setConfig,
  ]);
}

export function usePortalChromeState(): PortalChromeConfig {
  const ctx = useContext(PortalChromeContext);
  if (!ctx) {
    throw new Error('usePortalChromeState requires PortalChromeProvider');
  }
  return ctx.config;
}
