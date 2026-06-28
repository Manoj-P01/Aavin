'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    ],
  },
  {
    label: 'Daily Reports',
    items: [
      { href: '/dashboard/ts', icon: '🧪', label: 'Total Solids (TS)' },
      { href: '/dashboard/ts/new', icon: '➕', label: 'New TS Entry' },
    ],
  },
  {
    label: 'Stock Statement',
    items: [
      { href: '/dashboard/stock', icon: '📦', label: 'Stock Register' },
      { href: '/dashboard/stock/new', icon: '➕', label: 'New Stock Entry' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Brand */}
      <Link href="/dashboard" className="sidebar-brand">
        <div className="brand-logo">🥛</div>
        <div className="brand-text">
          <span className="brand-name">Aavin Dashboard</span>
          <span className="brand-sub">NKL Dairy Union</span>
        </div>
      </Link>

      {/* Navigation */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {NAV_SECTIONS.map(section => (
          <div key={section.label} className="sidebar-section">
            <div className="sidebar-section-label">{section.label}</div>
            <ul className="sidebar-nav">
              {section.items.map(item => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`sidebar-link ${isActive ? 'active' : ''}`}
                    >
                      <span className="icon">{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px 18px',
        borderTop: '1px solid var(--border)',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        lineHeight: 1.5,
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>
          Namakkal District
        </div>
        <div>Co-operative Milk Producers'</div>
        <div>Union Ltd</div>
      </div>
    </aside>
  );
}
