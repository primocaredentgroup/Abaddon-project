import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';

// Funzione di utilità per estrarre valori dai cookies
function extractCookieValue(cookies: string, cookieName: string): string | null {
  if (cookies.includes(`${cookieName}=`)) {
    const match = cookies.match(new RegExp(`${cookieName}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  }
  return null;
}

/**
 * Endpoint per ottenere le informazioni dell'utente corrente
 * Gestisce la sincronizzazione Auth0 → Convex
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API /api/user/me chiamata');
    
    // Per ora, otteniamo i dati utente dal cookie di sessione
    // In una implementazione completa, useremmo getSession da Auth0
    const cookies = request.headers.get('cookie') || '';
    
    // Controlla se c'è una sessione Auth0 attiva
    // Questo è un approccio semplificato - in produzione useresti l'SDK Auth0
    if (!cookies.includes('auth0.session') && !cookies.includes('appSession')) {
      console.log('❌ Nessuna sessione Auth0 trovata');
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    console.log('✅ Sessione Auth0 trovata nei cookies');

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    
    // Estrai i dati REALI dell'utente dai cookies sicuri
    const userEmail = extractCookieValue(cookies, 'auth0_user_email');
    const userName = extractCookieValue(cookies, 'auth0_user_name');
    const userId = extractCookieValue(cookies, 'auth0_user_id');
    
    console.log('🔍 Cookie estratti:', {
      hasUserEmail: !!userEmail,
      hasUserName: !!userName,
      hasUserId: !!userId,
      cookiesLength: cookies.length
    });
    
    if (!userEmail || !userName || !userId) {
      console.log('❌ Dati utente Auth0 mancanti nei cookies');
      console.log('📋 Cookies disponibili:', cookies.substring(0, 200));
      return NextResponse.json(
        { error: 'Sessione Auth0 incompleta' },
        { status: 401 }
      );
    }
    
    console.log('✅ Dati utente REALI trovati:', { email: userEmail, name: userName });
    
    // Cerca utente esistente in Convex
    let user = await convex.query(api.users.getUserByEmail, { 
      email: userEmail
    });

    if (!user) {
      // Crea nuovo utente in Convex
      console.log('🆕 Creando nuovo utente in Convex');
      
      const userId = await convex.mutation(api.users.createUserSimple, {
        email: userEmail,
        nome: userName.split(' ')[0] || 'Utente',
        cognome: userName.split(' ').slice(1).join(' ') || 'Auth0',
        ruolo: 'user' // Ruolo di default
      });

      user = await convex.query(api.users.getUserById, { userId });
      console.log('✅ Utente creato in Convex con ID:', userId);
    } else {
      // Aggiorna ultimo accesso
      console.log('👋 Utente esistente trovato, aggiornando ultimo accesso');
      await convex.mutation(api.users.updateLastAccess, { 
        userId: user._id 
      });
    }

    // Ottieni i dati completi dell'utente (inclusi clinic e role)
    const fullUser = await convex.query(api.users.getUserById, { 
      userId: user._id 
    });

    return NextResponse.json(fullUser);
    
  } catch (error) {
    console.error('❌ Errore nel processamento utente:', error);
    return NextResponse.json(
      { error: 'Errore nella sincronizzazione' }, 
      { status: 500 }
    );
  }
}