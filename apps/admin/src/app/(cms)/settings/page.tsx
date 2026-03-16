'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import { Save, Loader2, Plus, Trash2, Eye, EyeOff } from 'lucide-react';

/* ─── Default values for fresh installs ───────────────────── */
const DEFAULT_PRICING = {
  visible: true,
  title: 'So funktioniert unsere Preisgestaltung',
  tiers: [
    { number: '01', title: 'Tag 1 – 7', description: 'Standard-Tagestarif für kurzfristige Bedürfnisse.', badge: '' },
    { number: '02', title: 'Tag 8 – 30', description: 'Automatisch 20% Rabatt auf den Tagestarif bei verlängerter Miete.', badge: '20% RABATT' },
    { number: '03', title: 'Ab 31 Tagen', description: 'Maximaler 40% Rabatt. Bestes Preis-Leistungs-Verhältnis für echte Langzeitmobilität.', badge: '40% RABATT' },
  ],
};

const ICON_OPTIONS = ['shield', 'clock', 'car', 'zap', 'heart', 'star', 'check-circle', 'truck'];

const DEFAULT_FEATURES = {
  visible: true,
  items: [
    { icon: 'shield', title: 'Vollkasko inklusive', description: 'Premium-Versicherungsschutz ohne Zusatzkosten' },
    { icon: 'clock', title: 'Flexible Laufzeiten', description: 'Ab 1 Tag – bis zu 40% Rabatt bei Langzeitmiete' },
    { icon: 'car', title: 'Bestens gewartet', description: 'Jedes Fahrzeug wird vor der Übergabe geprüft' },
  ],
};

export default function SettingsPage() {
  const { token } = useAdminAuth();
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const all = await api.getSettings();
      if (all.pricing) setPricing(all.pricing);
      if (all.features) setFeatures(all.features);
    } catch {
      // Defaults are fine
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function saveSetting(key: string, value: any) {
    setSaving(key);
    setSaved(null);
    try {
      await api.updateSetting(key, value);
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setSaving(null);
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
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-neutral-900 mb-8">Website-Einstellungen</h1>

      {/* ─── Pricing Section ──────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-neutral-900">Preisgestaltung</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPricing((p) => ({ ...p, visible: !p.visible }))}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                pricing.visible
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-neutral-50 text-neutral-500 border-neutral-200'
              }`}
            >
              {pricing.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {pricing.visible ? 'Sichtbar' : 'Ausgeblendet'}
            </button>
            <button
              disabled={saving === 'pricing'}
              onClick={() => saveSetting('pricing', pricing)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving === 'pricing' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Speichern
            </button>
            {saved === 'pricing' && (
              <span className="text-sm text-green-600 font-medium">✓ Gespeichert</span>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-1">Titel</label>
          <input
            type="text"
            value={pricing.title}
            onChange={(e) => setPricing((p) => ({ ...p, title: e.target.value }))}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-neutral-700">Stufen</label>
          {pricing.tiers.map((tier, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-3 items-start bg-neutral-50 p-4 rounded-lg">
              <div className="col-span-1">
                <label className="block text-xs text-neutral-500 mb-1">Nr.</label>
                <input
                  type="text"
                  value={tier.number}
                  onChange={(e) => {
                    const t = [...pricing.tiers];
                    t[idx] = { ...t[idx], number: e.target.value };
                    setPricing((p) => ({ ...p, tiers: t }));
                  }}
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-neutral-500 mb-1">Titel</label>
                <input
                  type="text"
                  value={tier.title}
                  onChange={(e) => {
                    const t = [...pricing.tiers];
                    t[idx] = { ...t[idx], title: e.target.value };
                    setPricing((p) => ({ ...p, tiers: t }));
                  }}
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div className="col-span-5">
                <label className="block text-xs text-neutral-500 mb-1">Beschreibung</label>
                <input
                  type="text"
                  value={tier.description}
                  onChange={(e) => {
                    const t = [...pricing.tiers];
                    t[idx] = { ...t[idx], description: e.target.value };
                    setPricing((p) => ({ ...p, tiers: t }));
                  }}
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-neutral-500 mb-1">Badge</label>
                <input
                  type="text"
                  value={tier.badge}
                  onChange={(e) => {
                    const t = [...pricing.tiers];
                    t[idx] = { ...t[idx], badge: e.target.value };
                    setPricing((p) => ({ ...p, tiers: t }));
                  }}
                  placeholder="z.B. 20% RABATT"
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div className="col-span-1 pt-5">
                <button
                  onClick={() =>
                    setPricing((p) => ({
                      ...p,
                      tiers: p.tiers.filter((_, i) => i !== idx),
                    }))
                  }
                  className="text-red-400 hover:text-red-600 p-1"
                  title="Entfernen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              setPricing((p) => ({
                ...p,
                tiers: [
                  ...p.tiers,
                  {
                    number: String(p.tiers.length + 1).padStart(2, '0'),
                    title: '',
                    description: '',
                    badge: '',
                  },
                ],
              }))
            }
            className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Stufe hinzufügen
          </button>
        </div>
      </section>

      {/* ─── Features / Trust Signals Section ─────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-neutral-900">Vertrauens-Features</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFeatures((f) => ({ ...f, visible: !f.visible }))}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                features.visible
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-neutral-50 text-neutral-500 border-neutral-200'
              }`}
            >
              {features.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {features.visible ? 'Sichtbar' : 'Ausgeblendet'}
            </button>
            <button
              disabled={saving === 'features'}
              onClick={() => saveSetting('features', features)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving === 'features' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Speichern
            </button>
            {saved === 'features' && (
              <span className="text-sm text-green-600 font-medium">✓ Gespeichert</span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {features.items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-3 items-start bg-neutral-50 p-4 rounded-lg">
              <div className="col-span-2">
                <label className="block text-xs text-neutral-500 mb-1">Icon</label>
                <select
                  value={item.icon}
                  onChange={(e) => {
                    const items = [...features.items];
                    items[idx] = { ...items[idx], icon: e.target.value };
                    setFeatures((f) => ({ ...f, items }));
                  }}
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                >
                  {ICON_OPTIONS.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-neutral-500 mb-1">Titel</label>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => {
                    const items = [...features.items];
                    items[idx] = { ...items[idx], title: e.target.value };
                    setFeatures((f) => ({ ...f, items }));
                  }}
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div className="col-span-6">
                <label className="block text-xs text-neutral-500 mb-1">Beschreibung</label>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => {
                    const items = [...features.items];
                    items[idx] = { ...items[idx], description: e.target.value };
                    setFeatures((f) => ({ ...f, items }));
                  }}
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div className="col-span-1 pt-5">
                <button
                  onClick={() =>
                    setFeatures((f) => ({
                      ...f,
                      items: f.items.filter((_, i) => i !== idx),
                    }))
                  }
                  className="text-red-400 hover:text-red-600 p-1"
                  title="Entfernen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              setFeatures((f) => ({
                ...f,
                items: [...f.items, { icon: 'shield', title: '', description: '' }],
              }))
            }
            className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Feature hinzufügen
          </button>
        </div>
      </section>
    </div>
  );
}
