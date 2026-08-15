import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/authApi';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  ensureNotificationPermission,
  unlockOrderAlertAudio,
} from '@/features/orders/lib/orderAlertSound';

export function useLoginForm() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('9876500001');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setSubmitting(true);
    // Unlock during the Sign in click — browsers only allow autoplay after a gesture.
    // Do this before any network await so the gesture is not lost.
    void unlockOrderAlertAudio();
    void ensureNotificationPermission();
    try {
      const session = await login(phone.trim(), password);
      setSession(session);
      // Retry unlock after login in case the first attempt raced with audio load.
      await unlockOrderAlertAudio();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return { phone, setPhone, password, setPassword, error, submitting, submit };
}
