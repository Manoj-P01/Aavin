'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface Props { reportType: 'TS' | 'STOCK'; }

interface MonthPoint { month: string; count: number; }

export default function MonthlyTrendChart({ reportType }: Props) {
  const [data, setData] = useState<MonthPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/entries?report_type=${reportType}`);
        const json = await res.json();
        const entries = (json.data || []) as { entry_date: string }[];
        const counts: Record<string, number> = {};
        for (const e of entries) {
          const m = e.entry_date.slice(0, 7); // YYYY-MM
          counts[m] = (counts[m] || 0) + 1;
        }
        setData(
          Object.entries(counts)
            .slice(-12)
            .map(([month, count]) => ({ month: month.replace('-', '/'), count }))
        );
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [reportType]);

  const color = reportType === 'TS' ? '#0ea5e9' : '#f59e0b';
  const label = reportType === 'TS' ? 'TS Report Entries' : 'Stock Entries';

  return (
    <div className="chart-container">
      <div className="chart-title">{label} — Monthly Trend</div>
      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
      ) : data.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div className="empty-state-icon">📈</div>
          <div className="empty-state-text">No data yet</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${reportType}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.5)" />
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#1a2235', border: '1px solid #1e3a5f', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color }}
            />
            <Area
              type="monotone"
              dataKey="count"
              name="Entries"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${reportType})`}
              dot={{ fill: color, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
