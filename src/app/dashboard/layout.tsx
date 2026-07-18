'use client';

import { useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import ConfigPanel from '@/components/layout/ConfigPanel';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  useEffect(() => {
    if (sidebarOpen) {
      document.documentElement.classList.add('sidebar-open');
      document.documentElement.classList.remove('sidebar-collapsed');
    } else {
      document.documentElement.classList.add('sidebar-collapsed');
      document.documentElement.classList.remove('sidebar-open');
    }
  }, [sidebarOpen]);

  const handleCloseSidebar = () => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      <Sidebar />
      <div className="main-content" onClick={handleCloseSidebar}>
        {children}
      </div>
      <ConfigPanel />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}
