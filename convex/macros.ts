import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { ConvexError } from "convex/values"
import { hasFullAccess } from "./lib/permissions"

// Query per ottenere tutte le macro di una clinica
export const getMacrosByClinic = query({
  args: {
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, { clinicId }) => {
    
    const macros = await ctx.db
      .query("macros")
      .withIndex("by_clinic_category", (q) => q.eq("clinicId", clinicId))
      .collect()
    
    // Popola i dati del creatore
    const macrosWithCreators = await Promise.all(
      macros.map(async (macro) => {
        const creator = await ctx.db.get(macro.createdBy)
        return { ...macro, creator }
      })
    )
    
    return macrosWithCreators
  }
})

// Query per ottenere macro attive di una specifica categoria
export const getMacrosByCategory = query({
  args: {
    clinicId: v.id("clinics"),
    categorySlug: v.string(),
  },
  handler: async (ctx, { clinicId, categorySlug }) => {
    
    const macros = await ctx.db
      .query("macros")
      .withIndex("by_clinic_category", (q) => 
        q.eq("clinicId", clinicId).eq("category", categorySlug)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()
    
    // Popola i dati del creatore
    const macrosWithCreators = await Promise.all(
      macros.map(async (macro) => {
        const creator = await ctx.db.get(macro.createdBy)
        return { ...macro, creator }
      })
    )
    
    return macrosWithCreators
  }
})

// Mutation per eseguire una macro su un ticket
export const executeMacro = mutation({
  args: {
    macroId: v.id("macros"),
    ticketId: v.id("tickets"),
    userEmail: v.string(),
  },
  handler: async (ctx, { macroId, ticketId, userEmail }) => {
    
    // Verifica che l'utente esista
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }
    
    // Ottieni la macro
    const macro = await ctx.db.get(macroId)
    if (!macro) {
      throw new ConvexError("Macro non trovata")
    }
    
    if (!macro.isActive) {
      throw new ConvexError("Macro non attiva")
    }
    
    // Ottieni il ticket
    const ticket = await ctx.db.get(ticketId)
    if (!ticket) {
      throw new ConvexError("Ticket non trovato")
    }
    
    
    // Esegui tutte le azioni della macro
    for (const action of macro.actions) {
      
      if (action.type === 'add_comment') {
        // Aggiungi commento al ticket
        await ctx.db.insert("ticketComments", {
          ticketId: ticketId,
          authorId: user._id,
          content: action.value,
          isInternal: false,
        })
      } 
      else if (action.type === 'change_status') {
        // 🆕 Cambia lo stato del ticket usando ticketStatusId
        // action.value può essere:
        // - Un ID (v.id("ticketStatuses")) - nuovo formato
        // - Uno slug (string) - vecchio formato (DEPRECATED)
        
        let ticketStatusId: any
        let statusSlug: string
        
        // Verifica se action.value è un ID o uno slug
        const isId = typeof action.value === 'string' && action.value.length > 10 // ID Convex sono lunghi
        
        if (isId) {
          // È già un ID, verifica che esista
          const status = await ctx.db.get(action.value as any)
          if (!status || !('slug' in status)) {
            console.error(`❌ Stato con ID ${action.value} non trovato o non valido`)
            continue // Salta questa azione
          }
          ticketStatusId = action.value
          statusSlug = (status as any).slug
        } else {
          // È uno slug, cerca l'ID corrispondente
          const status = await ctx.db
            .query("ticketStatuses")
            .withIndex("by_slug", (q) => q.eq("slug", action.value))
            .first()
          
          if (!status) {
            console.error(`❌ Stato con slug '${action.value}' non trovato`)
            continue // Salta questa azione
          }
          ticketStatusId = status._id
          statusSlug = action.value
          console.log(`⚠️  MACRO DEPRECATED: Usa ticketStatusId invece di slug. Convertito '${statusSlug}' -> ${ticketStatusId}`)
        }
        
        // Aggiorna il ticket con entrambi i campi
        await ctx.db.patch(ticketId, {
          ticketStatusId: ticketStatusId, // 🆕 Nuovo campo
          status: statusSlug, // 🔄 Mantieni per retrocompatibilità
          lastActivityAt: Date.now()
        })
        
        console.log(`✅ Macro: Stato ticket ${ticketId} cambiato a '${statusSlug}' (${ticketStatusId})`)
      }
      // Aggiungi altri tipi di azioni quando necessario
    }
    
    // Aggiorna lastActivityAt del ticket
    await ctx.db.patch(ticketId, {
      lastActivityAt: Date.now()
    })
    
    return { success: true, macroName: macro.name }
  }
})

