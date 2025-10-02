import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { ConvexError } from "convex/values"

// Query per ottenere tutte le macro di una clinica
export const getMacrosByClinic = query({
  args: {
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, { clinicId }) => {
    console.log(`🎬 getMacrosByClinic chiamata per clinica ${clinicId}`)
    
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
    
    console.log(`✅ Trovate ${macrosWithCreators.length} macro per la clinica`)
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
    console.log(`🎬 getMacrosByCategory chiamata per clinica ${clinicId}, categoria ${categorySlug}`)
    
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
    
    console.log(`✅ Trovate ${macrosWithCreators.length} macro attive per categoria ${categorySlug}`)
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
    console.log(`🎬 executeMacro chiamata: macro ${macroId} su ticket ${ticketId}`)
    
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
    
    console.log(`✅ Esecuzione macro "${macro.name}" con ${macro.actions.length} azioni`)
    
    // Esegui tutte le azioni della macro
    for (const action of macro.actions) {
      console.log(`  ↳ Eseguo azione: ${action.type}`)
      
      if (action.type === 'add_comment') {
        // Aggiungi commento al ticket
        await ctx.db.insert("ticketComments", {
          ticketId: ticketId,
          authorId: user._id,
          content: action.value,
          isInternal: false,
        })
        console.log(`    ✅ Commento aggiunto`)
      } 
      else if (action.type === 'change_status') {
        // Cambia lo stato del ticket
        await ctx.db.patch(ticketId, {
          status: action.value,
          lastActivityAt: Date.now()
        })
        console.log(`    ✅ Stato cambiato in ${action.value}`)
      }
      // Aggiungi altri tipi di azioni quando necessario
    }
    
    // Aggiorna lastActivityAt del ticket
    await ctx.db.patch(ticketId, {
      lastActivityAt: Date.now()
    })
    
    console.log(`🎉 Macro "${macro.name}" eseguita con successo`)
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
    console.log(`🎬 createMacro chiamata: ${args.name}`)
    
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
    
    console.log(`✅ Macro creata con ID ${macroId}`)
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
    console.log(`🎬 updateMacro chiamata per macro ${args.macroId}`)
    
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
    
    console.log(`✅ Macro ${args.macroId} aggiornata`)
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
    console.log(`🎬 deleteMacro chiamata per macro ${args.macroId}`)
    
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
    
    console.log(`✅ Macro ${args.macroId} eliminata`)
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
    
    // Verifica che l'utente sia admin
    const role = await ctx.db.get(approver.roleId)
    if (!role || role.name !== 'Amministratore') {
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
    
    console.log(`✅ Macro ${macroId} approvata da ${approverEmail}`)
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
    
    // Verifica che l'utente sia admin
    const role = await ctx.db.get(approver.roleId)
    if (!role || role.name !== 'Amministratore') {
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
    
    console.log(`❌ Macro ${macroId} rifiutata da ${approverEmail}`)
    return macroId
  }
})

