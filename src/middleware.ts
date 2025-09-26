import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Route protette che richiedono autenticazione
  const protectedRoutes = [
    '/dashboard',
    '/tickets', 
    '/users',
    '/categories',
    '/automation',
    '/admin',
    '/roles',
    '/kb'
  ];
  
  // Controlla se la route corrente è protetta
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  if (isProtectedRoute) {
    // Controlla se c'è una sessione Auth0 valida
    const hasSession = request.cookies.has('auth0_user_email') && 
                      request.cookies.has('auth0_user_id') &&
                      request.cookies.has('appSession');
    
    if (!hasSession) {
      console.log('🚫 Middleware: Accesso negato a route protetta:', pathname);
      // Reindirizza alla homepage (login)
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    console.log('✅ Middleware: Accesso autorizzato a route protetta:', pathname);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
