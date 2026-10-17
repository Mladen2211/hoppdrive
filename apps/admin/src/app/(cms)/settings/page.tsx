'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import { Save, Loader2, Plus, Trash2, Eye, EyeOff, Search, MapPin, Receipt, Globe2 } from 'lucide-react';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

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

const DEFAULT_LOCATION = {
  visible: true,
  title: 'Hier finden Sie uns',
  address: 'Musterstrasse 1, 8000 Zürich',
  lat: 47.3769,
  lng: 8.5417,
  zoom: 14,
};

const DEFAULT_SEO = {
  metaTitle: '',
  metaDescription: '',
  ogImageUrl: '',
};

export default function SettingsPage() {
  const { token } = useAdminAuth();
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [seo, setSeo] = useState(DEFAULT_SEO);
  const [invoiceSettings, setInvoiceSettings] = useState({ uid: '', iban: '', bankName: '', vatRate: 8.1 });
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Real day-tier discount rules — separate from the decorative marketing copy above.
  const [pricingRules, setPricingRules] = useState<{ id: string; fromDay: number; toDay: number | null; discountPercent: number }[]>([]);
  const [pricingRulesLoading, setPricingRulesLoading] = useState(true);
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);
  const [savedRuleId, setSavedRuleId] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const all = await api.getSettings();
      if (all.pricing) setPricing(all.pricing);
      if (all.features) setFeatures(all.features);
      if (all.location) setLocation(all.location);
      if (all.seo) setSeo(all.seo);
      if (all.invoice_settings) setInvoiceSettings((s) => ({ ...s, ...all.invoice_settings }));
    } catch {
      // Defaults are fine
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchPricingRules = useCallback(async () => {
    if (!token) return;
    setPricingRulesLoading(true);
    try {
      const rules = await api.getPricingRules();
      setPricingRules(rules.sort((a: any, b: any) => a.fromDay - b.fromDay));
    } catch {
      // Leave empty — admin can still add new rules
    } finally {
      setPricingRulesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
    fetchPricingRules();
  }, [fetchSettings, fetchPricingRules]);

  function updateRuleField(id: string, field: 'fromDay' | 'toDay' | 'discountPercent', value: number | null) {
    setPricingRules((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleAddRule() {
    try {
      const created = await api.createPricingRule({ fromDay: 1, toDay: null, discountPercent: 0 });
      setPricingRules((prev) => [...prev, created].sort((a, b) => a.fromDay - b.fromDay));
    } catch (err: any) {
      alert(err.message || 'Regel konnte nicht erstellt werden.');
    }
  }

  async function handleSaveRule(rule: { id: string; fromDay: number; toDay: number | null; discountPercent: number }) {
    setSavingRuleId(rule.id);
    try {
      await api.updatePricingRule(rule.id, {
        fromDay: rule.fromDay,
        toDay: rule.toDay,
        discountPercent: rule.discountPercent,
      });
      setSavedRuleId(rule.id);
      setTimeout(() => setSavedRuleId(null), 2000);
    } catch (err: any) {
      alert(err.message || 'Regel konnte nicht gespeichert werden.');
    } finally {
      setSavingRuleId(null);
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm('Diese Preisregel wirklich löschen?')) return;
    try {
      await api.deletePricingRule(id);
      setPricingRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      alert(err.message || 'Regel konnte nicht gelöscht werden.');
    }
  }

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

      {/* ─── Pricing Marketing Copy (decorative — see "Preisregeln" below for the real rates) ─── */}
      <section className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-neutral-900">Preisgestaltung – Marketing-Text</h2>
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

        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
          ⚠️ Nur Anzeigetext auf der Startseite — hat <strong>keinen Einfluss</strong> auf den tatsächlich berechneten Mietpreis.
          Die echten Rabattstufen werden unter „Preisregeln&rdquo; weiter unten verwaltet.
        </p>

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

      {/* ─── Preisregeln (real, applied discount tiers) ────── */}
      <section className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 mb-8">
        <div className="mb-1">
          <h2 className="text-lg font-bold text-neutral-900">Preisregeln</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Diese Staffelung wird tatsächlich auf jede Buchung angewendet — Tag-Bereiche dürfen sich nicht überschneiden.
          </p>
        </div>

        {pricingRulesLoading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-400 py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Regeln laden…
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {pricingRules.length === 0 && (
              <p className="text-sm text-neutral-400 py-2">Keine Preisregeln vorhanden.</p>
            )}
            {pricingRules.map((rule) => (
              <div key={rule.id} className="grid grid-cols-12 gap-3 items-end bg-neutral-50 p-4 rounded-lg">
                <div className="col-span-3">
                  <label className="block text-xs text-neutral-500 mb-1">Ab Tag</label>
                  <input
                    type="number"
                    min={1}
                    value={rule.fromDay}
                    onChange={(e) => updateRuleField(rule.id, 'fromDay', Number(e.target.value) || 1)}
                    className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs text-neutral-500 mb-1">Bis Tag (leer = unbegrenzt)</label>
                  <input
                    type="number"
                    min={1}
                    value={rule.toDay ?? ''}
                    onChange={(e) => updateRuleField(rule.id, 'toDay', e.target.value ? Number(e.target.value) : null)}
                    placeholder="unbegrenzt"
                    className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs text-neutral-500 mb-1">Rabatt (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={rule.discountPercent}
                    onChange={(e) => updateRuleField(rule.id, 'discountPercent', Number(e.target.value) || 0)}
                    className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <button
                    onClick={() => handleSaveRule(rule)}
                    disabled={savingRuleId === rule.id}
                    className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {savingRuleId === rule.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Speichern
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-red-400 hover:text-red-600 p-1.5"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {savedRuleId === rule.id && (
                    <span className="text-xs text-green-600 font-medium">✓</span>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={handleAddRule}
              className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              <Plus className="w-4 h-4" /> Preisregel hinzufügen
            </button>
          </div>
        )}
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

      {/* ─── Location / Map Section ───────────────────────── */}
      <LocationEditor
        location={location}
        setLocation={setLocation}
        saving={saving}
        saved={saved}
        onSave={() => saveSetting('location', location)}
      />

      {/* ─── SEO / Meta-Angaben Section ────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 mt-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900">SEO / Meta-Angaben</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Steuert Titel, Beschreibung und Social-Preview-Bild der Startseite</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled={saving === 'seo'}
              onClick={() => saveSetting('seo', seo)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving === 'seo' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Speichern
            </button>
            {saved === 'seo' && (
              <span className="text-sm text-green-600 font-medium">✓ Gespeichert</span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Meta-Titel</label>
            <input
              type="text"
              value={seo.metaTitle}
              onChange={(e) => setSeo((s) => ({ ...s, metaTitle: e.target.value }))}
              placeholder="HoppDrive – Günstige Autovermietung Schweiz | Mietwagen Ab CHF 59/Tag"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-neutral-400 mt-1">Leer lassen, um den Standardtitel zu verwenden.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Meta-Beschreibung</label>
            <textarea
              value={seo.metaDescription}
              onChange={(e) => setSeo((s) => ({ ...s, metaDescription: e.target.value }))}
              rows={3}
              placeholder="HoppDrive – Günstige Kurz- & Langzeitvermietung in der Schweiz..."
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-neutral-400 mt-1">Leer lassen, um die Standardbeschreibung zu verwenden.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Social-Preview-Bild (URL)</label>
            <input
              type="text"
              value={seo.ogImageUrl}
              onChange={(e) => setSeo((s) => ({ ...s, ogImageUrl: e.target.value }))}
              placeholder="https://hoppdrive.ch/og-default.jpg"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
            />
            <p className="text-xs text-neutral-400 mt-1">1200×630px empfohlen. Leer lassen, um das Standardbild zu verwenden.</p>
          </div>
        </div>
      </section>

      {/* ─── Invoice / Zahlungsinfos Section ─────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 mt-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Rechnungsinfos</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Erscheinen auf jeder generierten Rechnung (PDF)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled={saving === 'invoice_settings'}
              onClick={() => saveSetting('invoice_settings', invoiceSettings)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving === 'invoice_settings' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Speichern
            </button>
            {saved === 'invoice_settings' && (
              <span className="text-sm text-green-600 font-medium">✓ Gespeichert</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">MwSt-Nr. (UID)</label>
            <input
              type="text"
              value={invoiceSettings.uid}
              onChange={(e) => setInvoiceSettings((s) => ({ ...s, uid: e.target.value }))}
              placeholder="CHE-XXX.XXX.XXX MWST"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">IBAN</label>
            <input
              type="text"
              value={invoiceSettings.iban}
              onChange={(e) => setInvoiceSettings((s) => ({ ...s, iban: e.target.value }))}
              placeholder="CH56 0483 5012 3456 7800 9"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Bankname</label>
            <input
              type="text"
              value={invoiceSettings.bankName}
              onChange={(e) => setInvoiceSettings((s) => ({ ...s, bankName: e.target.value }))}
              placeholder="Raiffeisenbank Zürich"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">MwSt-Satz (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={invoiceSettings.vatRate}
              onChange={(e) => setInvoiceSettings((s) => ({ ...s, vatRate: Number(e.target.value) || 0 }))}
              placeholder="8.1"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Location Editor w/ map preview + address search
   ────────────────────────────────────────────────────────────── */

interface LocationEditorProps {
  location: typeof DEFAULT_LOCATION;
  setLocation: React.Dispatch<React.SetStateAction<typeof DEFAULT_LOCATION>>;
  saving: string | null;
  saved: string | null;
  onSave: () => void;
}

function LocationEditor({ location, setLocation, saving, saved, onSave }: LocationEditorProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load Mapbox GL JS from CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).mapboxgl) {
      setMapLoaded(true);
      return;
    }

    const css = document.createElement('link');
    css.id = 'mapbox-gl-admin-css';
    css.rel = 'stylesheet';
    css.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.id = 'mapbox-gl-admin-js';
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize / update map
  useEffect(() => {
    if (!mapLoaded || !mapContainer.current || !MAPBOX_TOKEN) return;
    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    if (!mapRef.current) {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [location.lng, location.lat],
        zoom: location.zoom,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Click to place marker
      map.on('click', (e: any) => {
        const { lng, lat } = e.lngLat;
        setLocation((prev) => ({ ...prev, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }));
      });

      // Update zoom on zoom end
      map.on('zoomend', () => {
        setLocation((prev) => ({ ...prev, zoom: Math.round(map.getZoom()) }));
      });

      // Marker
      const marker = new mapboxgl.Marker({ color: '#A60E0E', draggable: true });
      marker.setLngLat([location.lng, location.lat]).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        setLocation((prev) => ({
          ...prev,
          lat: Math.round(pos.lat * 1e6) / 1e6,
          lng: Math.round(pos.lng * 1e6) / 1e6,
        }));
      });

      markerRef.current = marker;
      mapRef.current = map;
    } else {
      // Update marker + center when location changes
      markerRef.current?.setLngLat([location.lng, location.lat]);
      mapRef.current.flyTo({ center: [location.lng, location.lat], zoom: location.zoom, duration: 600 });
    }
  }, [mapLoaded, location.lat, location.lng, location.zoom, setLocation]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Address autocomplete via Mapbox Geocoding API
  function handleSearchInput(query: string) {
    setSearchQuery(query);
    clearTimeout(searchTimeout.current);

    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
            `access_token=${MAPBOX_TOKEN}&language=de&types=address,poi,place&limit=5&country=ch,de,at,li`
        );
        const data = await res.json();
        setSuggestions(data.features || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  function selectSuggestion(feature: any) {
    const [lng, lat] = feature.center;
    setLocation((prev) => ({
      ...prev,
      address: feature.place_name,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      zoom: 16,
    }));
    setSearchQuery(feature.place_name);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <section className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-neutral-900">Standort / Karte</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation((l) => ({ ...l, visible: !l.visible }))}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              location.visible
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-neutral-50 text-neutral-500 border-neutral-200'
            }`}
          >
            {location.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {location.visible ? 'Sichtbar' : 'Ausgeblendet'}
          </button>
          <button
            disabled={saving === 'location'}
            onClick={onSave}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving === 'location' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Speichern
          </button>
          {saved === 'location' && (
            <span className="text-sm text-green-600 font-medium">✓ Gespeichert</span>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 mb-1">Titel</label>
        <input
          type="text"
          value={location.title}
          onChange={(e) => setLocation((l) => ({ ...l, title: e.target.value }))}
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Hier finden Sie uns"
        />
      </div>

      {/* Address search */}
      <div className="mb-4 relative" ref={suggestionsRef}>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Adresse suchen</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            className="w-full border border-neutral-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Adresse eingeben, z.B. Bahnhofstrasse 1, Zürich"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 animate-spin" />
          )}
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((feat: any) => (
              <button
                key={feat.id}
                onClick={() => selectSuggestion(feat)}
                className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 flex items-start gap-2 border-b border-neutral-100 last:border-0 transition-colors"
              >
                <MapPin className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">{feat.text}</p>
                  <p className="text-xs text-neutral-400 truncate">{feat.place_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current address (editable) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 mb-1">Angezeigte Adresse</label>
        <input
          type="text"
          value={location.address}
          onChange={(e) => setLocation((l) => ({ ...l, address: e.target.value }))}
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Musterstrasse 1, 8000 Zürich"
        />
        <p className="text-xs text-neutral-400 mt-1">Wird unter dem Kartentitel auf der Website angezeigt.</p>
      </div>

      {/* Map preview */}
      {MAPBOX_TOKEN ? (
        <div className="rounded-xl overflow-hidden border border-neutral-200 mb-4">
          <div
            ref={mapContainer}
            className="w-full h-[340px] bg-neutral-100"
          />
          <div className="bg-neutral-50 px-4 py-2 flex items-center justify-between text-xs text-neutral-500">
            <span>Klicken Sie auf die Karte oder verschieben Sie die Markierung, um den Standort anzupassen</span>
            <span className="font-mono">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center mb-4">
          <MapPin className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm text-neutral-500">
            Kein Mapbox-Token konfiguriert. Bitte <code className="text-xs bg-neutral-200 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code>{' '}
            als Umgebungsvariable setzen.
          </p>
        </div>
      )}

      {/* Fine-tune coords + zoom */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Breitengrad</label>
          <input
            type="number"
            step="any"
            value={location.lat}
            onChange={(e) => setLocation((l) => ({ ...l, lat: parseFloat(e.target.value) || 0 }))}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Längengrad</label>
          <input
            type="number"
            step="any"
            value={location.lng}
            onChange={(e) => setLocation((l) => ({ ...l, lng: parseFloat(e.target.value) || 0 }))}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Zoom (1–18)</label>
          <input
            type="number"
            min={1}
            max={18}
            value={location.zoom}
            onChange={(e) => setLocation((l) => ({ ...l, zoom: parseInt(e.target.value) || 14 }))}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
          />
        </div>
      </div>
    </section>
  );
}
