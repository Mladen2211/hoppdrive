'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  GripVertical,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Save,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface HomepageSection {
  id: string;
  sectionKey: string;
  isActive: boolean;
  sortOrder: number;
  content: Record<string, any>;
}

const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero-Bereich',
  why_hoppdrive: 'Warum HoppDrive',
  how_it_works: 'So funktioniert\u2019s',
  fleet: 'Flotte',
  pricing: 'Preisgestaltung',
  social_proof: 'Kundenstimmen',
  faq: 'FAQ',
  contact: 'Kontaktformular',
  map: 'Kartenbereich',
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  hero: 'Oberer Bereich mit Hauptüberschrift, CTAs und Vertrauenssignalen',
  why_hoppdrive: 'Vier Wertversprechen in Kartenform',
  how_it_works: 'Drei-Schritte-Prozess zum Mietwagen',
  fleet: 'Fahrzeug-Übersicht mit Filtern (Fahrzeuge über Flotte verwalten)',
  pricing: 'Preis-Staffelung und enthaltene Leistungen',
  social_proof: 'Kundenbewertungen (über Bewertungen verwalten)',
  faq: 'Häufige Fragen (über FAQ verwalten)',
  contact: 'Anfrage-Formular mit CTA',
  map: 'Kartenansicht mit Standort (über Standorte verwalten)',
};

/* ------------------------------------------------------------------ */
/*  Per-section Field Editors                                          */
/* ------------------------------------------------------------------ */

function TextFieldRow({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      )}
    </div>
  );
}

function ArrayStringEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-2">{label}</label>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[idx] = e.target.value;
                onChange(next);
              }}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <button
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="text-red-400 hover:text-red-600 p-2"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...items, ''])}
          className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Eintrag hinzufügen
        </button>
      </div>
    </div>
  );
}

function ArrayObjectEditor({
  label,
  items,
  fields,
  onChange,
}: {
  label: string;
  items: Record<string, string>[];
  fields: { key: string; label: string; multiline?: boolean }[];
  onChange: (items: Record<string, string>[]) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-2">{label}</label>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className="border border-slate-100 rounded-lg p-4 bg-slate-50 relative">
            <button
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="absolute top-2 right-2 text-red-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="space-y-2 pr-8">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-[11px] text-slate-400 mb-0.5">{f.label}</label>
                  {f.multiline ? (
                    <textarea
                      value={item[f.key] || ''}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], [f.key]: e.target.value };
                        onChange(next);
                      }}
                      rows={2}
                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
                    />
                  ) : (
                    <input
                      type="text"
                      value={item[f.key] || ''}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], [f.key]: e.target.value };
                        onChange(next);
                      }}
                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={() => {
            const empty: Record<string, string> = {};
            fields.forEach((f) => (empty[f.key] = ''));
            onChange([...items, empty]);
          }}
          className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Eintrag hinzufügen
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section-specific content editors                                   */
/* ------------------------------------------------------------------ */

function HeroEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...content, [key]: val });
  return (
    <div className="space-y-4">
      <TextFieldRow label="Badge-Text" value={content.badgeText || ''} onChange={(v) => set('badgeText', v)} />
      <div className="grid grid-cols-2 gap-4">
        <TextFieldRow label="Überschrift" value={content.heading || ''} onChange={(v) => set('heading', v)} />
        <TextFieldRow label="Hervorgehobener Text" value={content.headingHighlight || ''} onChange={(v) => set('headingHighlight', v)} />
      </div>
      <TextFieldRow label="Beschreibung" value={content.description || ''} onChange={(v) => set('description', v)} multiline />
      <div className="grid grid-cols-2 gap-4">
        <TextFieldRow label="Primärer CTA Text" value={content.ctaPrimaryText || ''} onChange={(v) => set('ctaPrimaryText', v)} />
        <TextFieldRow label="Primärer CTA Link" value={content.ctaPrimaryLink || ''} onChange={(v) => set('ctaPrimaryLink', v)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextFieldRow label="Sekundärer CTA Text" value={content.ctaSecondaryText || ''} onChange={(v) => set('ctaSecondaryText', v)} />
        <TextFieldRow label="Sekundärer CTA Link" value={content.ctaSecondaryLink || ''} onChange={(v) => set('ctaSecondaryLink', v)} />
      </div>
      <TextFieldRow label="Hintergrundbild URL" value={content.backgroundImageUrl || ''} onChange={(v) => set('backgroundImageUrl', v)} />
      <ArrayStringEditor label="Vertrauenssignale" items={content.trustItems || []} onChange={(v) => set('trustItems', v)} />
    </div>
  );
}

function WhyHoppDriveEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...content, [key]: val });
  return (
    <div className="space-y-4">
      <TextFieldRow label="Label" value={content.label || ''} onChange={(v) => set('label', v)} />
      <TextFieldRow label="Überschrift" value={content.heading || ''} onChange={(v) => set('heading', v)} />
      <TextFieldRow label="Beschreibung" value={content.description || ''} onChange={(v) => set('description', v)} multiline />
      <ArrayObjectEditor
        label="Wertversprechen"
        items={content.items || []}
        fields={[
          { key: 'title', label: 'Titel' },
          { key: 'description', label: 'Beschreibung', multiline: true },
        ]}
        onChange={(v) => set('items', v)}
      />
    </div>
  );
}

function HowItWorksEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...content, [key]: val });
  return (
    <div className="space-y-4">
      <TextFieldRow label="Label" value={content.label || ''} onChange={(v) => set('label', v)} />
      <TextFieldRow label="Überschrift" value={content.heading || ''} onChange={(v) => set('heading', v)} />
      <TextFieldRow label="Beschreibung" value={content.description || ''} onChange={(v) => set('description', v)} multiline />
      <ArrayObjectEditor
        label="Schritte"
        items={content.steps || []}
        fields={[
          { key: 'number', label: 'Nummer (z.B. 01)' },
          { key: 'title', label: 'Titel' },
          { key: 'description', label: 'Beschreibung', multiline: true },
          { key: 'time', label: 'Zeit-Badge (z.B. 2 Minuten)' },
        ]}
        onChange={(v) => set('steps', v)}
      />
    </div>
  );
}

function FleetEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...content, [key]: val });
  return (
    <div className="space-y-4">
      <TextFieldRow label="Label" value={content.label || ''} onChange={(v) => set('label', v)} />
      <TextFieldRow label="Überschrift" value={content.heading || ''} onChange={(v) => set('heading', v)} />
      <TextFieldRow label="Beschreibung" value={content.description || ''} onChange={(v) => set('description', v)} multiline />
      <p className="text-xs text-slate-400">Fahrzeuge werden über die Flotte-Seite verwaltet.</p>
    </div>
  );
}

function PricingEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...content, [key]: val });
  return (
    <div className="space-y-4">
      <TextFieldRow label="Label" value={content.label || ''} onChange={(v) => set('label', v)} />
      <TextFieldRow label="Überschrift" value={content.heading || ''} onChange={(v) => set('heading', v)} />
      <TextFieldRow label="Beschreibung" value={content.description || ''} onChange={(v) => set('description', v)} multiline />
      <ArrayObjectEditor
        label="Preis-Stufen"
        items={content.tiers || []}
        fields={[
          { key: 'number', label: 'Nummer' },
          { key: 'title', label: 'Titel' },
          { key: 'description', label: 'Beschreibung', multiline: true },
          { key: 'badge', label: 'Badge (leer = kein Badge)' },
        ]}
        onChange={(v) => set('tiers', v)}
      />
      <ArrayStringEditor label="Inklusive Leistungen" items={content.includedItems || []} onChange={(v) => set('includedItems', v)} />
    </div>
  );
}

function SocialProofEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...content, [key]: val });
  return (
    <div className="space-y-4">
      <TextFieldRow label="Label" value={content.label || ''} onChange={(v) => set('label', v)} />
      <TextFieldRow label="Überschrift" value={content.heading || ''} onChange={(v) => set('heading', v)} />
      <TextFieldRow label="Beschreibung" value={content.description || ''} onChange={(v) => set('description', v)} multiline />
      <p className="text-xs text-slate-400">Bewertungen werden über die Bewertungen-Seite verwaltet.</p>
    </div>
  );
}

function FaqEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...content, [key]: val });
  return (
    <div className="space-y-4">
      <TextFieldRow label="Label" value={content.label || ''} onChange={(v) => set('label', v)} />
      <TextFieldRow label="Überschrift" value={content.heading || ''} onChange={(v) => set('heading', v)} />
      <TextFieldRow label="Beschreibung" value={content.description || ''} onChange={(v) => set('description', v)} multiline />
      <p className="text-xs text-slate-400">FAQ-Einträge werden über die FAQ-Seite verwaltet.</p>
    </div>
  );
}

function ContactEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...content, [key]: val });
  return (
    <div className="space-y-4">
      <TextFieldRow label="Label" value={content.label || ''} onChange={(v) => set('label', v)} />
      <TextFieldRow label="Überschrift" value={content.heading || ''} onChange={(v) => set('heading', v)} />
      <TextFieldRow label="Beschreibung" value={content.description || ''} onChange={(v) => set('description', v)} multiline />
      <TextFieldRow label="CTA-Button Text" value={content.ctaText || ''} onChange={(v) => set('ctaText', v)} />
      <TextFieldRow label="Vertrauenszeile unter Button" value={content.trustLine || ''} onChange={(v) => set('trustLine', v)} />
    </div>
  );
}

function MapEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...content, [key]: val });
  return (
    <div className="space-y-4">
      <TextFieldRow label="Überschrift" value={content.heading || ''} onChange={(v) => set('heading', v)} />
      <p className="text-xs text-slate-400">Standort-Details werden über die Standorte-Seite verwaltet.</p>
    </div>
  );
}

const SECTION_EDITORS: Record<string, React.FC<{ content: Record<string, any>; onChange: (c: Record<string, any>) => void }>> = {
  hero: HeroEditor,
  why_hoppdrive: WhyHoppDriveEditor,
  how_it_works: HowItWorksEditor,
  fleet: FleetEditor,
  pricing: PricingEditor,
  social_proof: SocialProofEditor,
  faq: FaqEditor,
  contact: ContactEditor,
  map: MapEditor,
};

/* ------------------------------------------------------------------ */
/*  Section Card Component                                             */
/* ------------------------------------------------------------------ */

function SectionCard({
  section,
  onToggle,
  onSave,
  onSortChange,
}: {
  section: HomepageSection;
  onToggle: () => void;
  onSave: (content: Record<string, any>, sortOrder: number) => Promise<void>;
  onSortChange: (delta: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editContent, setEditContent] = useState<Record<string, any>>(section.content || {});
  const [editSort, setEditSort] = useState(section.sortOrder);
  const [saving, setSaving] = useState(false);

  // Sync when parent updates
  useEffect(() => {
    setEditContent(section.content || {});
    setEditSort(section.sortOrder);
  }, [section]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editContent, editSort);
    } finally {
      setSaving(false);
    }
  };

  const Editor = SECTION_EDITORS[section.sectionKey];

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${section.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-75'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-slate-900">{SECTION_LABELS[section.sectionKey] || section.sectionKey}</h3>
            <span className="text-[11px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
              #{section.sortOrder}
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate">{SECTION_DESCRIPTIONS[section.sectionKey] || ''}</p>
        </div>

        {/* Sort buttons */}
        <div className="flex flex-col gap-0.5">
          <button onClick={() => onSortChange(-1)} className="p-0.5 text-slate-400 hover:text-slate-600" title="Nach oben">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onSortChange(1)} className="p-0.5 text-slate-400 hover:text-slate-600" title="Nach unten">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Toggle active */}
        <button
          onClick={onToggle}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            section.isActive
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {section.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {section.isActive ? 'Sichtbar' : 'Ausgeblendet'}
        </button>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-5">
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 mb-1">Reihenfolge</label>
            <input
              type="number"
              value={editSort}
              onChange={(e) => setEditSort(Number(e.target.value))}
              className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {Editor && <Editor content={editContent} onChange={setEditContent} />}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Speichern
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function HomepageSectionsPage() {
  useAdminAuth();
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.getHomepageSections();
      setSections(data.sort((a: HomepageSection, b: HomepageSection) => a.sortOrder - b.sortOrder));
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (key: string) => {
    try {
      await api.toggleHomepageSection(key);
      await load();
    } catch { /* ignore */ }
  };

  const handleSave = async (key: string, content: Record<string, any>, sortOrder: number) => {
    await api.updateHomepageSection(key, { content, sortOrder });
    await load();
  };

  const handleSortChange = async (key: string, delta: number) => {
    const idx = sections.findIndex((s) => s.sectionKey === key);
    if (idx < 0) return;
    const swapIdx = idx + delta;
    if (swapIdx < 0 || swapIdx >= sections.length) return;

    // Swap sort orders
    const current = sections[idx];
    const swap = sections[swapIdx];
    await api.updateHomepageSection(current.sectionKey, { sortOrder: swap.sortOrder });
    await api.updateHomepageSection(swap.sectionKey, { sortOrder: current.sortOrder });
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm text-slate-500">
            Verwalten Sie die Sichtbarkeit, Reihenfolge und Inhalte aller Homepage-Sektionen.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <SectionCard
            key={section.sectionKey}
            section={section}
            onToggle={() => handleToggle(section.sectionKey)}
            onSave={(content, sortOrder) => handleSave(section.sectionKey, content, sortOrder)}
            onSortChange={(delta) => handleSortChange(section.sectionKey, delta)}
          />
        ))}
      </div>

      {sections.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p>Keine Sektionen gefunden. Bitte stellen Sie sicher, dass die Datenbank-Migration ausgeführt wurde.</p>
        </div>
      )}
    </div>
  );
}
