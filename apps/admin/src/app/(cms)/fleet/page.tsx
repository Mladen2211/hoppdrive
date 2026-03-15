'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, X, Upload, Car } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  type: string;
  year: number;
  basePricePerDay: number;
  isAvailable: boolean;
  images: { id: string; url: string; alt: string; order: number }[];
  specs: {
    horsepower: number;
    transmission: string;
    seats: number;
    fuelType: string;
    range?: number;
  };
}

const VEHICLE_TYPES = ['sedan', 'suv', 'sports', 'electric', 'van', 'luxury'];
const FUEL_TYPES = ['petrol', 'diesel', 'electric', 'hybrid'];
const TRANSMISSIONS = ['automatic', 'manual'];

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  sedan: 'Limousine', suv: 'SUV', sports: 'Sportwagen', electric: 'Elektro', van: 'Van', luxury: 'Luxus',
};
const FUEL_TYPE_LABELS: Record<string, string> = {
  petrol: 'Benzin', diesel: 'Diesel', electric: 'Elektrisch', hybrid: 'Hybrid',
};
const TRANSMISSION_LABELS: Record<string, string> = {
  automatic: 'Automatik', manual: 'Schaltgetriebe',
};

const emptyForm = {
  brand: '',
  model: '',
  type: VEHICLE_TYPES[0],
  year: new Date().getFullYear(),
  basePricePerDay: 0,
  specs: {
    horsepower: 0,
    transmission: TRANSMISSIONS[0],
    seats: 5,
    fuelType: FUEL_TYPES[0],
    range: undefined as number | undefined,
  },
};

export default function FleetManagerPage() {
  const { token } = useAdminAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFiles, setImageFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function fetchVehicles() {
    if (!token) return;
    try {
      const data = await api.getVehicles();
      setVehicles(data);
    } catch (err) {
      console.error('Failed to fetch vehicles', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setImageFiles(null);
    setShowForm(true);
  }

  function openEdit(v: Vehicle) {
    setEditingId(v.id);
    setForm({
      brand: v.brand,
      model: v.model,
      type: v.type,
      year: v.year,
      basePricePerDay: v.basePricePerDay,
      specs: {
        horsepower: v.specs.horsepower,
        transmission: v.specs.transmission,
        seats: v.specs.seats,
        fuelType: v.specs.fuelType,
        range: v.specs.range,
      },
    });
    setImageFiles(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);

    try {
      if (editingId) {
        await api.updateVehicle(editingId, form, token);
      } else {
        await api.createVehicle(form, token);
      }
      setShowForm(false);
      await fetchVehicles();
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    if (!confirm('Dieses Fahrzeug endgültig löschen?')) return;
    try {
      await api.deleteVehicle(id, token);
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Flottenmanager</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Fahrzeug hinzufügen
        </button>
      </div>

      {/* Modal overlay */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h2 className="text-lg font-bold">
                {editingId ? 'Fahrzeug bearbeiten' : 'Fahrzeug hinzufügen'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Marke</label>
                  <input
                    required
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Modell</label>
                  <input
                    required
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Typ</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {VEHICLE_TYPE_LABELS[t] || t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Jahr</label>
                  <input
                    required
                    type="number"
                    min={2000}
                    max={2030}
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Preis / Tag (CHF)
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.basePricePerDay}
                    onChange={(e) =>
                      setForm({ ...form, basePricePerDay: Number(e.target.value) })
                    }
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <hr className="border-neutral-200" />
              <p className="text-sm font-semibold text-neutral-700">Spezifikationen</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">PS</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={form.specs.horsepower}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        specs: { ...form.specs, horsepower: Number(e.target.value) },
                      })
                    }
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Sitze</label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={12}
                    value={form.specs.seats}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        specs: { ...form.specs, seats: Number(e.target.value) },
                      })
                    }
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Getriebe</label>
                  <select
                    value={form.specs.transmission}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        specs: { ...form.specs, transmission: e.target.value },
                      })
                    }
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {TRANSMISSIONS.map((t) => (
                      <option key={t} value={t}>
                        {TRANSMISSION_LABELS[t] || t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Kraftstoff</label>
                  <select
                    value={form.specs.fuelType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        specs: { ...form.specs, fuelType: e.target.value },
                      })
                    }
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {FUEL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {FUEL_TYPE_LABELS[t] || t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.specs.fuelType === 'electric' || form.specs.fuelType === 'hybrid' ? (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Reichweite (km)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.specs.range ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        specs: {
                          ...form.specs,
                          range: e.target.value ? Number(e.target.value) : undefined,
                        },
                      })
                    }
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              ) : null}

              <hr className="border-neutral-200" />

              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Fahrzeugbilder
                </label>
                <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-neutral-300 rounded-lg p-4 hover:border-brand-400 transition-colors">
                  <Upload className="w-5 h-5 text-neutral-400" />
                  <span className="text-sm text-neutral-500">
                    {imageFiles
                      ? `${imageFiles.length} Datei(en) ausgewählt`
                      : 'Klicken Sie, um Bilder hochzuladen'}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setImageFiles(e.target.files)}
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  {submitting ? 'Speichern...' : editingId ? 'Fahrzeug aktualisieren' : 'Fahrzeug erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vehicles table */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left px-6 py-3 text-neutral-500 font-medium">Fahrzeug</th>
                <th className="text-left px-6 py-3 text-neutral-500 font-medium">Typ</th>
                <th className="text-left px-6 py-3 text-neutral-500 font-medium">Jahr</th>
                <th className="text-left px-6 py-3 text-neutral-500 font-medium">Preis/Tag</th>
                <th className="text-left px-6 py-3 text-neutral-500 font-medium">Status</th>
                <th className="text-right px-6 py-3 text-neutral-500 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-neutral-400">
                    Keine Fahrzeuge in der Flotte. Klicken Sie auf &quot;Fahrzeug hinzufügen&quot;, um zu beginnen.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                    <td className="px-6 py-3 font-medium">
                      <div className="flex items-center gap-3">
                        {v.images[0] ? (
                          <img
                            src={v.images[0].url}
                            alt={v.images[0].alt}
                            className="w-12 h-8 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-8 bg-neutral-200 rounded flex items-center justify-center">
                            <Car className="w-4 h-4 text-neutral-400" />
                          </div>
                        )}
                        <span>
                          {v.brand} {v.model}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-neutral-600">{VEHICLE_TYPE_LABELS[v.type] || v.type}</td>
                    <td className="px-6 py-3 text-neutral-600">{v.year}</td>
                    <td className="px-6 py-3 font-medium">CHF {v.basePricePerDay}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          v.isAvailable
                            ? 'bg-green-100 text-green-700'
                            : 'bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        {v.isAvailable ? 'Verfügbar' : 'Nicht verfügbar'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(v)}
                          className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500 hover:text-brand-600 transition-colors"
                          title="Bearbeiten"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-neutral-500 hover:text-red-600 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
