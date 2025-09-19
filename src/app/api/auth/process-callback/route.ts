import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint per processare il callback Auth0 e ottenere i dati reali dell'utente
 */
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    
    if (!code) {
      return NextResponse.json(
        { error: 'Codice di autorizzazione mancante' },
        { status: 400 }
      );
    }

    console.log('🔍 Processando codice Auth0:', code.substring(0, 10) + '...');

    // Scambia il codice per un token
    const tokenResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        code: code,
        redirect_uri: `${process.env.APP_BASE_URL}/auth/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('❌ Errore nel scambio token:', error);
      return NextResponse.json(
        { error: 'Errore nel processare il login' },
        { status: 500 }
      );
    }

    const tokens = await tokenResponse.json();
    console.log('✅ Token ottenuto con successo');

    // Ottieni le informazioni dell'utente usando l'access token
    const userResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error('❌ Errore nel recupero dati utente');
      return NextResponse.json(
        { error: 'Errore nel recupero dati utente' },
        { status: 500 }
      );
    }

    const userInfo = await userResponse.json();
    console.log('✅ Dati utente reali ottenuti:', { 
      email: userInfo.email, 
      name: userInfo.name 
    });

    // Crea una response con i dati dell'utente e setta il cookie di sessione
    const response = NextResponse.json({
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      sub: userInfo.sub
    });

    // Salva le informazioni essenziali nei cookies per l'uso successivo
    response.cookies.set('auth0_user_email', userInfo.email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 giorni
    });

    response.cookies.set('auth0_user_name', userInfo.name, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 giorni
    });

    response.cookies.set('auth0_user_id', userInfo.sub, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', 
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 giorni
    });

    return response;

  } catch (error) {
    console.error('❌ Errore nel processare callback:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
