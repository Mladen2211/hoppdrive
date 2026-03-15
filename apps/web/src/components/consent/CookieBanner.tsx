'use client';

import { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { useConsent } from './CookieConsentProvider';

export function CookieBanner() {
  const { acceptAll, declineNonEssential, savePreferences } = useConsent();
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 bg-white border-t border-neutral-200 shadow-2xl">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-brand-600" />
              <h3 className="font-semibold text-lg">Datenschutz &amp; Cookies</h3>
            </div>
            <p className="text-sm text-neutral-600">
              Wir verwenden Cookies, um Ihre Erfahrung zu verbessern und unseren Traffic zu analysieren.
              Mit Klick auf &quot;Akzeptieren&quot; stimmen Sie der Verwendung von Cookies gemäss dem
              Schweizer DSG und der EU-DSGVO zu.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3 shrink-0">
            {/* Decline & Accept buttons must be equally prominent (no dark patterns) */}
            <button
              onClick={declineNonEssential}
              className="px-6 py-2.5 rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-100 transition-colors text-sm font-medium"
            >
              Nicht-essenzielle ablehnen
            </button>
            <button
              onClick={acceptAll}
              className="px-6 py-2.5 rounded-md bg-brand-600 text-white hover:bg-brand-700 transition-colors text-sm font-medium shadow-sm"
            >
              Alle Cookies akzeptieren
            </button>
          </div>
        </div>

        {/* Granular Preferences Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-3 text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1"
        >
          Einstellungen verwalten
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showDetails && (
          <div className="mt-4 p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked disabled className="w-4 h-4 rounded" />
              <span className="font-medium">Essenziell</span>
              <span className="text-neutral-500">— Immer aktiv (für die Funktion der Website erforderlich)</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="font-medium">Analyse</span>
              <span className="text-neutral-500">— Google Analytics (Traffic-Analyse)</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="font-medium">Marketing</span>
              <span className="text-neutral-500">— Brevo (Werbeinhalte)</span>
            </label>
            <button
              onClick={() => savePreferences({ analytics, marketing })}
              className="mt-2 px-4 py-2 bg-neutral-900 text-white rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors"
            >
              Einstellungen speichern
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
