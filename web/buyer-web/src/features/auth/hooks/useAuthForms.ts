import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loginBuyer, registerBuyer } from '../api/authApi';
import {
  getPublicPlatformSettings,
  type PublicPlatformSettingsVm,
} from '../api/platformSettingsApi';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';

export function useAuthForms() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [referralCode, setReferralCode] = useState(() => searchParams.get('ref')?.trim() ?? '');
  const [phone, setPhone] = useState('9876511111');
  // Seeded pilot buyer (9876511111) uses "password". For new register, use e.g. Buyer@123.
  const [password, setPassword] = useState('password');
  const [firstName, setFirstName] = useState('Test');
  const [lastName, setLastName] = useState('Buyer');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalVersion, setLegalVersion] = useState(1);
  const [publicSettings, setPublicSettings] = useState<PublicPlatformSettingsVm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void getPublicPlatformSettings()
      .then(setPublicSettings)
      .catch(() => setPublicSettings(null));
  }, []);

  useEffect(() => {
    const ref = searchParams.get('ref')?.trim();
    if (ref) {
      setReferralCode(ref);
      setMode('register');
    }
  }, [searchParams]);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'register') {
        if (!acceptedTerms) {
          setError('Read and accept Terms, Privacy, and Refund policy to register');
          return;
        }
        await registerBuyer({
          phone: phone.trim(),
          password,
          firstName,
          lastName,
          acceptedTerms: true,
          acceptedLegalVersion: legalVersion,
          referralCode: referralCode.trim() || undefined,
        });
      }
      const session = await loginBuyer(phone.trim(), password);
      setSession(session);
      navigate('/welcome', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setSubmitting(false);
    }
  }

  return {
    mode,
    setMode,
    phone,
    setPhone,
    password,
    setPassword,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    acceptedTerms,
    setAcceptedTerms,
    setLegalVersion,
    publicSettings,
    referralCode,
    setReferralCode,
    error,
    submitting,
    submit,
  };
}
