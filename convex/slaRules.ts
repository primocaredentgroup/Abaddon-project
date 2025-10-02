import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { ConvexError } from "convex/values"

// Query per ottenere tutte le SLA rules di una clinica
export const getSLARulesByClinic = query({
  args: {
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, { clinicId }) => {
    console.log(`🎯 getSLARulesByClinic chiamata per clinica ${clinicId}`)
    
    const rules = await ctx.db
      .query("slaRules")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .collect()
    
    // Popola i dati del creatore se disponibile
    const rulesWithCreators = await Promise.all(
      rules.map(async (rule) => {
        if (rule.createdBy) {
          const creator = await ctx.db.get(rule.createdBy)
          return { ...rule, creator }
        }
        return { ...rule, creator: null }
      })
    )
    
    console.log(`✅ Trovate ${rulesWithCreators.length} SLA rules per la clinica`)
    return rulesWithCreators
  }
})

// Query per ottenere solo le SLA rules attive
export const getActiveSLARules = query({
  args: {
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, { clinicId }) => {
    return await ctx.db
      .query("slaRules")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()
  }
})

// Mutation per creare una nuova SLA rule
export const createSLARule = mutation({
  args: {
    name: v.string(),
    clinicId: v.id("clinics"),
    conditions: v.any(),
    targetHours: v.number(),
    requiresApproval: v.optional(v.boolean()),
    creatorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`🆕 createSLARule chiamata`)
    
    // Trova l'utente creatore
    const creator = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.creatorEmail))
      .first()
    
    if (!creator) {
      throw new ConvexError("Creatore non trovato")
    }
    
    // Verifica che la clinica esista
    const clinic = await ctx.db.get(args.clinicId)
    if (!clinic) {
      throw new ConvexError("Clinica non trovata")
    }
    
    // Crea la SLA rule
    const ruleId = await ctx.db.insert("slaRules", {
      name: args.name,
      clinicId: args.clinicId,
      conditions: args.conditions,
      targetHours: args.targetHours,
      isActive: true,
      requiresApproval: args.requiresApproval || false,
      createdBy: creator._id,
    })
    
    console.log(`✅ SLA rule ${ruleId} creata`)
    return ruleId
  }
})

// Mutation per aggiornare una SLA rule
export const updateSLARule = mutation({
  args: {
    ruleId: v.id("slaRules"),
    name: v.optional(v.string()),
    conditions: v.optional(v.any()),
    targetHours: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { ruleId, ...updates }) => {
    console.log(`🔄 updateSLARule chiamata per ${ruleId}`)
    
    // Verifica che la rule esista
    const rule = await ctx.db.get(ruleId)
    if (!rule) {
      throw new ConvexError("SLA rule non trovata")
    }
    
    // Aggiorna la rule
    await ctx.db.patch(ruleId, updates)
    
    console.log(`✅ SLA rule ${ruleId} aggiornata`)
    return ruleId
  }
})

// Mutation per eliminare una SLA rule
export const deleteSLARule = mutation({
  args: {
    ruleId: v.id("slaRules"),
  },
  handler: async (ctx, { ruleId }) => {
    console.log(`🗑️ deleteSLARule chiamata per ${ruleId}`)
    
    // Verifica che la rule esista
    const rule = await ctx.db.get(ruleId)
    if (!rule) {
      throw new ConvexError("SLA rule non trovata")
    }
    
    // Elimina la rule
    await ctx.db.delete(ruleId)
    
    console.log(`✅ SLA rule ${ruleId} eliminata`)
    return { success: true }
  }
})

// Mutation per approvare una SLA rule
export const approveSLARule = mutation({
  args: { 
    ruleId: v.id("slaRules"),
    approverEmail: v.string()
  },
  handler: async (ctx, { ruleId, approverEmail }) => {
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
      throw new ConvexError("Solo gli amministratori possono approvare le SLA rules")
    }
    
    // Verifica che la rule esista
    const rule = await ctx.db.get(ruleId)
    if (!rule) {
      throw new ConvexError("SLA rule non trovata")
    }
    
    // Verifica che la rule richieda approvazione
    if (!rule.requiresApproval) {
      throw new ConvexError("Questa SLA rule non richiede approvazione")
    }
    
    // Approva la rule
    await ctx.db.patch(ruleId, {
      isApproved: true,
      approvedBy: approver._id,
      approvedAt: Date.now(),
      isActive: true // Attiva automaticamente la rule approvata
    })
    
    console.log(`✅ SLA rule ${ruleId} approvata da ${approverEmail}`)
    return ruleId
  }
})

// Mutation per rifiutare una SLA rule
export const rejectSLARule = mutation({
  args: { 
    ruleId: v.id("slaRules"),
    approverEmail: v.string(),
    reason: v.optional(v.string())
  },
  handler: async (ctx, { ruleId, approverEmail, reason }) => {
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
      throw new ConvexError("Solo gli amministratori possono rifiutare le SLA rules")
    }
    
    // Verifica che la rule esista
    const rule = await ctx.db.get(ruleId)
    if (!rule) {
      throw new ConvexError("SLA rule non trovata")
    }
    
    // Rifiuta la rule
    await ctx.db.patch(ruleId, {
      isApproved: false,
      rejectedBy: approver._id,
      rejectedAt: Date.now(),
      rejectionReason: reason || 'SLA rule rifiutata dall\'amministratore',
      isActive: false // Disattiva la rule rifiutata
    })
    
    console.log(`❌ SLA rule ${ruleId} rifiutata da ${approverEmail}`)
    return ruleId
  }
})

