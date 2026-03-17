'use client';

import { useEffect, useState, useRef } from 'react';
import { Save, Loader2, Eye, EyeOff, Check, PenTool, RotateCcw, Trash2 } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import dynamic from 'next/dynamic';

const SignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false }) as any;

export default function ProfilePage() {
  const { token, login } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Signature
  const [existingSignature, setExistingSignature] = useState<string | null>(null);
  const [signatureSaving, setSignatureSaving] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const sigRef = useRef<any>(null);
  const [sigIsEmpty, setSigIsEmpty] = useState(true);

  // Password section
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .getProfile()
      .then((data) => {
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        if (data.signatureData) setExistingSignature(data.signatureData);
      })
      .catch(() => setError('Profil konnte nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);

    // Validate password match
    if (newPassword && newPassword !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    if (newPassword && newPassword.length < 12) {
      setError('Passwort muss mindestens 12 Zeichen lang sein.');
      return;
    }
    if (newPassword && !currentPassword) {
      setError('Aktuelles Passwort erforderlich.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = { firstName, lastName, email, phone };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const updated = await api.updateProfile(payload);

      // Update session storage with new admin data
      login(sessionStorage.getItem('accessToken')!, {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        mustResetPassword: updated.mustResetPassword,
      });

      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Mein Profil</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Personal Information */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            Persönliche Daten
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Vorname
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Vorname"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Nachname
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Nachname"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              E-Mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="admin@example.com"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Telefon
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="+41 79 123 45 67"
            />
          </div>
        </div>

        {/* Password Change */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            Passwort ändern
          </h2>
          <p className="text-sm text-neutral-500 mb-4">
            Leer lassen, wenn das Passwort nicht geändert werden soll.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Aktuelles Passwort
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Neues Passwort
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Mind. 12 Zeichen"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Neues Passwort bestätigen
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Company Signature */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-1 flex items-center gap-2">
            <PenTool className="w-5 h-5 text-red-600" />
            Firmenunterschrift
          </h2>
          <p className="text-sm text-neutral-500 mb-4">
            Diese Unterschrift wird automatisch auf allen Mietverträgen im Namen der Firma verwendet.
          </p>

          {existingSignature && (
            <div className="mb-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
              <p className="text-xs text-neutral-500 mb-2 font-medium">Aktuelle Unterschrift</p>
              <img src={existingSignature} alt="Aktuelle Unterschrift" className="max-h-20 bg-white rounded border border-neutral-200 p-2" />
              <button
                type="button"
                onClick={async () => {
                  try {
                    setSignatureSaving(true);
                    await api.updateSignature('');
                    setExistingSignature(null);
                  } catch {
                    setError('Unterschrift konnte nicht gelöscht werden.');
                  } finally {
                    setSignatureSaving(false);
                  }
                }}
                disabled={signatureSaving}
                className="mt-2 flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" /> Unterschrift entfernen
              </button>
            </div>
          )}

          <div className="relative border-2 border-dashed border-neutral-300 rounded-xl bg-neutral-50 overflow-hidden">
            <SignatureCanvas
              ref={sigRef}
              penColor="#1a1a1a"
              canvasProps={{
                className: 'w-full',
                style: { width: '100%', height: '160px' },
              }}
              onBegin={() => setSigIsEmpty(false)}
              onEnd={() => setSigIsEmpty(false)}
            />
            {sigIsEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-neutral-400 text-sm">Neue Unterschrift zeichnen…</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={() => { sigRef.current?.clear(); setSigIsEmpty(true); }}
              disabled={sigIsEmpty}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" /> Löschen
            </button>
            <button
              type="button"
              disabled={signatureSaving}
              onClick={async () => {
                if (!sigRef.current) return;
                // Check if canvas actually has content
                try {
                  if (sigRef.current.isEmpty && sigRef.current.isEmpty()) {
                    setError('Bitte zuerst eine Unterschrift zeichnen.');
                    return;
                  }
                } catch { /* isEmpty() may not exist, proceed anyway */ }
                setSignatureSaving(true);
                setSignatureSaved(false);
                setError('');
                try {
                  // Get data URL from canvas — simple approach, skip manual trim
                  const canvas = sigRef.current.getCanvas() as HTMLCanvasElement;
                  const dataUrl = canvas.toDataURL('image/png');

                  await api.updateSignature(dataUrl);
                  setExistingSignature(dataUrl);
                  sigRef.current?.clear();
                  setSigIsEmpty(true);
                  setSignatureSaved(true);
                  setTimeout(() => setSignatureSaved(false), 3000);
                } catch (err: any) {
                  console.error('Signature save error:', err);
                  setError(err?.message || 'Unterschrift konnte nicht gespeichert werden.');
                } finally {
                  setSignatureSaving(false);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {signatureSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Unterschrift speichern
            </button>
            {signatureSaved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Gespeichert
              </span>
            )}
          </div>
        </div>

        {/* Error / Success */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}
        {saved && (
          <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center gap-2">
            <Check className="w-4 h-4" /> Profil erfolgreich gespeichert.
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-medium py-2.5 px-5 rounded-lg transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Speichern
        </button>
      </form>
    </div>
  );
}
