"use client";
import { useState, useEffect } from 'react';

interface ExtendedUser {
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  id: string;
  clinicId?: string;  // ✅ Aggiunto clinicId
  clinic?: {
    name: string;
  };
  role?: {
    name: string;
  };
}

export function useAuth() {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Funzione per controllare la sessione
  const checkSession = async (retryCount = 0) => {
    try {
      setIsLoading(true);
      console.log('🔍 Controllando sessione utente...');
      
      const response = await fetch('/api/user/me', {
        credentials: 'include',
        cache: 'no-cache' // Evita cache per avere dati aggiornati
      });
      
      if (response.ok) {
        const userData = await response.json();
        console.log('✅ Utente autenticato:', userData);
        
        // Trasforma i dati nel formato dell'app
        setUser({
          id: userData._id,
          nome: userData.email?.split('@')[0] || 'Utente', // Usa la parte prima della @ come nome
          cognome: '', // Non abbiamo un cognome, lasciamo vuoto
          email: userData.email || '',
          ruolo: userData.role?.name || 'user',
          clinicId: userData.clinicId,  // ✅ Aggiunto clinicId
          clinic: userData.clinic,
          role: userData.role
        });
        setError(null);
        setIsLoading(false);
      } else {
        console.log('❌ Nessuna sessione attiva');
        
        // Se siamo in callback o dashboard, proviamo un retry
        const isCallbackOrDashboard = 
          typeof window !== 'undefined' && 
          (window.location.pathname.includes('/auth/callback') || 
           window.location.pathname.includes('/dashboard'));
        
        if (isCallbackOrDashboard && retryCount < 3) {
          console.log(`🔄 Retry ${retryCount + 1}/3 tra 1.5 secondi...`);
          setTimeout(() => checkSession(retryCount + 1), 1500);
          return;
        }
        
        setUser(null);
        setError(null);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('❌ Errore nel controllo sessione:', error);
      
      // Retry per errori di rete
      if (retryCount < 2) {
        console.log(`🔄 Retry per errore ${retryCount + 1}/2 tra 2 secondi...`);
        setTimeout(() => checkSession(retryCount + 1), 2000);
        return;
      }
      
      setUser(null);
      setError('Errore nel controllo della sessione');
      setIsLoading(false);
    }
  };

  // Controlla la sessione e sincronizza con Convex
  useEffect(() => {
    checkSession();
    
    // Listener per refresh della sessione dopo login
    const handleAuthSuccess = () => {
      console.log('🔄 Rilevato login completato, aggiornando sessione...');
      checkSession();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('auth-login-complete', handleAuthSuccess);
      
      return () => {
        window.removeEventListener('auth-login-complete', handleAuthSuccess);
      };
    }
  }, []);

  const login = () => {
    window.location.href = '/api/auth/login';
  };

  const logout = () => {
    // Reset dello stato locale prima del logout
    setUser(null);
    setError(null);
    
    // Logout locale per sviluppo (cancella solo cookies)
    window.location.href = '/api/auth/logout-local';
  };

  // Funzione per ricaricare i dati dell'utente
  const refreshUser = () => {
    console.log('🔄 Ricaricando dati utente...');
    checkSession();
  };

  return {
    user,
    isLoading,
    error,
    login,
    logout,
    refreshUser // Espone la funzione per ricaricare
  };
}