'use client';

import { useEffect, useState, useMemo } from 'react';
import { Car, MessageSquare, CalendarCheck, TrendingUp, MoreHorizontal, Download, PenTool, ArrowUpRight, FileText } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';

const SignaturePad = dynamic(() => import('@/components/SignaturePad'), { ssr: false });


interface DashboardStats {
  totalVehicles: number;
  availableVehicles: number;
  totalInquiries: number;
  newInquiriesThisWeek: number;
  activeBookings: number;
  monthlyRevenue: number;
  revenueChangePercent?: number;
}

export default function AdminDashboardPage() {
  const { token } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Signature modal
  const [showSignature, setShowSignature] = useState(false);
  const [signingBooking, setSigningBooking] = useState<any | null>(null);
  const [signingLoading, setSigningLoading] = useState(false);

  useEffect(() => {
    if (!token) return;

    async function fetchData() {
      try {
        const [statsData, bookingsData] = await Promise.all([
          api.getDashboardStats(),
          api.getBookings(),
        ]);
        setStats(statsData);
        setBookings(bookingsData.items || bookingsData || []);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const kpiData = [
    { title: 'Fahrzeuge gesamt', value: stats?.totalVehicles ?? '–', icon: Car, trend: null },
    { title: 'Neue Anfragen', value: stats?.newInquiriesThisWeek ?? '–', icon: MessageSquare, trend: stats?.newInquiriesThisWeek ? `${stats.newInquiriesThisWeek} diese Woche` : null, trendUp: true },
    { title: 'Aktive Buchungen', value: stats?.activeBookings ?? '–', icon: CalendarCheck, trend: null },
    { title: 'Monatlicher Umsatz', value: `CHF ${stats?.monthlyRevenue ?? 0}`, icon: TrendingUp, trend: stats?.revenueChangePercent ? `${stats.revenueChangePercent}%` : null, trendUp: (stats?.revenueChangePercent || 0) > 0 },
  ];

  async function openSignaturePad(booking: any) {
    setSigningBooking(booking);
    setShowSignature(true);
  }

  async function handleSignContract(signatureDataUrl: string) {
    if (!signingBooking) return;
    setSigningLoading(true);
    try {
      await api.finalizeContract(signingBooking.id, { signature: signatureDataUrl, customerEmail: signingBooking.customerEmail || undefined });
      setShowSignature(false);
      setSigningBooking(null);
      // refresh bookings
      const b = await api.getBookings();
      setBookings(b.items || b || []);
    } catch (err: any) {
      alert(err.message || 'Vertrag konnte nicht signiert werden.');
    } finally {
      setSigningLoading(false);
    }
  }

  async function handleDownloadContract(bookingId: string) {
    try {
      const blob = await api.downloadContract(bookingId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HoppDrive-Vertrag-${bookingId.substring(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Vertrag konnte nicht heruntergeladen werden.');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Übersicht</h1>
          <p className="text-sm text-neutral-500 mt-1">Mietverträge und Systemstatus auf einen Blick</p>
        </div>
        <button className="hidden sm:flex items-center justify-center gap-2 bg-white border border-neutral-200 text-neutral-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-neutral-50 hover:shadow-sm transition-all active:scale-95">
          <FileText className="w-4 h-4" />
          Bericht exportieren
        </button>
      </div>

      {/* KPI grid (demo style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpiData.map((kpi, idx) => {
          const Icon = kpi.icon as any;
          return (
            <div key={idx} className="group bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <p className="text-sm font-semibold text-neutral-500">{kpi.title}</p>
                <div className="p-2 bg-neutral-50 rounded-xl text-neutral-400">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-neutral-900 tracking-tight">{kpi.value}</h3>
              </div>
              <div className="mt-4 h-5 flex items-center">
                {kpi.trend ? (
                  <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md ${kpi.trendUp ? 'text-emerald-700 bg-emerald-50' : 'text-neutral-600 bg-neutral-50'}`}>
                    {kpi.trendUp && <TrendingUp className="w-3.5 h-3.5" />}
                    {kpi.trend}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400 font-medium">Keine Änderung</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bookings table */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Aktuelle Buchungen</h2>
          <button className="text-sm font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
            Alle ansehen
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-neutral-400 uppercase tracking-widest">Kunde</th>
                <th className="px-6 py-3 text-xs font-bold text-neutral-400 uppercase tracking-widest">Kontakt</th>
                <th className="px-6 py-3 text-xs font-bold text-neutral-400 uppercase tracking-widest">Fahrzeug</th>
                <th className="px-6 py-3 text-xs font-bold text-neutral-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-3 text-xs font-bold text-neutral-400 uppercase tracking-widest">Datum</th>
                <th className="px-6 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-neutral-400">Keine Buchungen vorhanden.</td>
                </tr>
              ) : (
                bookings.map((b) => {
                  const vehicleLabel = b.vehicle?.brand ? `${b.vehicle.brand} ${b.vehicle.model}` : (b.vehicleId || '–');
                  const dateLabel = b.startDate ? new Date(b.startDate).toLocaleDateString('de-CH') : (b.createdAt ? new Date(b.createdAt).toLocaleDateString('de-CH') : '–');
                  const contractStatus = b.contractStatus || 'PENDING';
                  return (
                    <tr key={b.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-neutral-900">{b.customerName}</td>
                      <td className="px-6 py-3 text-neutral-600">{b.customerEmail || '–'}</td>
                      <td className="px-6 py-3 text-neutral-600">{vehicleLabel}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={contractStatus} />
                          <span className="text-xs text-neutral-400">{b.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-neutral-500">{dateLabel}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {contractStatus === 'SIGNED' ? (
                            <button onClick={() => handleDownloadContract(b.id)} title="Vertrag herunterladen" className="p-2 rounded-lg text-brand-600 hover:bg-brand-50 transition-colors">
                              <Download className="w-4 h-4" />
                            </button>
                          ) : (
                            <button onClick={() => openSignaturePad(b)} title="Vertrag unterschreiben" className="p-2 rounded-lg text-brand-600 hover:bg-brand-50 transition-colors">
                              <PenTool className="w-4 h-4" />
                            </button>
                          )}

                          <button className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg opacity-0 hover:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSignature && signingBooking && (
        <SignaturePad
          customerName={signingBooking.customerName}
          loading={signingLoading}
          onCancel={() => { setShowSignature(false); setSigningBooking(null); }}
          onConfirm={handleSignContract}
        />
      )}
    </div>
  );
}
