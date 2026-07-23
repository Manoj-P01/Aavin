'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/context/SidebarContext';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    ],
  },
  {
    label: 'Stock Statement',
    items: [
      { href: '/dashboard/stock/new', icon: '📦', label: 'New Stock Statement Entry' },
      { href: '/dashboard/stock', icon: '📦', label: 'Stock Register' },
    ],
  },
  {
    label: 'Daily Reports',
    items: [
      { href: '/dashboard/ts/new-stg', icon: '⚖️', label: 'New STG Entry' },
      { href: '/dashboard/ts/new', icon: '🧪', label: 'New TS Entry' },
      { href: '/dashboard/ts', icon: '🧪', label: 'Total Solids (TS)' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { href: '/dashboard/stock/products', icon: '📦', label: 'Stock Products' },
      { href: '/dashboard/stock/mappings', icon: '🔗', label: 'Statement Mapping' },
      { href: '/dashboard/ts/manage-formulas', icon: '🧮', label: 'Manage Formulas' },
      { action: 'settings', icon: '🔧', label: 'Shift Settings' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, setConfigOpen } = useSidebar();

  const handleLinkClick = () => {
    // Do not auto-close sidebar on link click.
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <Link href="/dashboard" className="sidebar-brand" onClick={handleLinkClick}>
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
                if ('action' in item && item.action === 'settings') {
                  return (
                    <li key="settings">
                      <button
                        type="button"
                        className="sidebar-link"
                        onClick={() => {
                          setConfigOpen(true);
                          handleLinkClick();
                        }}
                      >
                        <span className="icon">{item.icon}</span>
                        {item.label}
                      </button>
                    </li>
                  );
                }
                const href = (item as any).href;
                const isActive = (() => {
                  if (href === '/dashboard') return pathname === '/dashboard';
                  
                  const hrefSegments = href.split('/');
                  const pathSegments = pathname.split('/');
                  
                  if (href === '/dashboard/ts') {
                    return pathSegments[1] === 'dashboard' && 
                           pathSegments[2] === 'ts' && 
                           !['new', 'new-stg', 'manage-formulas'].includes(pathSegments[3]);
                  }
                  if (href === '/dashboard/stock') {
                    return pathSegments[1] === 'dashboard' && 
                           pathSegments[2] === 'stock' && 
                           pathSegments[3] !== 'new' &&
                           pathSegments[3] !== 'products' &&
                           pathSegments[3] !== 'mappings';
                  }
                  
                  return hrefSegments.every((seg: string, idx: number) => pathSegments[idx] === seg);
                })();
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`sidebar-link ${isActive ? 'active' : ''}`}
                      onClick={handleLinkClick}
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
