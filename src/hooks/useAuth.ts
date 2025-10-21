"use client";
import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface ExtendedUser {
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
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
  const { user: auth0User, error: auth0Error, isLoading: auth0Loading, loginWithRedirect, logout: auth0Logout } = useAuth0();
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get basic user first
  const basicUser = useQuery(
    api.users.getUserByEmail,
    auth0User?.email ? { email: auth0User.email } : "skip"
  );

  // Get full user data with populated fields
  const convexUser = useQuery(
    api.users.getUserById,
    basicUser?._id ? { userId: basicUser._id } : "skip"
  );

  // Sync Auth0 user with Convex user data
  useEffect(() => {
    if (auth0User && convexUser) {
      console.log('✅ Utente autenticato:', convexUser);
      
      setUser({
        id: convexUser._id,
        nome: auth0User.email?.split('@')[0] || 'Utente',
        cognome: '',
        email: convexUser.email || '',
        ruolo: convexUser.role?.name || 'user',
        clinicId: convexUser.clinicId,
        clinic: convexUser.clinic,
        role: convexUser.role
      });
      setError(null);
    } else if (!auth0User && !auth0Loading) {
      setUser(null);
    }

    if (auth0Error) {
      setError(auth0Error.message);
    }
  }, [auth0User, convexUser, auth0Loading, auth0Error]);

  const login = () => {
    loginWithRedirect({
      appState: { returnTo: window.location.pathname }
    });
  };

  const logout = () => {
    setUser(null);
    setError(null);
    auth0Logout({ 
      logoutParams: { 
        returnTo: window.location.origin 
      }
    });
  };

  const refreshUser = () => {
    // Convex query will auto-refresh
    console.log('🔄 User data will refresh automatically via Convex');
  };

  return {
    user,
    isLoading: auth0Loading || (auth0User && !convexUser),
    error,
    login,
    logout,
    refreshUser
  };
}