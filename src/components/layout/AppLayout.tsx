'use client';

import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NotificationCenter } from './NotificationCenter';
import { AgentWidget } from '@/components/agent/AgentWidget';
import { useRole } from '@/providers/RoleProvider';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { role, user } = useRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleMenuClick = () => {
    setSidebarOpen(true);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={handleSidebarClose}
        userRole={role}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden lg:ml-0">
        {/* Header */}
        <Header
          onMenuClick={handleMenuClick}
          user={user}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Notification Center */}
      <NotificationCenter />

      {/* Agent Widget - Fixed position */}
      <AgentWidget />
    </div>
  );
}