'use client';

import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Calendar, User, Car, FileText } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  isAvailable: boolean;
}

interface Booking {
  id: string;
  vehicleId: string;
  customerName: string;
  startDate: string;
  endDate: string;
  status: string;
  notes?: string | null;
  totalPrice?: number;
  currency?: string;
}

const EMPTY_FORM = {
  vehicleId: '',
  customerName: '',
  startDate: '',
  endDate: '',
  notes: '',
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const STATUS_COLORS: Record<string, string> = {
  reserved: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-neutral-100 text-neutral-600',
  cancelled: 'bg-red-100 text-red-700',
};

export default function AvailabilityPage() {
  const { token } = useAdminAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Calendar state
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Day detail state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  async function fetchData() {
    try {
      const [vehicleData, bookingData] = await Promise.all([
        api.getVehicles(),
        api.getBookings(),
      ]);
      setVehicles(vehicleData);
      setBookings(bookingData.items || bookingData || []);
    } catch (err) {
      console.error('Failed to load availability data', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  function openNewBooking(prefillDate?: string) {
    setForm({
      ...EMPTY_FORM,
      startDate: prefillDate || '',
      endDate: prefillDate || '',
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleCreateBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vehicleId || !form.customerName.trim() || !form.startDate || !form.endDate) {
      setFormError('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setFormError('Enddatum muss nach Startdatum liegen.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await api.createBooking({
        vehicleId: form.vehicleId,
        customerName: form.customerName.trim(),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        notes: form.notes.trim() || undefined,
      });
      setShowModal(false);
      setForm(EMPTY_FORM);
      // Refresh bookings
      const bookingData = await api.getBookings();
      setBookings(bookingData.items || bookingData || []);
    } catch (err: any) {
      setFormError(err.message || 'Buchung konnte nicht erstellt werden.');
    } finally {
      setSaving(false);
    }
  }

  const bookedDates = useMemo(() => {
    const map = new Map<string, { booking: Booking; vehicle: Vehicle | undefined }[]>();

    const relevantBookings =
      selectedVehicle === 'all'
        ? bookings
        : bookings.filter((b) => b.vehicleId === selectedVehicle);

    for (const booking of relevantBookings) {
      if (booking.status === 'cancelled') continue;
      const start = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      const current = new Date(start);

      while (current <= end) {
        const key = current.toISOString().split('T')[0];
        const vehicle = vehicles.find((v) => v.id === booking.vehicleId);
        const existing = map.get(key) || [];
        existing.push({ booking, vehicle });
        map.set(key, existing);
        current.setDate(current.getDate() + 1);
      }
    }

    return map;
  }, [bookings, vehicles, selectedVehicle]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date().toISOString().split('T')[0];

  // Bookings for the selected date (day-detail panel)
  const selectedDateEntries = selectedDate ? (bookedDates.get(selectedDate) || []) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Verfügbarkeitskalender</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">Alle Fahrzeuge</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.brand} {v.model}
              </option>
            ))}
          </select>
          <button
            onClick={() => openNewBooking()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neue Buchung
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Calendar ────────────────────────── */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold">{MONTH_NAMES[month]} {year}</h2>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-neutral-500 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const entries = bookedDates.get(dateStr) || [];
              const isToday = dateStr === today;
              const hasBookings = entries.length > 0;
              const isSelected = dateStr === selectedDate;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                  className={`h-20 border rounded-lg p-1.5 text-xs text-left transition-colors ${
                    isSelected
                      ? 'border-brand-600 ring-2 ring-brand-300 bg-brand-50'
                      : isToday
                      ? 'border-brand-500 bg-brand-50'
                      : hasBookings
                      ? 'border-orange-200 bg-orange-50 hover:border-orange-300'
                      : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <div className={`font-semibold mb-0.5 ${isToday ? 'text-brand-600' : 'text-neutral-700'}`}>
                    {day}
                  </div>
                  {entries.slice(0, 2).map(({ booking, vehicle }, idx) => (
                    <div
                      key={idx}
                      className="text-[10px] leading-tight text-orange-700 truncate"
                      title={`${vehicle?.brand ?? ''} ${vehicle?.model ?? ''} — ${booking.customerName}`}
                    >
                      {vehicle ? `${vehicle.brand} ${vehicle.model.slice(0, 4)}` : 'Gebucht'}
                    </div>
                  ))}
                  {entries.length > 2 && (
                    <div className="text-[10px] text-neutral-400">+{entries.length - 2}</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-4 text-xs text-neutral-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-brand-500 bg-brand-50" />
              <span>Heute</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-orange-200 bg-orange-50" />
              <span>Gebucht</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-neutral-200" />
              <span>Verfügbar</span>
            </div>
          </div>
        </div>

        {/* ── Right Panel: Day Detail / Upcoming ── */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          {selectedDate ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-neutral-900">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('de-CH', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                <button
                  onClick={() => openNewBooking(selectedDate)}
                  className="p-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
                  title="Neue Buchung an diesem Tag"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {selectedDateEntries.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">Keine Buchungen</p>
                  <button
                    onClick={() => openNewBooking(selectedDate)}
                    className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium"
                  >
                    + Buchung hinzufügen
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateEntries.map(({ booking, vehicle }, idx) => (
                    <div key={idx} className="border border-neutral-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-neutral-900">
                          {booking.customerName}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[booking.status] || 'bg-neutral-100 text-neutral-600'}`}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Car className="w-3 h-3" />
                          {vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Unbekannt'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {fmtDate(booking.startDate)} – {fmtDate(booking.endDate)}
                        </div>
                        {booking.notes && (
                          <div className="flex items-start gap-1 mt-1">
                            <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="text-neutral-400">{booking.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="font-bold text-neutral-900 mb-4">Nächste Buchungen</h3>
              {bookings
                .filter((b) => b.status !== 'cancelled' && new Date(b.endDate) >= new Date())
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                .slice(0, 8)
                .map((booking) => {
                  const vehicle = vehicles.find((v) => v.id === booking.vehicleId);
                  return (
                    <div key={booking.id} className="flex items-center gap-3 py-2 border-b border-neutral-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate">{booking.customerName}</p>
                        <p className="text-xs text-neutral-500 truncate">
                          {vehicle ? `${vehicle.brand} ${vehicle.model}` : '–'} · {fmtDate(booking.startDate)} – {fmtDate(booking.endDate)}
                        </p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[booking.status] || 'bg-neutral-100 text-neutral-600'}`}>
                        {booking.status}
                      </span>
                    </div>
                  );
                })}
              {bookings.filter((b) => b.status !== 'cancelled' && new Date(b.endDate) >= new Date()).length === 0 && (
                <div className="text-center py-8">
                  <Calendar className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">Noch keine Buchungen.</p>
                  <button
                    onClick={() => openNewBooking()}
                    className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Erste Buchung erstellen
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── New Booking Modal ────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-900">Neue Buchung</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-neutral-100 transition-colors">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="p-6 space-y-4">
              {formError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              {/* Vehicle */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  <Car className="w-4 h-4 inline mr-1" />
                  Fahrzeug *
                </label>
                <select
                  value={form.vehicleId}
                  onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                >
                  <option value="">Fahrzeug wählen…</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  <User className="w-4 h-4 inline mr-1" />
                  Kundenname *
                </label>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Max Mustermann"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Von *
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Bis *
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate || undefined}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Notizen
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Optionale Notizen zur Buchung…"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Speichern…' : 'Buchung erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
