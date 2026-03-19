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
  Receipt,
  Loader2,
  RefreshCw,
  AlertTriangle,
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

interface Invoice {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  vatAmount: number;
  penalty: number;
  total: number;
  currency: string;
  status: 'PENDING' | 'PAID';
  parentInvoiceId?: string | null;
  notes?: string | null;
  createdAt: string;
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

function toInputDate(iso: string) {
  return new Date(iso).toISOString().split('T')[0];
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

  // Invoice creation per booking
  const [invoicePeriod, setInvoicePeriod] = useState<Record<string, { start: string; end: string }>>({});
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null);

  // Invoice list per booking
  const [bookingInvoices, setBookingInvoices] = useState<Record<string, Invoice[]>>({});
  const [invoicesLoading, setInvoicesLoading] = useState<string | null>(null);

  // Reissue dialog
  const [reissueInvoice, setReissueInvoice] = useState<Invoice | null>(null);
  const [reissuePenalty, setReissuePenalty] = useState('');
  const [reissueNotes, setReissueNotes] = useState('');
  const [reissueLoading, setReissueLoading] = useState(false);

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

  // When a booking is expanded, load its invoices + set default period
  useEffect(() => {
    if (!expandedId) return;
    const booking = bookings.find((b) => b.id === expandedId);
    if (booking && !invoicePeriod[expandedId]) {
      setInvoicePeriod((prev) => ({
        ...prev,
        [expandedId]: { start: toInputDate(booking.startDate), end: toInputDate(booking.endDate) },
      }));
    }
    loadInvoicesForBooking(expandedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId]);

  async function loadInvoicesForBooking(bookingId: string) {
    setInvoicesLoading(bookingId);
    try {
      const invoices = await api.getInvoices({ bookingId });
      setBookingInvoices((prev) => ({ ...prev, [bookingId]: invoices }));
    } catch (err) {
      console.error('Failed to load invoices', err);
    } finally {
      setInvoicesLoading(null);
    }
  }

  // Derived data
  const vehicleMap = useMemo(() => {
    const m = new Map<string, Vehicle>();
    vehicles.forEach((v) => m.set(v.id, v));
    return m;
  }, [vehicles]);

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => {
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

  const stats = useMemo(() => {
    const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
    return {
      total: activeBookings.length,
      pending: activeBookings.filter((b) => (b.contractStatus || 'PENDING') === 'PENDING').length,
      signed: activeBookings.filter((b) => b.contractStatus === 'SIGNED').length,
    };
  }, [bookings]);

  // ─── Actions ─────────────────────────────────────────────

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

  function triggerBlobDownload(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  async function handleCreateInvoice(booking: Booking) {
    const period = invoicePeriod[booking.id];
    if (!period || !period.start || !period.end) {
      alert('Bitte Zeitraum auswählen.');
      return;
    }
    setInvoiceLoading(booking.id);
    try {
      const invoice = await api.createInvoice({
        bookingId: booking.id,
        periodStart: period.start,
        periodEnd: period.end,
      });
      // Download the new invoice immediately
      const blob = await api.downloadInvoice(invoice.id);
      triggerBlobDownload(blob, `HoppDrive-Rechnung-${invoice.invoiceNumber}.pdf`);
      // Refresh invoice list
      await loadInvoicesForBooking(booking.id);
    } catch (err: any) {
      alert(err.message || 'Rechnung konnte nicht erstellt werden.');
    } finally {
      setInvoiceLoading(null);
    }
  }

  async function handleToggleStatus(inv: Invoice) {
    const newStatus = inv.status === 'PENDING' ? 'PAID' : 'PENDING';
    try {
      await api.toggleInvoiceStatus(inv.id, newStatus);
      await loadInvoicesForBooking(inv.bookingId);
    } catch (err: any) {
      alert(err.message || 'Status konnte nicht geändert werden.');
    }
  }

  async function handleReissue() {
    if (!reissueInvoice) return;
    setReissueLoading(true);
    try {
      const newInvoice = await api.reissueInvoice(reissueInvoice.id, {
        penalty: Number(reissuePenalty) || 0,
        notes: reissueNotes || undefined,
      });
      // Download reissued invoice
      const blob = await api.downloadInvoice(newInvoice.id);
      triggerBlobDownload(blob, `HoppDrive-Rechnung-${newInvoice.invoiceNumber}.pdf`);
      await loadInvoicesForBooking(reissueInvoice.bookingId);
      setReissueInvoice(null);
      setReissuePenalty('');
      setReissueNotes('');
    } catch (err: any) {
      alert(err.message || 'Mahnung konnte nicht erstellt werden.');
    } finally {
      setReissueLoading(false);
    }
  }

  async function handleDownloadInvoice(inv: Invoice) {
    try {
      const blob = await api.downloadInvoice(inv.id);
      triggerBlobDownload(blob, `HoppDrive-Rechnung-${inv.invoiceNumber}.pdf`);
    } catch (err: any) {
      alert(err.message || 'Rechnung konnte nicht heruntergeladen werden.');
    }
  }

  async function handleDownloadContract(bookingId: string) {
    try {
      const blob = await api.downloadContract(bookingId);
      triggerBlobDownload(blob, `HoppDrive-Vertrag-${bookingId.substring(0, 8).toUpperCase()}.pdf`);
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
              const invoices = bookingInvoices[booking.id] || [];
              const period = invoicePeriod[booking.id] || { start: '', end: '' };

              return (
                <div key={booking.id} className={isCancelled ? 'opacity-60' : ''}>
                  {/* Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-neutral-50 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${statusConfig.color}`}>
                      <StatusIcon className="w-4 h-4" />
                    </div>

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

                    {booking.totalPrice != null && booking.totalPrice > 0 && (
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-sm font-semibold text-neutral-900">
                          {booking.currency || 'CHF'} {Number(booking.totalPrice).toFixed(2)}
                        </p>
                      </div>
                    )}

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
                                Vertrag PDF
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ─── Invoice Section ──────────────────────── */}
                      {!isCancelled && booking.totalPrice != null && booking.totalPrice > 0 && (
                        <div className="mt-6 pt-5 border-t border-neutral-200">
                          <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Rechnungen</h4>

                          {/* New invoice: date range + create */}
                          <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-white rounded-lg border border-neutral-200">
                            <div>
                              <label className="block text-[11px] font-medium text-neutral-500 mb-1">Von</label>
                              <input
                                type="date"
                                value={period.start}
                                onChange={(e) => setInvoicePeriod((p) => ({ ...p, [booking.id]: { ...p[booking.id], start: e.target.value } }))}
                                className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-neutral-500 mb-1">Bis</label>
                              <input
                                type="date"
                                value={period.end}
                                onChange={(e) => setInvoicePeriod((p) => ({ ...p, [booking.id]: { ...p[booking.id], end: e.target.value } }))}
                                className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                              />
                            </div>
                            <button
                              onClick={() => handleCreateInvoice(booking)}
                              disabled={invoiceLoading === booking.id}
                              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {invoiceLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                              Rechnung erstellen
                            </button>
                          </div>

                          {/* Existing invoices list */}
                          {invoicesLoading === booking.id ? (
                            <div className="flex items-center gap-2 text-sm text-neutral-400 py-3">
                              <Loader2 className="w-4 h-4 animate-spin" /> Rechnungen laden…
                            </div>
                          ) : invoices.length === 0 ? (
                            <p className="text-sm text-neutral-400 py-2">Keine Rechnungen vorhanden.</p>
                          ) : (
                            <div className="space-y-2">
                              {invoices.map((inv) => (
                                <div
                                  key={inv.id}
                                  className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-lg border border-neutral-200"
                                >
                                  {/* Invoice number + period */}
                                  <div className="flex-1 min-w-[200px]">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-neutral-900">{inv.invoiceNumber}</span>
                                      {inv.parentInvoiceId && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                                          Mahnung
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                      {fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}
                                      {inv.penalty > 0 && (
                                        <span className="ml-2 text-orange-600">
                                          (+ {inv.currency} {inv.penalty.toFixed(2)} Mahngebühr)
                                        </span>
                                      )}
                                    </p>
                                  </div>

                                  {/* Amount */}
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-neutral-900">
                                      {inv.currency} {inv.total.toFixed(2)}
                                    </p>
                                    <p className="text-[11px] text-neutral-400">
                                      {fmtDate(inv.issueDate)}
                                    </p>
                                  </div>

                                  {/* Status badge – click to toggle */}
                                  <button
                                    onClick={() => handleToggleStatus(inv)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                                      inv.status === 'PAID'
                                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                    }`}
                                    title={inv.status === 'PAID' ? 'Klicken: auf Ausstehend setzen' : 'Klicken: als Bezahlt markieren'}
                                  >
                                    {inv.status === 'PAID' ? 'Bezahlt' : 'Ausstehend'}
                                  </button>

                                  {/* Actions */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleDownloadInvoice(inv)}
                                      className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50 transition-colors"
                                      title="Rechnung herunterladen"
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                    {inv.status === 'PENDING' && (
                                      <button
                                        onClick={() => {
                                          setReissueInvoice(inv);
                                          setReissuePenalty('');
                                          setReissueNotes('');
                                        }}
                                        className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50 transition-colors"
                                        title="Mahnung erstellen"
                                      >
                                        <RefreshCw className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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

      {/* Reissue Modal */}
      {reissueInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Mahnung erstellen</h3>
                <p className="text-sm text-neutral-500">Rechnung {reissueInvoice.invoiceNumber} erneut ausstellen</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Mahngebühr ({reissueInvoice.currency})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={reissuePenalty}
                  onChange={(e) => setReissuePenalty(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Bemerkung (optional)</label>
                <input
                  type="text"
                  value={reissueNotes}
                  onChange={(e) => setReissueNotes(e.target.value)}
                  placeholder="z.B. 2. Mahnung"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="bg-neutral-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-neutral-600">
                  <span>Originalbetrag</span>
                  <span>{reissueInvoice.currency} {(reissueInvoice.total - reissueInvoice.penalty).toFixed(2)}</span>
                </div>
                {Number(reissuePenalty) > 0 && (
                  <div className="flex justify-between text-orange-600 mt-1">
                    <span>+ Mahngebühr</span>
                    <span>{reissueInvoice.currency} {Number(reissuePenalty).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-neutral-900 mt-2 pt-2 border-t border-neutral-200">
                  <span>Neuer Betrag</span>
                  <span>{reissueInvoice.currency} {((reissueInvoice.total - reissueInvoice.penalty) + Number(reissuePenalty || 0)).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-5">
              <button
                onClick={() => setReissueInvoice(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleReissue}
                disabled={reissueLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {reissueLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Mahnung senden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
