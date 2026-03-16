'use client';

import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function AvailabilityPage() {
  const { token } = useAdminAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  useEffect(() => {
    if (!token) return;
    async function fetchData() {
      try {
        const [vehicleData, bookingData] = await Promise.all([
          api.getVehicles(),
          api.getBookings(),
        ]);
        setVehicles(vehicleData);
        setBookings(bookingData);
      } catch (err) {
        console.error('Failed to load availability data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token]);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Verfügbarkeitskalender</h1>
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
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-neutral-500 py-1">
              {d}
            </div>
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

            return (
              <div
                key={day}
                className={`h-20 border rounded-lg p-1.5 text-xs transition-colors ${
                  isToday
                    ? 'border-brand-500 bg-brand-50'
                    : hasBookings
                    ? 'border-orange-200 bg-orange-50'
                    : 'border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <div
                  className={`font-semibold mb-0.5 ${
                    isToday ? 'text-brand-600' : 'text-neutral-700'
                  }`}
                >
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
                  <div className="text-[10px] text-neutral-400">+{entries.length - 2} weitere</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
  );
}
