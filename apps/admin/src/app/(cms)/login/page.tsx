'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = form.get('email') as string;
    const password = form.get('password') as string;

    try {
      const result = await api.login({ email, password });
      login(result.accessToken, result.admin);

      if (result.admin.mustResetPassword) {
        router.push('/reset-password');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'Anmeldung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex justify-center mb-6">
          <Image src="/logo-main.png" alt="HoppDrive" width={180} height={60} className="h-14 w-auto" />
        </div>
        <h2 className="text-2xl font-bold text-center mb-2">CMS Portal</h2>
        <p className="text-neutral-500 text-center text-sm mb-8">
          Nur für autorisiertes Personal.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                E-Mail
              </label>
              <input
                required
                name="email"
                type="email"
                className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="admin@hoppdrive.ch"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Passwort
              </label>
              <input
                required
                name="password"
                type="password"
                className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-bold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Anmeldung läuft...' : 'Sicher anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}
