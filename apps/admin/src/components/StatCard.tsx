import { type ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ label, value, icon, trend, trendUp }: StatCardProps) {
  return (
    <div className="bg-card rounded-xl p-6 shadow-sm border border-line">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-graphite mb-1">{label}</p>
          <p className="text-3xl font-bold text-ink">{value}</p>
          {trend && (
            <p
              className={`text-xs mt-2 font-medium ${
                trendUp ? 'text-ok' : 'text-err'
              }`}
            >
              {trendUp ? '↑' : '↓'} {trend}
            </p>
          )}
        </div>
        <div className="bg-brand-50 p-3 rounded-lg text-brand-600">{icon}</div>
      </div>
    </div>
  );
}
