'use client';

import React, { useState } from 'react';
import { Bell, Search, User, Menu, X, Home as HomeIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRole } from '@/providers/RoleProvider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface HeaderProps {
  onMenuClick: () => void;
  user?: {
    name: string;
    email: string;
    clinic: string;
    roleName?: string;
  };
}

export function Header({ onMenuClick, user }: HeaderProps) {
  const { role, user: roleUser } = useRole();
  
  // Usa i dati da useRole invece della prop user
  const displayUser = roleUser || user;
  
  // Debug: vediamo cosa contiene displayUser
  // console.log('🔍 Header displayUser:', displayUser);
  // console.log('🔍 Header roleUser:', roleUser);
  // console.log('🔍 Header user prop:', user);
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const pathname = usePathname();

  // Debug: vediamo cosa contiene user
  // console.log('🔍 Header user data:', user);

  const notifications = [
    {
      id: 1,
      title: 'Nuovo ticket assegnato',
      message: 'Ti è stato assegnato il ticket #1239',
      time: '2 minuti fa',
      type: 'info' as const,
      unread: true
    },
    {
      id: 2,
      title: 'SLA in scadenza',
      message: 'Il ticket #1234 scadrà tra 2 ore',
      time: '1 ora fa',
      type: 'warning' as const,
      unread: true
    },
    {
      id: 3,
      title: 'Ticket risolto',
      message: 'Il ticket #1230 è stato risolto',
      time: '3 ore fa',
      type: 'success' as const,
      unread: false
    }
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  const roles = [
    { key: 'user', label: 'Utente', description: 'Gestione ticket personali' },
    { key: 'agent', label: 'Agente', description: 'Gestione ticket utenti e clinica' },
    { key: 'admin', label: 'Admin', description: 'Amministrazione completa' }
  ] as const;



  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 relative">
      <div className="flex items-center justify-between">
        {/* Left side - Menu button and search */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {pathname !== '/' && (
            <Link href="/">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <HomeIcon className="h-4 w-4" />
                Home
              </Button>
            </Link>
          )}
          
          <div className="hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Cerca ticket, utenti, categorie..."
                className="pl-10 w-80"
              />
            </div>
          </div>
        </div>

        {/* Right side - User info, notifications and user menu */}
        <div className="flex items-center space-x-3">
          {/* User Email and Role Display */}
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">
              {displayUser?.email || 'esempio@email.com'}
            </p>
            <p className="text-xs text-blue-600 font-medium">
              {displayUser?.roleName || roles.find(r => r.key === role)?.label || 'Utente'}
            </p>
            {/* Debug temporaneo */}
            {/* <p className="text-xs text-red-500 font-bold">
              DEBUG: {displayUser ? 'DATI REALI' : 'DATI MOCK'}
            </p> */}
          </div>

          {/* Notifications */}
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm" 
              className="relative"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Notifiche</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowNotifications(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                        notification.unread ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          notification.type === 'info' ? 'bg-blue-500' :
                          notification.type === 'warning' ? 'bg-yellow-500' :
                          notification.type === 'success' ? 'bg-green-500' : 'bg-gray-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                          <p className="text-sm text-gray-600">{notification.message}</p>
                          <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                        </div>
                        {notification.unread && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-gray-200">
                  <Button variant="ghost" size="sm" className="w-full">
                    Visualizza tutte le notifiche
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-full p-2"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <User className="h-5 w-5" />
            </Button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900">{displayUser?.name || 'Utente'}</p>
                  <p className="text-xs text-gray-500">{displayUser?.email || 'esempio@email.com'}</p>
                  <p className="text-xs text-blue-600 font-medium mt-1">{displayUser?.roleName || 'Utente'}</p>
                  <p className="text-xs text-gray-400">{displayUser?.clinic || 'Nessuna clinica'}</p>
                </div>
                <div className="py-1">
                  <a href="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    Il mio profilo
                  </a>
                  <a href="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    Impostazioni
                  </a>
                  <a href="/help" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    Aiuto
                  </a>
                  <div className="border-t border-gray-200 my-1"></div>
                  {displayUser ? (
                    <a href="/api/auth/logout-local" className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
                      Disconnetti
                    </a>
                  ) : (
                    <a href="/api/auth/login" className="block px-4 py-2 text-sm text-blue-600 hover:bg-gray-100">
                      Login
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search */}
      <div className="md:hidden mt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Cerca..."
            className="pl-10 w-full"
          />
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(showNotifications || showUserMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowNotifications(false);
            setShowUserMenu(false);
          }}
        />
      )}
    </header>
  );
}