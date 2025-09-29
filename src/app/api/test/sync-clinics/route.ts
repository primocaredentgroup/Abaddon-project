import { NextResponse } from 'next/server'

/**
 * GET /api/test/sync-clinics
 * 
 * Testa la sincronizzazione con dati mock
 * (solo per sviluppo - rimuovere in produzione)
 */
export async function GET() {
  try {
    // Dati mock per testare la sincronizzazione
    const mockClinics = [
      {
        clinic_id: "clinic_001",
        name: "Clinica San Giuseppe",
        code: "CSG",
        address: "Via Roma 123, Milano",
        phone: "+39 02 1234567",
        email: "info@clinicasangiuseppe.it",
        is_active: true
      },
      {
        clinic_id: "clinic_002", 
        name: "Poliambulatorio Villa Verde",
        code: "PVV",
        address: "Corso Venezia 45, Milano",
        phone: "+39 02 7654321",
        email: "reception@villaverde.it",
        is_active: true
      },
      {
        clinic_id: "clinic_003",
        name: "Centro Medico Aurora",
        code: "CMA",
        address: "Piazza Duomo 10, Milano", 
        phone: "+39 02 9876543",
        email: "info@centroaurora.it",
        is_active: false // Clinica disattivata per test
      }
    ]

    // Chiama l'endpoint di sincronizzazione
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/sync/clinics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clinics: mockClinics
      })
    })

    const syncResult = await response.json()

    return NextResponse.json({
      success: true,
      message: 'Test di sincronizzazione completato',
      mockData: mockClinics,
      syncResult,
      instructions: {
        next_steps: [
          "1. Controlla i log di Convex per vedere i messaggi di sincronizzazione",
          "2. Usa GET /api/sync/clinics per vedere le statistiche",
          "3. Le cliniche dovrebbero ora essere disponibili nell'app",
          "4. Testa la creazione di un nuovo ticket per vedere le categorie"
        ],
        api_usage: {
          sync_single: "POST /api/sync/clinics con { clinic: {...} }",
          sync_multiple: "POST /api/sync/clinics con { clinics: [...] }",
          get_stats: "GET /api/sync/clinics",
          mark_inactive: "DELETE /api/sync/clinics?external_clinic_id=clinic_001"
        }
      }
    })

  } catch (error) {
    console.error('❌ Errore nel test di sincronizzazione:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Errore nel test di sincronizzazione',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 })
  }
}
