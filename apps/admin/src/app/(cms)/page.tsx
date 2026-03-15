'use client';

import { useEffect, useState } from 'react';
import { Car, MessageSquare, CalendarCheck, TrendingUp } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';

interface DashboardStats {
  totalVehicles: number;
  availableVehicles: number;
  totalInquiries: number;
  newInquiriesThisWeek: number;
  activeBookings: number;
  monthlyRevenue: number;
}

interface RecentInquiry {
  id: string;
  name: string;
  email: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  status: string;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const { token } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInquiries, setRecentInquiries] = useState<RecentInquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    async function fetchData() {
      try {
        const [statsData, inquiriesData] = await Promise.all([
          api.getDashboardStats(token!),
          api.getContactRequests(token!, { page: 1, limit: 5 }),
        ]);
        setStats(statsData);
        setRecentInquiries(inquiriesData.data || []);
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Übersicht</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Fahrzeuge gesamt"
          value={stats?.totalVehicles ?? 0}
          icon={<Car className="w-6 h-6" />}
        />
        <StatCard
          label="Neue Anfragen"
          value={stats?.newInquiriesThisWeek ?? 0}
          icon={<MessageSquare className="w-6 h-6" />}
          trend="diese Woche"
          trendUp
        />
        <StatCard
          label="Aktive Buchungen"
          value={stats?.activeBookings ?? 0}
          icon={<CalendarCheck className="w-6 h-6" />}
        />
        <StatCard
          label="Monatlicher Umsatz"
          value={`CHF ${(stats?.monthlyRevenue ?? 0).toLocaleString('de-CH')}`}
          icon={<TrendingUp className="w-6 h-6" />}
        />
      </div>

      {/* Recent inquiries table */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold">Aktuelle Anfragen</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="text-left px-6 py-3 text-neutral-500 font-medium">Name</th>
                <th className="text-left px-6 py-3 text-neutral-500 font-medium">E-Mail</th>
                <th className="text-left px-6 py-3 text-neutral-500 font-medium">Fahrzeug</th>
                <th className="text-left px-6 py-3 text-neutral-500 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-neutral-500 font-medium">Datum</th>
              </tr>
            </thead>
            <tbody>
              {recentInquiries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-neutral-400">
                    Noch keine Anfragen vorhanden.
                  </td>
                </tr>
              ) : (
                recentInquiries.map((inq) => (
                  <tr key={inq.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                    <td className="px-6 py-3 font-medium">{inq.name}</td>
                    <td className="px-6 py-3 text-neutral-600">{inq.email}</td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