// Mutation per creare una nuova macro
export const createMacro = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    actions: v.array(v.object({
      type: v.string(),
      value: v.string(),
      order: v.optional(v.number())
    })),
    clinicId: v.id("clinics"),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    
    // Trova l'utente
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }
    
    // Crea la macro
    const macroId = await ctx.db.insert("macros", {
      name: args.name,
      description: args.description,
      category: args.category,
      actions: args.actions,
      clinicId: args.clinicId,
      createdBy: user._id,
      isActive: true,
      requiresApproval: false,
    })
    
    return macroId
  }
})

// Mutation per aggiornare una macro
export const updateMacro = mutation({
  args: {
    macroId: v.id("macros"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    actions: v.optional(v.array(v.object({
      type: v.string(),
      value: v.string(),
      order: v.optional(v.number())
    }))),
    isActive: v.optional(v.boolean()),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    
    // Verifica che l'utente esista
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }
    
    // Verifica che la macro esista
    const macro = await ctx.db.get(args.macroId)
    if (!macro) {
      throw new ConvexError("Macro non trovata")
    }
    
    // Prepara l'update
    const updates: any = {}
    if (args.name !== undefined) updates.name = args.name
    if (args.description !== undefined) updates.description = args.description
    if (args.category !== undefined) updates.category = args.category
    if (args.actions !== undefined) updates.actions = args.actions
    if (args.isActive !== undefined) updates.isActive = args.isActive
    
    // Aggiorna la macro
    await ctx.db.patch(args.macroId, updates)
    
    return args.macroId
  }
})

// Mutation per eliminare una macro
export const deleteMacro = mutation({
  args: {
    macroId: v.id("macros"),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    
    // Verifica che l'utente esista
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }
    
    // Verifica che la macro esista
    const macro = await ctx.db.get(args.macroId)
    if (!macro) {
      throw new ConvexError("Macro non trovata")
    }
    
    // Elimina la macro
    await ctx.db.delete(args.macroId)
    
    return { success: true }
  }
})

// Mutation per approvare una macro
export const approveMacro = mutation({
  args: { 
    macroId: v.id("macros"),
    approverEmail: v.string()
  },
  handler: async (ctx, { macroId, approverEmail }) => {
    // Trova l'utente approvatore
    const approver = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), approverEmail))
      .first()
    
    if (!approver) {
      throw new ConvexError("Approvatore non trovato")
    }
    
    // Verifica che l'utente sia admin (controllo basato su permessi)
    const role = await ctx.db.get(approver.roleId)
    if (!role || !hasFullAccess(role)) {
      throw new ConvexError("Solo gli amministratori possono approvare le macro")
    }
    
    // Verifica che la macro esista
    const macro = await ctx.db.get(macroId)
    if (!macro) {
      throw new ConvexError("Macro non trovata")
    }
    
    // Verifica che la macro richieda approvazione
    if (!macro.requiresApproval) {
      throw new ConvexError("Questa macro non richiede approvazione")
    }
    
    // Approva la macro
    await ctx.db.patch(macroId, {
      isApproved: true,
      approvedBy: approver._id,
      approvedAt: Date.now(),
      isActive: true // Attiva automaticamente la macro approvata
    })
    
    return macroId
  }
})

// Mutation per rifiutare una macro
export const rejectMacro = mutation({
  args: { 
    macroId: v.id("macros"),
    approverEmail: v.string(),
    reason: v.optional(v.string())
  },
  handler: async (ctx, { macroId, approverEmail, reason }) => {
    // Trova l'utente approvatore
    const approver = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), approverEmail))
      .first()
    
    if (!approver) {
      throw new ConvexError("Approvatore non trovato")
    }
    
    // Verifica che l'utente sia admin (controllo basato su permessi)
    const role = await ctx.db.get(approver.roleId)
    if (!role || !hasFullAccess(role)) {
      throw new ConvexError("Solo gli amministratori possono rifiutare le macro")
    }
    
    // Verifica che la macro esista
    const macro = await ctx.db.get(macroId)
    if (!macro) {
      throw new ConvexError("Macro non trovata")
    }
    
    // Rifiuta la macro
    await ctx.db.patch(macroId, {
      isApproved: false,
      rejectedBy: approver._id,
      rejectedAt: Date.now(),
      rejectionReason: reason || 'Macro rifiutata dall\'amministratore',
      isActive: false // Disattiva la macro rifiutata
    })
    
    return macroId
  }
})

