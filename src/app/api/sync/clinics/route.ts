import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

// Crea client Convex per le operazioni server-side
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// Tipo per i dati della clinica in arrivo
type ExternalClinicData = {
  clinic_id: string // ID dal tuo sistema esterno
  name: string
  code: string
  address?: string
  phone?: string
  email?: string
  is_active?: boolean
}

/**
 * POST /api/sync/clinics
 * 
 * Sincronizza una o più cliniche dal sistema esterno
 * 
 * Body:
 * - clinic: ExternalClinicData (singola clinica)
 * - clinics: ExternalClinicData[] (multiple cliniche)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Verifica se è una singola clinica o multiple
    if (body.clinic) {
      // Sincronizzazione singola clinica
      const clinic = body.clinic as ExternalClinicData
      
      console.log(`🔄 Sincronizzando clinica singola: ${clinic.name}`)
      
      const clinicId = await convex.mutation(api.clinics.syncClinicFromExternal, {
        externalClinicId: clinic.clinic_id,
        name: clinic.name,
        code: clinic.code,
        address: clinic.address,
        phone: clinic.phone,
        email: clinic.email,
        isActive: clinic.is_active,
      })
      
      return NextResponse.json({
        success: true,
        message: 'Clinica sincronizzata con successo',
        clinicId,
        externalClinicId: clinic.clinic_id
      })
      
    } else if (body.clinics && Array.isArray(body.clinics)) {
      // Sincronizzazione multiple cliniche
      const clinics = body.clinics as ExternalClinicData[]
      
      console.log(`🔄 Sincronizzando ${clinics.length} cliniche...`)
      
      // Trasforma i dati nel formato che si aspetta Convex
      const convexClinics = clinics.map(clinic => ({
        externalClinicId: clinic.clinic_id,
        name: clinic.name,
        code: clinic.code,
        address: clinic.address,
        phone: clinic.phone,
        email: clinic.email,
        isActive: clinic.is_active,
      }))
      
      const results = await convex.mutation(api.clinics.syncMultipleClinicsFromExternal, {
        clinics: convexClinics
      })
      
      const successful = results.filter(r => r.status === 'success').length
      const failed = results.filter(r => r.status === 'error').length
      
      return NextResponse.json({
        success: true,
        message: `Sincronizzazione completata: ${successful} successi, ${failed} errori`,
        results,
        stats: {
          total: clinics.length,
          successful,
          failed
        }
      })
      
    } else {
      return NextResponse.json({
        success: false,
        error: 'Formato body non valido. Usa { clinic: {...} } per singola o { clinics: [...] } per multiple'
      }, { status: 400 })
    }
    
  } catch (error) {
    console.error('❌ Errore sincronizzazione cliniche:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 })
  }
}

/**
 * GET /api/sync/clinics
 * 
 * Ottieni statistiche di sincronizzazione
 */
export async function GET() {
  try {
    const stats = await convex.query(api.clinics.getSyncStats)
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Errore ottenimento stats:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Errore nel recupero delle statistiche',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/sync/clinics/:externalClinicId
 * 
 * Marca una clinica come non più sincronizzata
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const externalClinicId = url.searchParams.get('external_clinic_id')
    const reason = url.searchParams.get('reason')
    
    if (!externalClinicId) {
      return NextResponse.json({
        success: false,
        error: 'external_clinic_id è richiesto'
      }, { status: 400 })
    }
    
    console.log(`🔴 Marcando clinica come non sincronizzata: ${externalClinicId}`)
    
    const clinicId = await convex.mutation(api.clinics.markClinicAsUnsyncedFromExternal, {
      externalClinicId,
      reason: reason || undefined
    })
    
    return NextResponse.json({
      success: true,
      message: 'Clinica marcata come non sincronizzata',
      clinicId,
      externalClinicId
    })
    
  } catch (error) {
    console.error('❌ Errore marcatura clinica:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Errore nella marcatura della clinica',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 })
  }
}
