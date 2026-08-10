import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('9876511111');
  // Seeded pilot buyer (9876511111) uses "password". For new register, use e.g. Buyer@123.
  const [password, setPassword] = useState('password');
  const [firstName, setFirstName] = useState('Test');
  const [lastName, setLastName] = useState('Buyer');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [publicSettings, setPublicSettings] = useState<PublicPlatformSettingsVm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void getPublicPlatformSettings()
      .then(setPublicSettings)
      .catch(() => setPublicSettings(null));
  }, []);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'register') {
        if (!acceptedTerms) {
          setError('Accept Terms, Privacy, and Refund policy to register');
          return;
        }
        await registerBuyer({
          phone: phone.trim(),
          password,
          firstName,
          lastName,
          acceptedTerms: true,
        });
      }
      const session = await loginBuyer(phone.trim(), password);
      setSession(session);
      navigate('/shop', { replace: true });
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
    publicSettings,
    error,
    submitting,
    submit,
  };
}
