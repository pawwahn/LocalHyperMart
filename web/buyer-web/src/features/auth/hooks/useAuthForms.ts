import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginBuyer, registerBuyer } from '../api/authApi';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';

export function useAuthForms() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('9876511111');
  const [password, setPassword] = useState('Buyer@123');
  const [firstName, setFirstName] = useState('Test');
  const [lastName, setLastName] = useState('Buyer');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await registerBuyer({ phone: phone.trim(), password, firstName, lastName });
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
    error,
    submitting,
    submit,
  };
}
