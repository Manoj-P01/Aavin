'use client';

import Link from 'next/link';
import { useSidebar } from '@/context/SidebarContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const { sidebarOpen, setSidebarOpen, setConfigOpen } = useSidebar();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <header className="header">
      <div className="header-left">
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
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
      <div className="header-right">
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
        {actions}
      </div>
    </header>
  );
}
