import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/authApi';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';

export function useLoginForm() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('9876500900');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const session = await login(phone.trim(), password);
      setSession(session);
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
