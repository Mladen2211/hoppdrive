'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

interface ContactFormProps {
  preselectedVehicle?: string | null;
  vehicleNames: string[];
}

export function ContactForm({ preselectedVehicle, vehicleNames }: ContactFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const data = {
      fullName: form.get('fullName') as string,
      phone: form.get('phone') as string,
      email: form.get('email') as string,
      vehicleOfInterest: form.get('vehicleOfInterest') as string || undefined,
      desiredStartDate: form.get('desiredStartDate')
        ? new Date(form.get('desiredStartDate') as string).toISOString()
        : undefined,
      desiredEndDate: form.get('desiredEndDate')
        ? new Date(form.get('desiredEndDate') as string).toISOString()
        : undefined,
      message: form.get('message') as string,
      privacyConsent: form.get('privacyConsent') === 'on',
      marketingConsent: form.get('marketingConsent') === 'on',
    };

    try {
      await api.submitContact(data);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <section id="contact-form" className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-neutral-900 text-white rounded-3xl p-8 md:p-12 shadow-2xl text-center">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-2">Vielen Dank!</h2>
            <p className="text-neutral-400">
              Ihre Anfrage wurde erfolgreich übermittelt. Unser Team wird sich innerhalb von 24 Stunden bei Ihnen melden.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="contact-form" className="py-24 bg-white relative">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-neutral-900 text-white rounded-3xl p-8 md:p-12 shadow-2xl">
          <h2 className="text-3xl font-bold mb-2">Angebot anfragen</h2>
          <p className="text-neutral-400 mb-8">
            Füllen Sie das Formular aus. Unser Team wird sich innerhalb von 24 Stunden mit einem individuellen Angebot bei Ihnen melden.
          </p>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Vollständiger Name *
                </label>
                <input
                  required
                  name="fullName"
                  type="text"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Max Muster"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Telefonnummer *
                </label>
                <input
                  required
                  name="phone"
                  type="tel"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="+41 79 123 45 67"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                E-Mail-Adresse *
              </label>
              <input
                required
                name="email"
                type="email"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="max@beispiel.ch"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Fahrzeug von Interesse
              </label>
              <select
                name="vehicleOfInterest"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
                defaultValue={preselectedVehicle ?? ''}
              >
                <option value="">Kein bestimmtes Fahrzeug</option>
                {vehicleNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Desired rental dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Gewünschtes Startdatum
                </label>
                <input
                  name="desiredStartDate"
                  type="date"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Gewünschtes Enddatum
                </label>
                <input
                  name="desiredEndDate"
                  type="date"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 [color-scheme:dark]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Nachricht
              </label>
              <textarea
                required
                name="message"
                rows={4}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Ich möchte ein Fahrzeug mieten ab..."
              />
            </div>

            {/* FADP/GDPR Mandatory Privacy Consent */}
            <div className="flex items-start gap-3 p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
              <div className="flex items-center h-5 mt-0.5">
                <input
                  required
                  name="privacyConsent"
                  id="privacy_consent"
                  type="checkbox"
                  className="w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-brand-500 focus:ring-brand-500 focus:ring-offset-neutral-900"
                />
              </div>
              <div className="text-sm">
                <label htmlFor="privacy_consent" className="font-medium text-neutral-200">
                  Datenschutz-Einwilligung *
                </label>
                <p className="text-neutral-400 mt-1 text-xs">
                  Ich willige in die Verarbeitung meiner personenbezogenen Daten (Name, E-Mail, Telefon) zur
                  Bearbeitung dieser Anfrage ein. Die Daten werden sicher verarbeitet und können an
                  unseren E-Mail-Dienstleister (Brevo) übermittelt werden. Weitere Informationen in unserer{' '}
                  <Link href="/privacy" className="text-brand-400 hover:underline">
                    Datenschutzerklärung
                  </Link>.
                </p>
              </div>
            </div>

            {/* Optional Marketing Consent (separate per FADP) */}
            <div className="flex items-start gap-3 p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
              <div className="flex items-center h-5 mt-0.5">
                <input
                  name="marketingConsent"
                  id="marketing_consent"
                  type="checkbox"
                  className="w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-brand-500 focus:ring-brand-500 focus:ring-offset-neutral-900"
                />
              </div>
              <div className="text-sm">
                <label htmlFor="marketing_consent" className="font-medium text-neutral-200">
                  Marketing-Mitteilungen (Optional)
                </label>
                <p className="text-neutral-400 mt-1 text-xs">
                  Ich bin damit einverstanden, Werbe-E-Mails über Sonderangebote und neue Fahrzeuge zu erhalten.
                  Ich kann mich jederzeit abmelden.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg transition-colors shadow-lg shadow-brand-600/20"
            >
              {loading ? 'Wird gesendet...' : 'Anfrage absenden'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
