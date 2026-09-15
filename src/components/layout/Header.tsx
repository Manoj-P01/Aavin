'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/context/SidebarContext';
import { useConfirm } from '@/context/ConfirmContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export default function Header({ title, subtitle, actions, children }: HeaderProps) {
  const router = useRouter();
  const { sidebarOpen, setSidebarOpen, setConfigOpen } = useSidebar();
  const { confirm } = useConfirm();

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

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
    <header className="header" style={children ? { flexDirection: 'column', alignItems: 'stretch', gap: 14 } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 12 }}>
        <div className="header-left">
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(!sidebarOpen);
            }}
            aria-label="Toggle Sidebar"
            title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            ☰
          </button>
          <div>
            <div className="header-title">{title}</div>
            {subtitle && <div className="header-date">{subtitle}</div>}
          </div>
        </div>
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="header-date">{dateStr}</div>
          <button
            type="button"
            className="sidebar-toggle-btn no-print"
            onClick={() => setConfigOpen(true)}
            title="System Settings"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}
          >
            ⚙️
          </button>
          <button
            type="button"
            className="no-print"
            onClick={handleLogout}
            title="Log Out of System"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#dc2626',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
          {actions}
        </div>
      </div>
      {children}
    </header>
  );
}
