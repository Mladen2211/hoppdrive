'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  FileSignature,
  Search,
  PenTool,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Mail,
  User,
  Car,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Filter,
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { api } from '@/lib/api';
import dynamic from 'next/dynamic';

const SignaturePad = dynamic(() => import('@/components/SignaturePad'), { ssr: false });

interface Vehicle {
  id: string;
  brand: string;
  model: string;
}

interface Booking {
  id: string;
  vehicleId: string;
  customerName: string;
  customerEmail?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  notes?: string | null;
  totalPrice?: number;
  currency?: string;
  contractStatus?: string;
  signedAt?: string | null;
}

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Ausstehend', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  SIGNED: { label: 'Signiert', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
  VOIDED: { label: 'Storniert', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
};

const BOOKING_STATUS_COLORS: Record<string, string> = {
  reserved: 'bg-yellow-50 text-yellow-700',
  active: 'bg-green-50 text-green-700',
  completed: 'bg-neutral-100 text-neutral-600',
  cancelled: 'bg-red-50 text-red-700',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ContractsPage() {
  const { token } = useAdminAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Expanded booking detail
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Edit email inline
  const [editEmailId, setEditEmailId] = useState<string | null>(null);
  const [editEmailValue, setEditEmailValue] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Signature
  const [showSignature, setShowSignature] = useState(false);
  const [signingBooking, setSigningBooking] = useState<Booking | null>(null);
  const [signingLoading, setSigningLoading] = useState(false);

  async function fetchData() {
    try {
      const [bookingData, vehicleData] = await Promise.all([
        api.getBookings(),
        api.getVehicles(),
      ]);
      setBookings(bookingData.items || bookingData || []);
      setVehicles(vehicleData);
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Derived data
  const vehicleMap = useMemo(() => {
    const m = new Map<string, Vehicle>();
    vehicles.forEach((v) => m.set(v.id, v));
    return m;
  }, [vehicles]);

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        // Status filter
        if (statusFilter === 'pending') return (b.contractStatus || 'PENDING') === 'PENDING' && b.status !== 'cancelled';
        if (statusFilter === 'signed') return b.contractStatus === 'SIGNED';
        if (statusFilter === 'cancelled') return b.status === 'cancelled';
        return true;
      })
      .filter((b) => {
        if (!search) return true;
        const q = search.toLowerCase();
        const vehicle = vehicleMap.get(b.vehicleId);
        return (
          b.customerName.toLowerCase().includes(q) ||
          (b.customerEmail && b.customerEmail.toLowerCase().includes(q)) ||
          (vehicle && `${vehicle.brand} ${vehicle.model}`.toLowerCase().includes(q)) ||
          b.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [bookings, statusFilter, search, vehicleMap]);

  // Stats
  const stats = useMemo(() => {
    const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
    return {
      total: activeBookings.length,
      pending: activeBookings.filter((b) => (b.contractStatus || 'PENDING') === 'PENDING').length,
      signed: activeBookings.filter((b) => b.contractStatus === 'SIGNED').length,
    };
  }, [bookings]);

  // Actions
  function openSignaturePad(booking: Booking) {
    setSigningBooking(booking);
    setShowSignature(true);
  }

  async function handleSignContract(signatureDataUrl: string) {
    if (!signingBooking) return;
    setSigningLoading(true);
    try {
      await api.finalizeContract(signingBooking.id, {
        signature: signatureDataUrl,
        customerEmail: signingBooking.customerEmail || undefined,
      });
      setShowSignature(false);
      setSigningBooking(null);
      await fetchData();
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

  async function handleSaveEmail(bookingId: string) {
    if (!editEmailValue.trim()) return;
    setSavingEmail(true);
    try {
      await api.updateBooking(bookingId, { customerEmail: editEmailValue.trim() });
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, customerEmail: editEmailValue.trim() } : b)),
      );
      setEditEmailId(null);
      setEditEmailValue('');
    } catch (err: any) {
      alert(err.message || 'E-Mail konnte nicht gespeichert werden.');
    } finally {
      setSavingEmail(false);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Verträge</h1>
          <p className="text-sm text-neutral-500 mt-1">Mietverträge verwalten, signieren und herunterladen</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => setStatusFilter('all')}
          className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
            statusFilter === 'all' ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-200' : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center">
            <FileSignature className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
            <p className="text-xs text-neutral-500">Gesamt</p>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('pending')}
          className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
            statusFilter === 'pending' ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-200' : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-2xl font-bold text-neutral-900">{stats.pending}</p>
            <p className="text-xs text-neutral-500">Ausstehend</p>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('signed')}
          className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
            statusFilter === 'signed' ? 'border-green-300 bg-green-50 ring-1 ring-green-200' : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-2xl font-bold text-neutral-900">{stats.signed}</p>
            <p className="text-xs text-neutral-500">Signiert</p>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buchung suchen…"
            className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Bookings list */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-16">
            <FileSignature className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 text-sm">Keine Buchungen gefunden</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filteredBookings.map((booking) => {
              const vehicle = vehicleMap.get(booking.vehicleId);
              const contractStatus = booking.contractStatus || 'PENDING';
              const statusConfig = CONTRACT_STATUS_CONFIG[contractStatus] || CONTRACT_STATUS_CONFIG.PENDING;
              const StatusIcon = statusConfig.icon;
              const isExpanded = expandedId === booking.id;
              const isCancelled = booking.status === 'cancelled';

              return (
                <div key={booking.id} className={isCancelled ? 'opacity-60' : ''}>
                  {/* Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-neutral-50 transition-colors"
                  >
                    {/* Contract status icon */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${statusConfig.color}`}>
                      <StatusIcon className="w-4 h-4" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-neutral-900 truncate">{booking.customerName}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${BOOKING_STATUS_COLORS[booking.status] || 'bg-neutral-100 text-neutral-600'}`}>
                          {booking.status}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 truncate mt-0.5">
                        {vehicle ? `${vehicle.brand} ${vehicle.model}` : '–'} · {fmtDate(booking.startDate)} – {fmtDate(booking.endDate)}
                      </p>
                    </div>

                    {/* Price */}
                    {booking.totalPrice != null && booking.totalPrice > 0 && (
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-sm font-semibold text-neutral-900">
                          {booking.currency || 'CHF'} {Number(booking.totalPrice).toFixed(2)}
                        </p>
                      </div>
                    )}

                    {/* Actions (quick) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {contractStatus === 'SIGNED' && (
                        <span
                          onClick={(e) => { e.stopPropagation(); handleDownloadContract(booking.id); }}
                          className="p-2 rounded-lg text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                          title="Vertrag herunterladen"
                        >
                          <Download className="w-4 h-4" />
                        </span>
                      )}
                      {contractStatus === 'PENDING' && !isCancelled && (
                        <span
                          onClick={(e) => { e.stopPropagation(); openSignaturePad(booking); }}
                          className="p-2 rounded-lg text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                          title="Vertrag unterschreiben"
                        >
                          <PenTool className="w-4 h-4" />
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-neutral-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 bg-neutral-50 border-t border-neutral-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Customer info */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Kundendaten</h4>
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-neutral-400 shrink-0" />
                            <span className="text-neutral-900">{booking.customerName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-neutral-400 shrink-0" />
                            {editEmailId === booking.id ? (
                              <div className="flex items-center gap-1.5 flex-1">
                                <input
                                  type="email"
                                  value={editEmailValue}
                                  onChange={(e) => setEditEmailValue(e.target.value)}
                                  placeholder="E-Mail eingeben…"
                                  className="flex-1 border border-neutral-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                                  autoFocus
                                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEmail(booking.id)}
                                />
                                <button
                                  onClick={() => { setEditEmailId(null); setEditEmailValue(''); }}
                                  className="text-neutral-400 hover:text-neutral-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : booking.customerEmail ? (
                              <span className="text-neutral-900">{booking.customerEmail}</span>
                            ) : (
                              <button
                                onClick={() => { setEditEmailId(booking.id); setEditEmailValue(''); }}
                                className="text-brand-600 hover:text-brand-700 text-sm font-medium"
                              >
                                + E-Mail hinzufügen
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Booking info */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Buchung</h4>
                          <div className="flex items-center gap-2 text-sm">
                            <Car className="w-4 h-4 text-neutral-400 shrink-0" />
                            <span className="text-neutral-900">{vehicle ? `${vehicle.brand} ${vehicle.model}` : '–'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
                            <span className="text-neutral-900">{fmtDate(booking.startDate)} – {fmtDate(booking.endDate)}</span>
                          </div>
                          {booking.totalPrice != null && booking.totalPrice > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <DollarSign className="w-4 h-4 text-neutral-400 shrink-0" />
                              <span className="text-neutral-900 font-medium">{booking.currency || 'CHF'} {Number(booking.totalPrice).toFixed(2)}</span>
                            </div>
                          )}
                          {booking.notes && (
                            <div className="flex items-start gap-2 text-sm">
                              <FileText className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                              <span className="text-neutral-500">{booking.notes}</span>
                            </div>
                          )}
                        </div>

                        {/* Contract info + actions */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Vertrag</h4>

                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium border ${statusConfig.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConfig.label}
                          </div>

                          {booking.signedAt && (
                            <p className="text-xs text-neutral-500">
                              Signiert am {new Date(booking.signedAt).toLocaleString('de-CH')}
                            </p>
                          )}

                          <p className="text-[11px] text-neutral-400 font-mono">
                            Nr. {booking.id.substring(0, 8).toUpperCase()}
                          </p>

                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {contractStatus === 'PENDING' && !isCancelled && (
                              <button
                                onClick={() => openSignaturePad(booking)}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                              >
                                <PenTool className="w-4 h-4" />
                                Unterschreiben
                              </button>
                            )}
                            {contractStatus === 'SIGNED' && (
                              <button
                                onClick={() => handleDownloadContract(booking.id)}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors border border-brand-200"
                              >
                                <Download className="w-4 h-4" />
                                PDF herunterladen
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Signature Modal */}
      {showSignature && signingBooking && (
        <SignaturePad
          customerName={signingBooking.customerName}
          loading={signingLoading}
          onConfirm={handleSignContract}
          onCancel={() => {
            setShowSignature(false);
            setSigningBooking(null);
          }}
        />
      )}
    </div>
  );
}
