import { NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST() {
  try {
    console.log('🔄 Avvio RESET e migration verso numeri globali...')
    
    const result = await convex.mutation(api.tickets.resetAndMigrateToGlobalNumbers, {})
    
    console.log('✅ Reset e migration GLOBALE completata:', result)
    
    return NextResponse.json({ 
      message: 'Reset e migration GLOBALE completata con successo!', 
      result 
    })
  } catch (error: any) {
    console.error('❌ Errore durante reset e migration:', error)
    return NextResponse.json({ 
      error: 'Errore durante reset e migration', 
      details: error.message 
    }, { status: 500 })
  }
}
