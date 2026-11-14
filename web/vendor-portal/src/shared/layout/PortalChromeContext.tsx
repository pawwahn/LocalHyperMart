import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
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
  /** @internal bound by usePortalChrome */
  bindRefresh: (handler: (() => void) | undefined) => void;
  bindShopPause: (pause: ShopPauseControl | undefined) => void;
  setTitle: (title: string) => void;
};

const PortalChromeContext = createContext<PortalChromeContextValue | null>(null);

const DEFAULT_CONFIG: PortalChromeConfig = { title: 'Vendor' };

export function PortalChromeProvider({ children }: { children: ReactNode }) {
  const refreshHandlerRef = useRef<(() => void) | undefined>();
  const shopPauseHandlerRef = useRef<(() => void) | undefined>();
  const shopPauseMetaRef = useRef<{ acceptingOrders: boolean; busy?: boolean } | undefined>();

  const [title, setTitle] = useState(DEFAULT_CONFIG.title);
  const [hasRefresh, setHasRefresh] = useState(false);
  const [shopPauseUi, setShopPauseUi] = useState<{
    acceptingOrders: boolean;
    busy?: boolean;
  } | null>(null);

  const invokeRefresh = useCallback(() => {
    refreshHandlerRef.current?.();
  }, []);

  const bindRefresh = useCallback((handler: (() => void) | undefined) => {
    refreshHandlerRef.current = handler;
    setHasRefresh(Boolean(handler));
  }, []);

  const bindShopPause = useCallback((pause: ShopPauseControl | undefined) => {
    if (!pause) {
      shopPauseHandlerRef.current = undefined;
      shopPauseMetaRef.current = undefined;
      setShopPauseUi(null);
      return;
    }
    shopPauseHandlerRef.current = pause.onToggle;
    shopPauseMetaRef.current = {
      acceptingOrders: pause.acceptingOrders,
      busy: pause.busy,
    };
    setShopPauseUi({
      acceptingOrders: pause.acceptingOrders,
      busy: pause.busy,
    });
  }, []);

  const config: PortalChromeConfig = useMemo(
    () => ({
      title,
      onRefresh: hasRefresh ? invokeRefresh : undefined,
      shopPause: shopPauseUi
        ? {
            acceptingOrders: shopPauseUi.acceptingOrders,
            busy: shopPauseUi.busy,
            onToggle: () => shopPauseHandlerRef.current?.(),
          }
        : undefined,
    }),
    [title, hasRefresh, shopPauseUi, invokeRefresh],
  );

  const value = useMemo(
    () => ({
      config,
      bindRefresh,
      bindShopPause,
      setTitle,
    }),
    [config, bindRefresh, bindShopPause],
  );

  return <PortalChromeContext.Provider value={value}>{children}</PortalChromeContext.Provider>;
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

  const { bindRefresh, bindShopPause, setTitle } = ctx;
  const hasRefresh = Boolean(config.onRefresh);
  const acceptingOrders = config.shopPause?.acceptingOrders;
  const shopBusy = config.shopPause?.busy;
  const hasShopPause = Boolean(config.shopPause);

  useLayoutEffect(() => {
    if (!active) return;
    setTitle(config.title);
    bindRefresh(hasRefresh ? () => onRefreshRef.current?.() : undefined);
    bindShopPause(
      hasShopPause
        ? {
            acceptingOrders: acceptingOrders ?? true,
            busy: shopBusy,
            onToggle: () => shopPauseRef.current?.onToggle(),
          }
        : undefined,
    );
    return () => {
      bindRefresh(undefined);
      bindShopPause(undefined);
    };
  }, [
    active,
    config.title,
    hasRefresh,
    hasShopPause,
    acceptingOrders,
    shopBusy,
    setTitle,
    bindRefresh,
    bindShopPause,
  ]);
}

export function usePortalChromeState(): PortalChromeConfig {
  const ctx = useContext(PortalChromeContext);
  if (!ctx) {
    throw new Error('usePortalChromeState requires PortalChromeProvider');
  }
  return ctx.config;
}
