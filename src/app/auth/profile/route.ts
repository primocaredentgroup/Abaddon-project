import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Per ora ritorniamo un profilo vuoto per evitare errori 500
    // L'SDK Auth0 gestirà l'autenticazione tramite i suoi meccanismi
    return NextResponse.json({}, { status: 200 })
  } catch (err) {
    console.error('Error in auth profile:', err)
    return NextResponse.json({}, { status: 200 })
  }
}
