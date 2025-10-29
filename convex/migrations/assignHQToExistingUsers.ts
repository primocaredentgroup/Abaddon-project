import { internalMutation } from "../_generated/server"
import { v } from "convex/values"

/**
 * Migration: Assegna la clinica HQ a tutti gli utenti esistenti con dominio @primogroup.it
 * 
 * Questa migration:
 * 1. Trova tutti gli utenti con email che termina con @primogroup.it
 * 2. Cerca la clinica HQ (code: "HQ")
 * 3. Crea un record in userClinics per ogni utente che non ce l'ha già
 */
export const assignHQToExistingUsers = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    usersProcessed: v.number(),
    usersAssigned: v.number(),
    usersSkipped: v.number(),
  }),
  handler: async (ctx) => {
    console.log("🏢 Inizio migration: assegnazione clinica HQ a utenti @primogroup.it")
    
    // 1. Trova la clinica HQ
    const hqClinic = await ctx.db
      .query("clinics")
      .withIndex("by_code", (q) => q.eq("code", "HQ"))
      .unique()
    
    if (!hqClinic) {
      console.error("❌ Clinica HQ non trovata!")
      throw new Error("Clinica HQ non trovata. Esegui prima initializeDatabase.")
    }
    
    console.log(`✅ Clinica HQ trovata: ${hqClinic._id}`)
    
    // 2. Trova tutti gli utenti
    const allUsers = await ctx.db.query("users").collect()
    console.log(`📊 Trovati ${allUsers.length} utenti totali`)
    
    // 3. Filtra gli utenti con dominio @primogroup.it
    const primogroupUsers = allUsers.filter(user => user.email.endsWith('@primogroup.it'))
    console.log(`📧 Trovati ${primogroupUsers.length} utenti con dominio @primogroup.it`)
    
    let usersAssigned = 0
    let usersSkipped = 0
    
    // 4. Per ogni utente, verifica se ha già la clinica HQ e assegnala se necessario
    for (const user of primogroupUsers) {
      // Verifica se l'utente ha già un record in userClinics per la clinica HQ
      const existingAssignment = await ctx.db
        .query("userClinics")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("clinicId"), hqClinic._id))
        .unique()
      
      if (existingAssignment) {
        console.log(`⏭️  Utente ${user.email} ha già la clinica HQ, skip`)
        usersSkipped++
      } else {
        // Determina il ruolo per la clinica HQ basato sul ruolo principale dell'utente
        const userRole = await ctx.db.get(user.roleId)
        let clinicRole: "user" | "agent" | "admin" = "user"
        if (userRole) {
          if (userRole.name === "Amministratore") {
            clinicRole = "admin"
          } else if (userRole.name === "Agente") {
            clinicRole = "agent"
          }
        }
        
        // Assegna la clinica HQ
        await ctx.db.insert("userClinics", {
          userId: user._id,
          clinicId: hqClinic._id,
          role: clinicRole,
          isActive: true,
          joinedAt: Date.now(),
        })
        console.log(`✅ Assegnata clinica HQ a ${user.email} con ruolo ${clinicRole}`)
        usersAssigned++
      }
    }
    
    const result = {
      message: "Migration completata con successo",
      usersProcessed: primogroupUsers.length,
      usersAssigned,
      usersSkipped,
    }
    
    console.log("🎉 Migration completata:")
    console.log(`   - Utenti processati: ${result.usersProcessed}`)
    console.log(`   - Utenti assegnati: ${result.usersAssigned}`)
    console.log(`   - Utenti skippati: ${result.usersSkipped}`)
    
    return result
  }
})

