'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const newPassword = form.get('newPassword') as string;
    const confirmPassword = form.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      setLoading(false);
      return;
    }

    if (newPassword.length < 12) {
      setError('Passwort muss mindestens 12 Zeichen lang sein');
      setLoading(false);
      return;
    }

    try {
      await api.resetPassword({ newPassword });
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Passwort-Änderung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="bg-amber-100 p-3 rounded-full">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-2">Passwortänderung erforderlich</h2>
        <p className="text-neutral-500 text-center text-sm mb-8">
          Sie müssen ein neues Passwort festlegen, bevor Sie auf das CMS zugreifen können. Mindestens 12 Zeichen.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Neues Passwort
            </label>
            <input
              required
              name="newPassword"
              type="password"
              minLength={12}
              className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Passwort bestätigen
            </label>
            <input
              required
              name="confirmPassword"
              type="password"
              minLength={12}
              className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-bold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Wird aktualisiert...' : 'Neues Passwort festlegen'}
          </button>
        </form>
      </div>
    </div>
  );
}
