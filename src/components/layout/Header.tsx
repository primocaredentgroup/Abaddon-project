'use client';

import React, { useState } from 'react';
import { Search, User, Menu, X, Home as HomeIcon, Tag } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useRole } from '@/providers/RoleProvider';
import { useQuery } from 'convex/react';
import { api } from '@/../convex/_generated/api';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Id } from '@/../convex/_generated/dataModel';

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
  
  // Carica le competenze se è un agente
  const userCompetencies = useQuery(
    api.userCompetencies.getUserCompetencies,
    displayUser?.id ? { userId: displayUser.id as Id<"users"> } : "skip"
  );
  
  const [showUserMenu, setShowUserMenu] = useState(false);
  const pathname = usePathname();

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
          <NotificationBell />

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
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900">{displayUser?.name || 'Utente'}</p>
                  <p className="text-xs text-gray-500">{displayUser?.email || 'esempio@email.com'}</p>
                  <p className="text-xs text-blue-600 font-medium mt-1">{displayUser?.roleName || 'Utente'}</p>
                  <p className="text-xs text-gray-400">{displayUser?.clinic || 'Nessuna clinica'}</p>
                </div>
                
                {/* Categorie di competenza per agenti */}
                {displayUser?.roleName === 'Agente' && (
                  <div className="p-3 border-b border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-gray-500" />
                      <p className="text-xs font-medium text-gray-700">Categorie di competenza</p>
                    </div>
                    {userCompetencies && userCompetencies.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {userCompetencies.map((category) => (
                          <Badge key={category._id} variant="secondary" className="text-xs">
                            {category.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Nessuna competenza assegnata</p>
                    )}
                  </div>
                )}
                
                <div className="py-1">
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
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowUserMenu(false);
          }}
        />
      )}
    </header>
  );
}