'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Star, Eye, EyeOff, GripVertical } from 'lucide-react';
import { api } from '@/lib/api';

interface Testimonial {
  id: string;
  name: string;
  location: string | null;
  text: string;
  rating: number;
  avatarUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

export default function TestimonialsPage() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getTestimonials();
      setItems(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Bewertung wirklich löschen?')) return;
    try {
      await api.deleteTestimonial(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      alert('Fehler beim Löschen');
    }
  };

  const toggleActive = async (item: Testimonial) => {
    try {
      const updated = await api.updateTestimonial(item.id, { isActive: !item.isActive });
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
      name: form.get('name') as string,
      location: (form.get('location') as string) || undefined,
      text: form.get('text') as string,
      rating: parseInt(form.get('rating') as string) || 5,
      avatarUrl: (form.get('avatarUrl') as string) || undefined,
      isActive: form.get('isActive') === 'on',
      sortOrder: parseInt(form.get('sortOrder') as string) || 0,
    };

    try {
      if (editing) {
        const updated = await api.updateTestimonial(editing.id, data);
        setItems((prev) => prev.map((i) => (i.id === editing.id ? updated : i)));
      } else {
        const created = await api.createTestimonial(data);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Kundenstimmen</h1>
          <p className="text-sm text-neutral-500 mt-1">Testimonials für die Webseite verwalten</p>
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
          Noch keine Kundenstimmen vorhanden. Klicken Sie auf &ldquo;Hinzufügen&rdquo;, um eine zu erstellen.
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
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{item.name}</span>
                  {item.location && (
                    <span className="text-xs text-neutral-400">· {item.location}</span>
                  )}
                  <div className="flex gap-0.5 ml-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${i < item.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-neutral-600 line-clamp-2">&ldquo;{item.text}&rdquo;</p>
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
              {editing ? 'Bewertung bearbeiten' : 'Neue Bewertung'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Name *</label>
                  <input
                    required
                    name="name"
                    defaultValue={editing?.name || ''}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Ort</label>
                  <input
                    name="location"
                    defaultValue={editing?.location || ''}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Bewertungstext *</label>
                <textarea
                  required
                  name="text"
                  rows={3}
                  defaultValue={editing?.text || ''}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Sterne</label>
                  <select
                    name="rating"
                    defaultValue={editing?.rating ?? 5}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {[5, 4, 3, 2, 1].map((r) => (
                      <option key={r} value={r}>{r} Stern{r > 1 ? 'e' : ''}</option>
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
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Avatar URL (optional)</label>
                <input
                  name="avatarUrl"
                  defaultValue={editing?.avatarUrl || ''}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="https://..."
                />
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
