'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/context/SidebarContext';
import { useConfirm } from '@/context/ConfirmContext';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', icon: '📊', label: 'Dashboard' },
      { href: '/dashboard/stock/periodical', icon: '📅', label: 'Periodical Summary Report' },
    ],
  },
  {
    label: 'Stock Statement',
    items: [
      { href: '/dashboard/stock/preparation-charts', icon: '📋', label: 'Preparation Charts' },
      { href: '/dashboard/stock/new', icon: '📦', label: 'New Stock Statement Entry' },
      { href: '/dashboard/stock', icon: '📦', label: 'Stock Register' },
      { href: '/dashboard/stock/preparation-charts/masters', icon: '📊', label: 'Chart Names Master' },
      { href: '/dashboard/stock/preparation-charts/defaults', icon: '⭐', label: 'Master Default Formulations' },
      { href: '/dashboard/stock/preparation-charts/columns', icon: '⚙️', label: 'Chart Columns Config' },
      { href: '/dashboard/stock/products', icon: '⚙️', label: 'Products List' },
      { href: '/dashboard/stock/mappings', icon: '🔄', label: 'Disposals ➔ Receipts Mappings' },
      { href: '/dashboard/stock/partitions', icon: '🔀', label: 'Receipts Internal Partitions' },
    ],
  },
  {
    label: 'Daily Reports',
    items: [
      { href: '/dashboard/ts/new-stg', icon: '⚖️', label: 'New STG Entry' },
      { href: '/dashboard/ts/new', icon: '🧪', label: 'New TS Entry' },
      { href: '/dashboard/ts', icon: '🧪', label: 'Total Solids (TS)' },
      { href: '/dashboard/ts/mappings', icon: '🔗', label: 'Stock ⇄ STG Mappings' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { href: '/dashboard/ts/config', icon: '🧮', label: 'STG Calculation Settings' },
      { action: 'settings', icon: '🔧', label: 'Shift Settings' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, setConfigOpen } = useSidebar();
  const { confirm } = useConfirm();

  const handleLinkClick = () => {
    // Do not auto-close sidebar on link click.
  };

  const handleLogout = async () => {
    const isConfirmed = await confirm({
      title: 'Confirm Logout',
      message: 'Are you sure you want to log out of Aavin Dairy Dashboard?',
      confirmText: 'Log Out',
      cancelText: 'Cancel',
      type: 'warning',
    });

    if (!isConfirmed) return;

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      window.location.href = '/login';
    }
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
                           !['new', 'new-stg', 'config', 'mappings'].includes(pathSegments[3]);
                  }
                  if (href === '/dashboard/stock') {
                    return pathSegments[1] === 'dashboard' && 
                           pathSegments[2] === 'stock' && 
                           pathSegments[3] !== 'new' &&
                           pathSegments[3] !== 'products' &&
                           pathSegments[3] !== 'mappings' &&
                           pathSegments[3] !== 'partitions' &&
                           pathSegments[3] !== 'preparation-charts' &&
                           pathSegments[3] !== 'periodical';
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
        padding: '14px 18px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: '0.75rem' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>admin</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Administrator</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Log Out of System"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#dc2626',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s ease',
            }}
          >
            <span>🚪</span> Logout
          </button>
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Namakkal District Co-operative Milk Producers' Union Ltd
        </div>
      </div>
    </aside>
  );
}
