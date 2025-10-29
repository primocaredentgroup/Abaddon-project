'use client';

import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NotificationCenter } from './NotificationCenter';
import { AgentWidget } from '@/components/agent/AgentWidget';
import { useRole } from '@/providers/RoleProvider';
import { hasFullAccess } from '@/lib/permissions';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { role, user, isLoading } = useRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // 🔒 Controlla se l'utente è admin per mostrare AgentWidget
  const isAdmin = role === 'admin';

  const handleMenuClick = () => {
    setSidebarOpen(true);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  // Mostra loader durante il caricamento iniziale
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

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

      {/* Agent Widget - Fixed position - 🔒 Solo admin */}
      <AgentWidget isVisible={isAdmin} />
    </div>
  );
}