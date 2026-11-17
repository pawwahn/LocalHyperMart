import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { Toast } from '@/shared/ui';
import { FoodHotelPhotosCard } from '../components/FoodHotelPhotosCard';

export function HotelImagesPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const vendorId = session?.vendorId ?? '';
  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'danger'>('success');

  const showToast = useCallback((message: string, tone: 'success' | 'danger') => {
    setToastTone(tone);
    setToast(message);
  }, []);

  usePortalChrome({ title: 'Hotel Images' });

  return (
  <>
    <Toast open={Boolean(toast)} message={toast ?? ''} tone={toastTone} onClose={() => setToast(null)} />

    <p style={{ margin: '0 0 0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
      Buyers see these on your hotel page in Koya Food.{' '}
      <Link to="/food" style={{ color: 'var(--accent)', fontWeight: 700 }}>
        Back to menu
      </Link>
    </p>

    {token && vendorId ? (
      <FoodHotelPhotosCard
        layout="page"
        token={token}
        vendorId={vendorId}
        onToast={(msg) => showToast(msg, 'success')}
        onError={(msg) => showToast(msg, 'danger')}
      />
    ) : null}
  </>
  );
}