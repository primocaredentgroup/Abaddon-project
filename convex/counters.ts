import { v } from "convex/values"
import { mutation, query, internalMutation } from "./_generated/server"
import { ConvexError } from "convex/values"
import type { Id } from "./_generated/dataModel"

// Funzione per ottenere il prossimo numero GLOBALE per un contatore
export const getNextNumber = internalMutation({
  args: {
    counterName: v.string(), // "tickets", "invoices", ecc.
  },
  handler: async (ctx, { counterName }) => {
    console.log(`🔢 Richiesto prossimo numero GLOBALE per ${counterName}`)
    
    // Cerca il contatore GLOBALE esistente (senza clinicId)
    let counter = await ctx.db
      .query("counters")
      .filter((q) => q.eq(q.field("name"), counterName) && q.eq(q.field("clinicId"), undefined))
      .first()

    if (!counter) {
      // Crea il contatore GLOBALE se non esiste, partendo da 1
      console.log(`📝 Creando nuovo contatore GLOBALE per ${counterName}`)
      const counterId = await ctx.db.insert("counters", {
        name: counterName,
        clinicId: undefined as any, // Contatore globale
        currentValue: 1,
      })
      
      console.log(`✅ Contatore GLOBALE creato, numero assegnato: 1`)
      return 1
    } else {
      // Incrementa il contatore esistente
      const nextValue = counter.currentValue + 1
      await ctx.db.patch(counter._id, {
        currentValue: nextValue,
      })
      
      console.log(`✅ Contatore GLOBALE aggiornato, numero assegnato: ${nextValue}`)
      return nextValue
    }
  },
})

// Query per ottenere il valore corrente di un contatore GLOBALE (per debug)
export const getCurrentCounterValue = query({
  args: {
    counterName: v.string(),
  },
  handler: async (ctx, { counterName }) => {
    const counter = await ctx.db
      .query("counters")
      .filter((q) => q.eq(q.field("name"), counterName) && q.eq(q.field("clinicId"), undefined))
      .first()

    return counter?.currentValue || 0
  },
})

// Query per ottenere tutti i contatori GLOBALI (per debug/admin)
export const getAllGlobalCounters = query({
  args: {},
  handler: async (ctx, {}) => {
    return await ctx.db
      .query("counters")
      .filter((q) => q.eq(q.field("clinicId"), undefined))
      .collect()
  },
})
