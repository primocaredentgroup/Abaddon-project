import { NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function GET() {
  try {
    console.log('🧪 Test del nuovo sistema multi-clinica...')
    
    // 1. Verifica le cliniche dell'utente
    const userClinics = await convex.query(api.userClinics.getUserClinics, {})
    console.log('🏥 Cliniche utente:', userClinics)
    
    // 2. Test delle nuove query ticket
    const myCreated = await convex.query(api.tickets.getMyCreatedWithAuth, {})
    const myClinicTickets = await convex.query(api.tickets.getMyClinicTicketsWithAuth, {})
    const myAssigned = await convex.query(api.tickets.getMyAssignedTicketsWithAuth, {})
    
    console.log('📊 Risultati query:')
    console.log('  - Miei ticket creati:', myCreated?.length || 0)
    console.log('  - Ticket cliniche:', myClinicTickets?.length || 0)
    console.log('  - Ticket assegnati:', myAssigned?.length || 0)
    
    return NextResponse.json({ 
      success: true,
      data: {
        userClinics: userClinics?.length || 0,
        myCreatedTickets: myCreated?.length || 0,
        myClinicTickets: myClinicTickets?.length || 0,
        myAssignedTickets: myAssigned?.length || 0,
      }
    })
  } catch (error: any) {
    console.error('❌ Errore test sistema cliniche:', error)
    return NextResponse.json({ 
      error: 'Errore nel test del sistema cliniche', 
      details: error.message 
    }, { status: 500 })
  }
}
