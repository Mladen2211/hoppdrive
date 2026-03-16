'use client';

import { useState } from 'react';
import { BarChart3, Calendar, Car, Download, TrendingUp } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';

interface VehicleReport {
  vehicleId: string;
  brand: string;
  model: string;
  bookings: {
    id: string;
    customerName: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
    currency: string;
    status: string;
    days: number;
  }[];
  totalEarnings: number;
  totalDays: number;
}

interface ReportData {
  from: string;
  to: string;
  vehicles: VehicleReport[];
  grandTotal: number;
  grandDays: number;
  totalBookings: number;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtCHF(amount: number) {
  return amount.toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Quick presets
function getPreset(preset: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'thisMonth':
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case 'lastMonth':
      return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
    case 'thisQuarter': {
      const q = Math.floor(m / 3) * 3;
      return { from: fmt(new Date(y, q, 1)), to: fmt(new Date(y, q + 3, 0)) };
    }
    case 'thisYear':
      return { from: fmt(new Date(y, 0, 1)), to: fmt(new Date(y, 11, 31)) };
    case 'lastYear':
      return { from: fmt(new Date(y - 1, 0, 1)), to: fmt(new Date(y - 1, 11, 31)) };
    default:
      return { from: fmt(new Date(y, m, 1)), to: fmt(now) };
  }
}

const STATUS_COLORS: Record<string, string> = {
  reserved: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-neutral-100 text-neutral-600',
  cancelled: 'bg-red-100 text-red-700',
};

export default function ReportsPage() {
  const { token } = useAdminAuth();

  const now = new Date();
  const [from, setFrom] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
  );
  const [to, setTo] = useState(now.toISOString().split('T')[0]);

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);

  async function fetchReport() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getBookingReport(from, to);
      setReport(data);
      setExpandedVehicle(null);
    } catch (err: any) {
      setError(err.message || 'Bericht konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(preset: string) {
    const { from: f, to: t } = getPreset(preset);
    setFrom(f);
    setTo(t);
  }

  function exportCSV() {
    if (!report) return;

    const rows: string[] = [
      'Fahrzeug;Kunde;Von;Bis;Tage;Preis (CHF);Status',
    ];

    for (const v of report.vehicles) {
      for (const b of v.bookings) {
        rows.push(
          [
            `${v.brand} ${v.model}`,
            b.customerName,
            fmtDate(b.startDate),
            fmtDate(b.endDate),
            b.days,
            fmtCHF(b.totalPrice),
            b.status,
          ].join(';'),
        );
      }
      rows.push(`${v.brand} ${v.model} — Gesamt;;;${v.totalDays};${fmtCHF(v.totalEarnings)};`);
    }
    rows.push(`GESAMT;;;;${report.grandDays};${fmtCHF(report.grandTotal)};`);

    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hoppdrive-bericht-${from}-bis-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Compute bar widths for visual chart
  const maxEarnings = report
    ? Math.max(...report.vehicles.map((v) => v.totalEarnings), 1)
    : 1;

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Einnahmenbericht</h1>

      {/* ── Controls ─────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-end gap-4">
          {/* Date pickers */}
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Von</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Bis</label>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Laden…' : 'Bericht erstellen'}
            </button>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'thisMonth', label: 'Dieser Monat' },
              { key: 'lastMonth', label: 'Letzter Monat' },
              { key: 'thisQuarter', label: 'Dieses Quartal' },
              { key: 'thisYear', label: 'Dieses Jahr' },
              { key: 'lastYear', label: 'Letztes Jahr' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className="px-3 py-1.5 text-xs font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {/* ── Report Results ───────────────────── */}
      {report && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Gesamteinnahmen</p>
                  <p className="text-xl font-bold text-neutral-900">CHF {fmtCHF(report.grandTotal)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Vermietete Tage</p>
                  <p className="text-xl font-bold text-neutral-900">{report.grandDays}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Buchungen</p>
                  <p className="text-xl font-bold text-neutral-900">{report.totalBookings}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Export button */}
          {report.vehicles.length > 0 && (
            <div className="flex justify-end mb-4">
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                CSV exportieren
              </button>
            </div>
          )}

          {/* Earnings bar chart + table */}
          {report.vehicles.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-12 text-center">
              <BarChart3 className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">Keine Buchungen im gewählten Zeitraum.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {report.vehicles.map((v) => {
                const barWidth = (v.totalEarnings / maxEarnings) * 100;
                const isExpanded = expandedVehicle === v.vehicleId;

                return (
                  <div
                    key={v.vehicleId}
                    className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedVehicle(isExpanded ? null : v.vehicleId)
                      }
                      className="w-full text-left p-5 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Car className="w-5 h-5 text-neutral-400" />
                          <span className="font-semibold text-neutral-900">
                            {v.brand} {v.model}
                          </span>
                          <span className="text-xs text-neutral-400">
                            {v.bookings.length} Buchung{v.bookings.length !== 1 ? 'en' : ''}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-green-700">
                            CHF {fmtCHF(v.totalEarnings)}
                          </span>
                          <span className="text-xs text-neutral-400 ml-2">
                            {v.totalDays} Tage
                          </span>
                        </div>
                      </div>
                      {/* Bar */}
                      <div className="w-full h-3 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </button>

                    {/* Expanded detail table */}
                    {isExpanded && (
                      <div className="border-t border-neutral-200 px-5 pb-4">
                        <table className="w-full text-sm mt-3">
                          <thead>
                            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-100">
                              <th className="pb-2 font-medium">Kunde</th>
                              <th className="pb-2 font-medium">Zeitraum</th>
                              <th className="pb-2 font-medium text-right">Tage</th>
                              <th className="pb-2 font-medium text-right">Preis</th>
                              <th className="pb-2 font-medium text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {v.bookings.map((b) => (
                              <tr
                                key={b.id}
                                className="border-b border-neutral-50 last:border-0"
                              >
                                <td className="py-2 text-neutral-900">{b.customerName}</td>
                                <td className="py-2 text-neutral-500">
                                  {fmtDate(b.startDate)} – {fmtDate(b.endDate)}
                                </td>
                                <td className="py-2 text-right text-neutral-500">{b.days}</td>
                                <td className="py-2 text-right font-medium text-neutral-900">
                                  CHF {fmtCHF(b.totalPrice)}
                                </td>
                                <td className="py-2 text-right">
                                  <span
                                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                      STATUS_COLORS[b.status] || 'bg-neutral-100 text-neutral-600'
                                    }`}
                                  >
                                    {b.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-neutral-200 font-semibold text-neutral-900">
                              <td className="pt-2" colSpan={2}>
                                Zwischensumme
                              </td>
                              <td className="pt-2 text-right">{v.totalDays}</td>
                              <td className="pt-2 text-right text-green-700">
                                CHF {fmtCHF(v.totalEarnings)}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Grand total bar */}
              <div className="bg-neutral-900 text-white rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">Gesamt</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold">
                      CHF {fmtCHF(report.grandTotal)}
                    </span>
                    <span className="text-sm text-neutral-400 ml-3">
                      {report.grandDays} Tage · {report.totalBookings} Buchungen
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
