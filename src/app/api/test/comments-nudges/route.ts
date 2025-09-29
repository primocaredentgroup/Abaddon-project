import { NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function GET() {
  try {
    console.log('🧪 Test del sistema commenti e solleciti...')
    
    // 1. Ottieni il primo ticket disponibile
    const myTickets = await convex.query(api.tickets.getMyCreatedWithAuth, { 
      userEmail: "s.petretto@primogroup.it" 
    })
    
    if (myTickets.length === 0) {
      return NextResponse.json({ 
        error: 'Nessun ticket trovato per il test'
      }, { status: 404 })
    }
    
    const testTicket = myTickets[0]
    console.log('🎫 Ticket per test:', { id: testTicket._id, title: testTicket.title })
    
    // 2. Aggiungi un commento di test
    const commentId = await convex.mutation(api.ticketComments.add, {
      ticketId: testTicket._id,
      content: "🧪 Questo è un commento di test automatico per verificare che il sistema funzioni!",
      userEmail: "s.petretto@primogroup.it"
    })
    console.log('💬 Commento aggiunto:', commentId)
    
    // 3. Leggi i commenti del ticket
    const comments = await convex.query(api.ticketComments.getByTicketId, {
      ticketId: testTicket._id,
      userEmail: "s.petretto@primogroup.it"
    })
    console.log('📖 Commenti trovati:', comments.length)
    
    // 4. Sollecita il ticket
    const nudgeResult = await convex.mutation(api.ticketComments.nudge, {
      ticketId: testTicket._id,
      userEmail: "s.petretto@primogroup.it"
    })
    console.log('🔔 Sollecito inviato:', nudgeResult)
    
    // 5. Controlla i ticket sollecitati (SKIP per ora - richiede ruolo agente)
    // const nudgedTickets = await convex.query(api.tickets.getNudgedTickets, {
    //   userEmail: "s.petretto@primogroup.it"
    // })
    console.log('📢 Step 5 saltato - richiede ruolo agente')
    const nudgedTickets = [] // Mock per ora
    
    return NextResponse.json({ 
      message: 'Test del sistema commenti e solleciti completato!',
      testTicket: {
        id: testTicket._id,
        title: testTicket.title,
        ticketNumber: testTicket.ticketNumber
      },
      results: {
        commentAdded: commentId,
        commentsCount: comments.length,
        nudgeResult,
        nudgedTicketsCount: nudgedTickets.length
      }
    })
    
  } catch (error: any) {
    console.error('❌ Errore durante il test:', error)
    return NextResponse.json({ 
      error: 'Errore durante il test del sistema commenti e solleciti', 
      details: error.message 
    }, { status: 500 })
  }
}
