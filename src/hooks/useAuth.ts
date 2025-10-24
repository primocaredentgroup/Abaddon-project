"use client";
import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useMutation } from 'convex/react';
import { useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface ExtendedUser {
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  roleName?: string;
  id: string;
  clinicId?: string;
  clinic?: {
    name: string;
  };
  role?: {
    name: string;
    permissions?: string[];
  };
}

export function useAuth() {
  const { loginWithRedirect, logout: auth0Logout } = useAuth0();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [convexUser, setConvexUser] = useState<ExtendedUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  
  // Mutation per ottenere/creare utente (segue Convex rules: mutations write)
  const getCurrentUserMutation = useMutation(api.auth.getCurrentUser);

  // Carica utente quando autenticato
  useEffect(() => {
    async function loadUser() {
      if (isAuthenticated && !convexUser && !isLoadingUser) {
        setIsLoadingUser(true);
        try {
          const userData = await getCurrentUserMutation({});
          if (userData) {
            const mappedUser: ExtendedUser = {
              id: userData._id,
              nome: userData.name.split(' ')[0] || 'Utente',
              cognome: userData.name.split(' ').slice(1).join(' ') || '',
              email: userData.email,
              ruolo: userData.role?.name || 'user',
              roleName: userData.role?.name,
              clinicId: userData.clinicId,
              clinic: userData.clinic,
              role: userData.role,
            };
            setConvexUser(mappedUser);
          }
        } catch (error) {
          console.error('Errore caricamento utente:', error);
        } finally {
          setIsLoadingUser(false);
        }
      }
    }
    
    loadUser();
  }, [isAuthenticated, convexUser, isLoadingUser, getCurrentUserMutation]);

  // Reset user on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setConvexUser(null);
    }
  }, [isAuthenticated]);

  const user: ExtendedUser | null = convexUser;

  const login = () => {
    loginWithRedirect({
      appState: { returnTo: window.location.pathname }
    });
  };

  const logout = () => {
    setConvexUser(null);
    auth0Logout({ 
      logoutParams: { 
        returnTo: window.location.origin 
      }
    });
  };

  return {
    user,
    isLoading: isLoading || (isAuthenticated && !convexUser) || isLoadingUser,
    error: null,
    login,
    logout,
    refreshUser: async () => {
      const userData = await getCurrentUserMutation({});
      if (userData) {
        const mappedUser: ExtendedUser = {
          id: userData._id,
          nome: userData.name.split(' ')[0] || 'Utente',
          cognome: userData.name.split(' ').slice(1).join(' ') || '',
          email: userData.email,
          ruolo: userData.role?.name || 'user',
          roleName: userData.role?.name,
          clinicId: userData.clinicId,
          clinic: userData.clinic,
          role: userData.role,
        };
        setConvexUser(mappedUser);
      }
    },
  };
}