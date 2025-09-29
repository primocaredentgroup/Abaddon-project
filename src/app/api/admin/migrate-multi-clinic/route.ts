import { NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST() {
  try {
    console.log('🔄 Avvio migration verso sistema multi-clinica...')
    
    const result = await convex.mutation(api.userClinics.migrateExistingUsersToMultiClinic, {})
    
    console.log('✅ Migration multi-clinica completata:', result)
    
    return NextResponse.json({ 
      message: 'Migration multi-clinica completata con successo!', 
      result 
    })
  } catch (error: any) {
    console.error('❌ Errore durante migration multi-clinica:', error)
    return NextResponse.json({ 
      error: 'Errore durante migration multi-clinica', 
      details: error.message 
    }, { status: 500 })
  }
}
