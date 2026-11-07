'use client';

import { useState, useEffect } from 'react';
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
    label: 'Chart Preparation',
    items: [
      { href: '/dashboard/stock/preparation-charts/masters', icon: '📊', label: 'Chart Names Master' },
      { href: '/dashboard/stock/preparation-charts/defaults', icon: '⭐', label: 'Master Default Formulations' },
      { href: '/dashboard/stock/preparation-charts/columns', icon: '⚙️', label: 'Chart Columns Config' },
      { href: '/dashboard/stock/new?step=prep', icon: '📋', label: 'Preparation Charts' },
    ],
  },
  {
    label: 'Stock Statement',
    items: [
      { href: '/dashboard/stock/new?step=stock', icon: '📦', label: 'New Stock Statement Entry' },
      { href: '/dashboard/stock/defaults', icon: '⭐', label: 'Master Default Statement' },
      { href: '/dashboard/stock', icon: '📋', label: 'Stock Register' },
      { href: '/dashboard/stock/products', icon: '🥛', label: 'Products List' },
    ],
  },
  {
    label: 'STG Entry',
    items: [
      { href: '/dashboard/stock/new?step=stg', icon: '⚖️', label: 'New STG Entry' },
      { href: '/dashboard/ts/manage-statements', icon: '📊', label: 'Statement Master Names' },
      { href: '/dashboard/ts/manage-statements/defaults', icon: '⭐', label: 'Master Default Statements' },
      { href: '/dashboard/ts/manage-statements/columns', icon: '⚙️', label: 'Statement Columns Config' },
      { href: '/dashboard/ts/mappings', icon: '🔗', label: 'Solid Balance STG Mapping' },
    ],
  },
  {
    label: 'TS Entry',
    items: [
      { href: '/dashboard/stock/new?step=ts', icon: '🧪', label: 'New TS Entry' },
      { href: '/dashboard/ts', icon: '📄', label: 'Total Solids (TS)' },
    ],
  },
  {
    label: 'Rule Mapping',
    items: [
      { href: '/dashboard/stock/preparation-charts/mappings', icon: '🔀', label: 'Prep ➔ Stock Mapping Rules' },
      { href: '/dashboard/stock/mappings', icon: '🔄', label: 'Disposals ➔ Receipts Mappings' },
      { href: '/dashboard/stock/partitions', icon: '🔀', label: 'Receipts Internal Partitions' },
      { href: '/dashboard/ts/mappings', icon: '🔗', label: 'Solid Balance STG Mapping' },
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

const checkItemActive = (href: string, pathname: string, currentStep?: string | null) => {
  if (href === '/dashboard') return pathname === '/dashboard';
  
  const [baseHref, queryString] = href.split('?');
  const hrefSegments = baseHref.split('/');
  const pathSegments = pathname.split('/');
  
  if (baseHref === '/dashboard/stock/new') {
    if (pathname !== '/dashboard/stock/new') return false;
    const itemParams = new URLSearchParams(queryString || '');
    const itemStep = itemParams.get('step') || 'stock';
    const effectiveCurrentStep = currentStep || 'stock';
    return itemStep === effectiveCurrentStep;
  }

  if (href === '/dashboard/ts') {
    return pathSegments[1] === 'dashboard' && 
           pathSegments[2] === 'ts' && 
           !['new', 'new-stg', 'config', 'mappings', 'manage-statements'].includes(pathSegments[3]);
  }
  if (href === '/dashboard/stock') {
    return pathSegments[1] === 'dashboard' && 
           pathSegments[2] === 'stock' && 
           pathSegments[3] !== 'new' &&
           pathSegments[3] !== 'products' &&
           pathSegments[3] !== 'mappings' &&
           pathSegments[3] !== 'partitions' &&
           pathSegments[3] !== 'preparation-charts' &&
           pathSegments[3] !== 'periodical' &&
           pathSegments[3] !== 'defaults';
  }

  if (href === '/dashboard/ts/manage-statements') {
    return pathname === '/dashboard/ts/manage-statements';
  }
  
  return hrefSegments.every((seg: string, idx: number) => pathSegments[idx] === seg);
};

const getInitialSections = (currentPathname: string): Record<string, boolean> => {
  const initial: Record<string, boolean> = {};
  NAV_SECTIONS.forEach(sec => {
    const containsActive = sec.items.some(
      item => 'href' in item && typeof item.href === 'string' && checkItemActive(item.href, currentPathname)
    );
    initial[sec.label] = sec.label === 'Overview' || containsActive;
  });
  return initial;
};

export default function Sidebar() {
  const pathname = usePathname();
  const [currentStep, setCurrentStep] = useState<string | null>(null);

  useEffect(() => {
    const updateStep = () => {
      if (typeof window !== 'undefined') {
        const sp = new URLSearchParams(window.location.search);
        setCurrentStep(sp.get('step'));
      }
    };
    updateStep();
    window.addEventListener('popstate', updateStep);
    return () => window.removeEventListener('popstate', updateStep);
  }, [pathname]);

  const { sidebarOpen, setSidebarOpen, setConfigOpen } = useSidebar();
  const { confirm } = useConfirm();

  // Manage open/collapsed state of accordion sections
  // Initial state is computed deterministically from pathname on both server and client to avoid hydration mismatch
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    return getInitialSections(pathname);
  });

  // Reconcile saved preferences from localStorage only after client hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aavin_sidebar_sections_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        setOpenSections(prev => {
          const updated = { ...prev, ...parsed };
          // Always ensure the active route's section stays open
          NAV_SECTIONS.forEach(sec => {
            const containsActive = sec.items.some(
              item => 'href' in item && typeof item.href === 'string' && checkItemActive(item.href, pathname)
            );
            if (containsActive) {
              updated[sec.label] = true;
            }
          });
          return updated;
        });
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Whenever pathname changes, auto-expand the section containing the active route
  useEffect(() => {
    NAV_SECTIONS.forEach(sec => {
      const containsActive = sec.items.some(
        item => 'href' in item && typeof item.href === 'string' && checkItemActive(item.href, pathname)
      );
      if (containsActive) {
        setOpenSections(prev => {
          if (prev[sec.label]) return prev;
          const updated = { ...prev, [sec.label]: true };
          try {
            localStorage.setItem('aavin_sidebar_sections_state', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      }
    });
  }, [pathname]);

  const toggleSection = (label: string) => {
    setOpenSections(prev => {
      const updated = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem('aavin_sidebar_sections_state', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

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

      {/* Navigation Accordion */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {NAV_SECTIONS.map(section => {
          const isOpen = !!openSections[section.label];
          const hasActiveItem = section.items.some(
            item => 'href' in item && typeof item.href === 'string' && checkItemActive(item.href, pathname)
          );

          return (
            <div key={section.label} className="sidebar-section">
              {/* Accordion Header Button */}
              <button
                type="button"
                className={`sidebar-accordion-btn ${hasActiveItem ? 'has-active' : ''}`}
                onClick={() => toggleSection(section.label)}
                aria-expanded={isOpen}
              >
                <span className="sidebar-accordion-title">
                  {section.label}
                </span>
                <svg
                  className={`sidebar-chevron ${isOpen ? 'open' : ''}`}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Accordion Content */}
              {isOpen && (
                <div className="sidebar-section-content">
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
                      const isActive = checkItemActive(href, pathname, currentStep);
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
              )}
            </div>
          );
        })}
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
