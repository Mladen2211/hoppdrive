'use client';

import { useEffect, useState } from 'react';
import { Plus, MapPin, Pencil, Trash2, Save, X, Loader2, Check, Phone, Mail } from 'lucide-react';
import { api } from '@/lib/api';

interface Location {
  id: string;
  name: string;
  address: string;
  zip: string;
  city: string;
  country: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  _count?: { bookings: number };
}

const EMPTY: Omit<Location, 'id' | '_count'> = {
  name: '',
  address: '',
  zip: '',
  city: '',
  country: 'CH',
  phone: '',
  email: '',
  isActive: true,
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // id or 'new'
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await api.getLocations();
      setLocations(data);
    } catch {
      setError('Standorte konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startCreate() {
    setEditing('new');
    setForm(EMPTY);
    setError('');
  }

  function startEdit(loc: Location) {
    setEditing(loc.id);
    setForm({
      name: loc.name,
      address: loc.address,
      zip: loc.zip,
      city: loc.city,
      country: loc.country,
      phone: loc.phone || '',
      email: loc.email || '',
      isActive: loc.isActive,
    });
    setError('');
  }

  function cancel() {
    setEditing(null);
    setForm(EMPTY);
    setError('');
  }

  async function handleSave() {
    if (!form.name || !form.address || !form.zip || !form.city) {
      setError('Name, Adresse, PLZ und Ort sind erforderlich.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') {
        await api.createLocation(form as any);
      } else {
        await api.updateLocation(editing!, form);
      }
      cancel();
      await load();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Standort wirklich löschen?')) return;
    try {
      await api.deleteLocation(id);
      await load();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Standorte</h1>
          <p className="text-sm text-slate-500 mt-1">Verwalte deine Filialstandorte</p>
        </div>
        <button
          onClick={startCreate}
          disabled={!!editing}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Standort hinzufügen
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">
          {error}
        </p>
      )}

      {/* Create / Edit Form */}
      {editing && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editing === 'new' ? 'Neuer Standort' : 'Standort bearbeiten'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                placeholder="z.B. Hauptstandort"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Adresse *</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                placeholder="Industriestrasse 10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PLZ *</label>
              <input
                type="text"
                value={form.zip}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                placeholder="8305"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ort *</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                placeholder="Dietlikon"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Land</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                placeholder="CH"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
              <input
                type="tel"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                placeholder="+41 44 833 33 33"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-Mail</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                placeholder="standort@hoppdrive.ch"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <label className="text-sm text-slate-700">Aktiv</label>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Speichern
            </button>
            <button
              onClick={cancel}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium py-2.5 px-4 rounded-lg transition-colors text-sm border border-slate-300"
            >
              <X className="w-4 h-4" /> Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Locations list */}
      {locations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Noch keine Standorte erfasst.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className={`bg-white rounded-xl shadow-sm border p-5 transition-all hover:shadow-md ${
                loc.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{loc.name}</h3>
                    {!loc.isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">Inaktiv</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(loc)}
                    disabled={!!editing}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
                    title="Bearbeiten"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(loc.id)}
                    disabled={!!editing}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm text-slate-600">{loc.address}</p>
              <p className="text-sm text-slate-600">{loc.zip} {loc.city}, {loc.country}</p>

              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {loc.phone && (
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {loc.phone}</span>
                )}
                {loc.email && (
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {loc.email}</span>
                )}
                {loc._count?.bookings !== undefined && (
                  <span>{loc._count.bookings} Buchung{loc._count.bookings !== 1 ? 'en' : ''}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
