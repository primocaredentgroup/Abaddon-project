'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getRoleType } from '@/lib/permissions';

export type UserRole = 'user' | 'agent' | 'admin';

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  user: {
    name: string;
    email: string;
    clinic: string;
    clinicId?: string;  // ✅ Aggiunto clinicId
    roleName?: string;
  } | null;
  isLoading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

interface RoleProviderProps {
  children: ReactNode;
}

export function RoleProvider({ children }: RoleProviderProps) {
  // Ottieni i dati reali dall'hook useAuth
  const { user: authUser, isLoading } = useAuth();
  
  // Mappa i dati dell'utente Auth0/Convex al formato atteso dal RoleProvider
  const user = authUser ? {
    name: authUser.nome || authUser.email?.split('@')[0] || 'Utente',
    email: authUser.email || 'example@email.com',
    clinic: authUser.clinic?.name || 'Clinica Esempio',
    clinicId: authUser.clinicId,  // ✅ Aggiunto clinicId
    roleName: authUser.role?.name || 'Utente'
  } : null;

  // Mappa il ruolo basandosi sui permessi invece che sul nome
  const role: UserRole = !authUser && isLoading ? 'user' : getRoleType(authUser?.role);

  const setRole = (newRole: UserRole) => {
    // Per ora non implementiamo il cambio ruolo dinamico
  };

  const value = {
    role,
    setRole,
    user,
    isLoading
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole deve essere usato dentro un RoleProvider');
  }
  return context;
}
