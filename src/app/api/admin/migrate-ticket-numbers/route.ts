import { NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST() {
  try {
    console.log('🔧 Avvio migration ticket numbers...')
    
    const result = await convex.mutation(api.tickets.runTicketNumberMigration, {})
    
    console.log('✅ Migration completata:', result)
    
    return NextResponse.json({ 
      message: 'Migration completata con successo!', 
      result 
    })
  } catch (error) {
    console.error('❌ Errore durante migration:', error)
    return NextResponse.json({ 
      error: 'Errore durante la migration',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
