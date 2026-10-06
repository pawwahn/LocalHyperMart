import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { applyBrandFavicon } from './applyBrandAssets';
import { fetchPlatformBrandPublic, resolveBrandLogoSrc, type PlatformBrandPublic } from './platformBrandApi';

type BrandState = PlatformBrandPublic & {
  logoSrc: string;
  loading: boolean;
  refresh: () => Promise<void>;
};

const DEFAULT: PlatformBrandPublic = {
  brandLogoUrl: '',
  brandLogoMediaId: '',
  appName: 'KoyaKart',
};

const PlatformBrandContext = createContext<BrandState>({
  ...DEFAULT,
  logoSrc: '',
  loading: true,
  refresh: async () => {},
});

export function PlatformBrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<PlatformBrandPublic>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setBrand(await fetchPlatformBrandPublic());
    } catch {
      setBrand(DEFAULT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logoSrc = useMemo(() => resolveBrandLogoSrc(brand.brandLogoUrl), [brand.brandLogoUrl]);

  useEffect(() => {
    applyBrandFavicon(brand.brandLogoUrl);
  }, [brand.brandLogoUrl]);

  const value = useMemo(
    () => ({
      ...brand,
      logoSrc,
      loading,
      refresh,
    }),
    [brand, logoSrc, loading, refresh],
  );

  return <PlatformBrandContext.Provider value={value}>{children}</PlatformBrandContext.Provider>;
}

export function usePlatformBrand(): BrandState {
  return useContext(PlatformBrandContext);
}
