import { NextRequest, NextResponse } from 'next/server';

/**
 * API Routes per Auth0 v4
 * Gestisce le route di login/logout con redirect diretti
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.pathname.split('/').pop();
  
  console.log('🔍 Auth0 API chiamata per:', path);
  
  switch (path) {
    case 'login':
      const loginUrl = `https://${process.env.AUTH0_DOMAIN}/authorize?client_id=${process.env.AUTH0_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.APP_BASE_URL + '/auth/callback')}&scope=openid profile email`;
      console.log('🚀 Reindirizzamento a Auth0 per login');
      return NextResponse.redirect(loginUrl);
      
    case 'logout':
      // Cancella prima la sessione locale creando una response che cancella i cookies
      const response = NextResponse.redirect(`https://${process.env.AUTH0_DOMAIN}/v2/logout?client_id=${process.env.AUTH0_CLIENT_ID}&returnTo=${encodeURIComponent(process.env.APP_BASE_URL || 'http://localhost:3000')}`);
      
      // Cancella tutti i cookies di sessione Auth0
      response.cookies.delete('appSession');
      response.cookies.delete('auth0.session');
      response.cookies.delete('auth0');
      response.cookies.delete('test_email');
      response.cookies.delete('test_name');
      response.cookies.delete('test_surname');
      
      console.log('👋 Logout completo: cancellazione cookies e redirect ad Auth0');
      return response;
      
    default:
      console.log('❌ Route Auth0 non trovata:', path);
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  }
}

export const POST = GET;
