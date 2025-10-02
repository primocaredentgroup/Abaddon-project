"use client";
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Componente interno che usa useSearchParams
function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processando login...');

  useEffect(() => {
    const processCallback = async () => {
      console.log('✅ Callback Auth0 ricevuto! Processando...');
      
      // Ottieni il codice di autorizzazione dall'URL
      const code = searchParams.get('code');
      
      if (!code) {
        console.log('❌ Nessun codice di autorizzazione trovato');
        setStatus('Errore nel login');
        return;
      }

      try {
        setStatus('Processando dati Auth0...');
        
        // Chiama l'endpoint server per processare il codice Auth0 e ottenere dati REALI
        const response = await fetch('/api/auth/process-callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          throw new Error('Errore nel processare il login Auth0');
        }

        const userData = await response.json();
        console.log('✅ Dati utente REALI ricevuti:', userData);
        
        // Salva un cookie di sessione generale
        document.cookie = `appSession=auth0_session_${Date.now()}; path=/`;
        
        setStatus(`Login completato! Benvenuto ${userData.name}`);
        
        // Invia evento per notificare il login completato
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth-login-complete'));
        }
        
        // Aspetta un momento per permettere ai cookies di essere salvati
        setTimeout(() => {
          console.log('🔄 Reindirizzando alla dashboard...');
          router.push('/dashboard');
        }, 1000);
        
      } catch (error) {
        console.error('❌ Errore nel processare il callback:', error);
        setStatus('Errore nel login');
      }
    };

    processCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso in corso!</h1>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
}

// Componente principale con Suspense boundary
export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso in corso!</h1>
          <p className="text-gray-600">Processando login...</p>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}