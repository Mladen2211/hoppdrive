'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, GripVertical, HelpCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
}

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'Allgemein' },
  { value: 'pricing', label: 'Preise' },
  { value: 'insurance', label: 'Versicherung' },
  { value: 'rental', label: 'Mietbedingungen' },
  { value: 'documents', label: 'Dokumente' },
  { value: 'pickup', label: 'Abholung' },
];

export default function FaqPage() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getFaqItems();
      setItems(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('FAQ-Eintrag wirklich löschen?')) return;
    try {
      await api.deleteFaqItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      alert('Fehler beim Löschen');
    }
  };

  const toggleActive = async (item: FaqItem) => {
    try {
      const updated = await api.updateFaqItem(item.id, { isActive: !item.isActive });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch {
      alert('Fehler beim Aktualisieren');
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const data = {
      question: form.get('question') as string,
      answer: form.get('answer') as string,
      category: form.get('category') as string,
      isActive: form.get('isActive') === 'on',
      sortOrder: parseInt(form.get('sortOrder') as string) || 0,
    };

    try {
      if (editing) {
        const updated = await api.updateFaqItem(editing.id, data);
        setItems((prev) => prev.map((i) => (i.id === editing.id ? updated : i)));
      } else {
        const created = await api.createFaqItem(data);
        setItems((prev) => [...prev, created]);
      }
      setShowModal(false);
      setEditing(null);
    } catch {
      alert('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryLabel = (value: string) =>
    CATEGORY_OPTIONS.find((c) => c.value === value)?.label || value;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">FAQ</h1>
          <p className="text-sm text-neutral-500 mt-1">Häufige Fragen für die Webseite verwalten</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Hinzufügen
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          Noch keine FAQ-Einträge vorhanden. Klicken Sie auf &ldquo;Hinzufügen&rdquo;, um einen zu erstellen.
        </div>
      ) : (
        <div className="space-y-3">
          {items.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
            <div
              key={item.id}
              className={`bg-white border rounded-xl p-5 flex items-start gap-4 ${
                item.isActive ? 'border-neutral-200' : 'border-neutral-200 opacity-50'
              }`}
            >
              <GripVertical className="w-4 h-4 text-neutral-300 mt-1 flex-shrink-0" />
              <HelpCircle className="w-4 h-4 text-brand-400 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{item.question}</span>
                  <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                    {getCategoryLabel(item.category)}
                  </span>
                </div>
                <p className="text-sm text-neutral-500 line-clamp-2">{item.answer}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleActive(item)}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                  title={item.isActive ? 'Deaktivieren' : 'Aktivieren'}
                >
                  {item.isActive ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-neutral-400" />}
                </button>
                <button
                  onClick={() => { setEditing(item); setShowModal(true); }}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4 text-neutral-500" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold mb-4">
              {editing ? 'FAQ bearbeiten' : 'Neuer FAQ-Eintrag'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Frage *</label>
                <input
                  required
                  name="question"
                  defaultValue={editing?.question || ''}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="z.B. Was kostet die Miete bei HoppDrive?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Antwort *</label>
                <textarea
                  required
                  name="answer"
                  rows={4}
                  defaultValue={editing?.answer || ''}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Kategorie</label>
                  <select
                    name="category"
                    defaultValue={editing?.category || 'general'}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Reihenfolge</label>
                  <input
                    name="sortOrder"
                    type="number"
                    defaultValue={editing?.sortOrder ?? 0}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm pb-2">
                    <input
                      name="isActive"
                      type="checkbox"
                      defaultChecked={editing?.isActive ?? true}
                      className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                    />
                    Aktiv
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditing(null); }}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
