import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint per logout locale (solo cancellazione cookies)
 * Utile per test e sviluppo
 */
export async function GET(request: NextRequest) {
  console.log('🔓 Logout locale: cancellazione solo cookies');
  
  // Crea una response redirect alla home
  const response = NextResponse.redirect(new URL('/', request.url));
  
  // Cancella tutti i cookies di sessione
  response.cookies.delete('appSession');
  response.cookies.delete('auth0.session');
  response.cookies.delete('auth0');
  response.cookies.delete('test_email');
  response.cookies.delete('test_name');
  response.cookies.delete('test_surname');
  
  // Aggiungi anche opzioni esplicite per la cancellazione
  response.cookies.set('appSession', '', { 
    expires: new Date(0),
    path: '/',
    httpOnly: true 
  });
  
  response.cookies.set('auth0.session', '', { 
    expires: new Date(0),
    path: '/',
    httpOnly: true 
  });
  
  console.log('✅ Logout locale completato');
  return response;
}

export const POST = GET;
