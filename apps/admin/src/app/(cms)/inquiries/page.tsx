'use client';

import { useEffect, useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';

interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  message: string;
  status: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
  createdAt: string;
}

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'closed', 'spam'];
const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  contacted: 'Kontaktiert',
  qualified: 'Qualifiziert',
  closed: 'Abgeschlossen',
  spam: 'Spam',
};

export default function InquiriesPage() {
  const { token } = useAdminAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  async function fetchInquiries(pageNum = 1) {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getContactRequests({ page: pageNum, limit: 15 });
      setInquiries(data.items || []);
      setTotalPages(Math.ceil((data.total || 0) / 15));
    } catch (err) {
      console.error('Failed to fetch inquiries', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInquiries(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page]);

  async function handleStatusChange(id: string, newStatus: string) {
    if (!token) return;
    setUpdating(id);
    try {
      await api.updateContactStatus(id, newStatus);
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === id ? { ...inq, status: newStatus } : inq))
      );
    } catch (err) {
      console.error('Status update failed', err);
    } finally {
      setUpdating(null);
    }
  }

  const filteredInquiries = search
    ? inquiries.filter(
        (inq) =>
          inq.name.toLowerCase().includes(search.toLowerCase()) ||
          inq.email.toLowerCase().includes(search.toLowerCase()) ||
          (inq.vehicleBrand?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : inquiries;

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Anfragen</h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Suche nach Name, E-Mail, Fahrzeug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-neutral-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="text-left px-6 py-3 text-neutral-500 font-medium">Name</th>
                  <th className="text-left px-6 py-3 text-neutral-500 font-medium">Kontakt</th>
                  <th className="text-left px-6 py-3 text-neutral-500 font-medium">Fahrzeug</th>
                  <th className="text-left px-6 py-3 text-neutral-500 font-medium">Status</th>
                  <th className="text-left px-6 py-3 text-neutral-500 font-medium">Datum</th>
                </tr>
              </thead>
              <tbody>
                {filteredInquiries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-neutral-400">
                      Keine Anfragen gefunden.
                    </td>
                  </tr>
                ) : (
                  filteredInquiries.map((inq) => (
                    <>
                      <tr
                        key={inq.id}
                        className="border-b border-neutral-50 hover:bg-neutral-50 cursor-pointer"
                        onClick={() =>
                          setExpandedId(expandedId === inq.id ? null : inq.id)
                        }
                      >
                        <td className="px-6 py-3 font-medium">{inq.name}</td>
                        <td className="px-6 py-3 text-neutral-600">
                          <div>{inq.email}</div>
                          {inq.phone && (
                            <div className="text-xs text-neutral-400">{inq.phone}</div>
                          )}
                        </td>
                        <td className="px-6 py-3 text-neutral-600">
                          {inq.vehicleBrand && inq.vehicleModel
                            ? `${inq.vehicleBrand} ${inq.vehicleModel}`
                            : '—'}
                        </td>
                        <td className="px-6 py-3">
                          <StatusBadge status={inq.status} />
                        </td>
                        <td className="px-6 py-3 text-neutral-500">
                          {new Date(inq.createdAt).toLocaleDateString('de-CH')}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {expandedId === inq.id && (
                        <tr key={`${inq.id}-detail`} className="border-b border-neutral-100">
                          <td colSpan={5} className="px-6 py-4 bg-neutral-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="md:col-span-2">
                                <p className="text-xs font-semibold text-neutral-500 uppercase mb-1">
                                  Nachricht
                                </p>
                                <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                                  {inq.message}
                                </p>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs font-semibold text-neutral-500 uppercase mb-1">
                                    Einwilligung
                                  </p>
                                  <p className="text-xs text-neutral-600">
                                    Datenschutz: {inq.privacyConsent ? '✓ Ja' : '✗ Nein'}
                                    <br />
                                    Marketing: {inq.marketingConsent ? '✓ Ja' : '✗ Nein'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-neutral-500 uppercase mb-1">
                                    Status ändern
                                  </p>
                                  <select
                                    value={inq.status}
                                    disabled={updating === inq.id}
                                    onChange={(e) =>
                                      handleStatusChange(inq.id, e.target.value)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-full"
                                  >
                                    {STATUS_OPTIONS.map((s) => (
                                      <option key={s} value={s}>
                                        {STATUS_LABELS[s] || s}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-200">
              <p className="text-xs text-neutral-500">
                Seite {page} von {totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1.5 rounded hover:bg-neutral-100 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-1.5 rounded hover:bg-neutral-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
