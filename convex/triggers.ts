import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"
import { hasFullAccess } from "./lib/permissions"
import { getCurrentUser } from "./lib/utils"

// Query per ottenere tutti i trigger di una clinica
export const getTriggersByClinic = query({
  args: { 
    clinicId: v.id("clinics"),
    isActive: v.optional(v.boolean())
  },
  handler: async (ctx, { clinicId, isActive }) => {
    let query = ctx.db
      .query("triggers")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
    
    const triggers = await query.collect()
    
    // Applica filtro per stato attivo se specificato
    const filteredTriggers = isActive !== undefined 
      ? triggers.filter(trigger => trigger.isActive === isActive)
      : triggers
    
    // Popola i dati del creatore
    const triggersWithCreators = await Promise.all(
      filteredTriggers.map(async (trigger) => {
        const creator = await ctx.db.get(trigger.createdBy)
        return { ...trigger, creator }
      })
    )
    
    return triggersWithCreators
  }
})

// Query per ottenere un trigger per ID
export const getTriggerById = query({
  args: { triggerId: v.id("triggers") },
  handler: async (ctx, { triggerId }) => {
    const trigger = await ctx.db.get(triggerId)
    if (!trigger) {
      throw new ConvexError("Trigger not found")
    }
    
    // Popola i dati del creatore
    const creator = await ctx.db.get(trigger.createdBy)
    
    return { ...trigger, creator }
  }
})

// Query per ottenere trigger attivi di una clinica
export const getActiveTriggers = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    return await ctx.db
      .query("triggers")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()
  }
})

// 🆕 Query per ottenere trigger filtrati per società dell'utente
export const getTriggersByUserSocieties = query({
  args: { 
    userId: v.id("users"),
    clinicId: v.id("clinics"),
    isActive: v.optional(v.boolean())
  },
  handler: async (ctx, { userId, clinicId, isActive }) => {
    // Ottieni le società dell'utente
    const userSocieties = await ctx.db
      .query("userSocieties")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const societyIds = userSocieties.map(us => us.societyId);

    // Ottieni tutti i trigger della clinica
    let triggers = await ctx.db
      .query("triggers")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .collect();

    // Applica filtro per stato attivo se specificato
    let filteredTriggers = isActive !== undefined 
      ? triggers.filter(trigger => trigger.isActive === isActive)
      : triggers;

    // Filtra per società: mostra trigger che sono per le società dell'utente 
    // o che non hanno restrizioni di società (societyIds = null)
    filteredTriggers = filteredTriggers.filter(trigger => {
      // Se il trigger non ha societyIds, è visibile a tutti
      if (!trigger.societyIds || trigger.societyIds.length === 0) {
        return true;
      }
      
      // Altrimenti, controlla se l'utente ha accesso a almeno una delle società del trigger
      return trigger.societyIds.some(societyId => societyIds.includes(societyId));
    });

    // Popola i dati del creatore
    const triggersWithCreators = await Promise.all(
      filteredTriggers.map(async (trigger) => {
        const creator = await ctx.db.get(trigger.createdBy);
        return { ...trigger, creator };
      })
    );

    return triggersWithCreators;
  }
});

// Mutation per creare un nuovo trigger
export const createTrigger = mutation({
  args: {
    name: v.string(),
    clinicId: v.id("clinics"),
    conditions: v.any(),
    actions: v.any(),
    requiresApproval: v.optional(v.boolean()),
    societyIds: v.optional(v.array(v.id("societies"))), // 🆕 Supporto società
  },
  handler: async (ctx, args) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Validazioni
    if (args.name.length < 2) {
      throw new ConvexError("Trigger name must be at least 2 characters long")
    }
    
    // Verifica che la clinica esista
    const clinic = await ctx.db.get(args.clinicId)
    if (!clinic) {
      throw new ConvexError("Clinic not found")
    }
    
    // Crea il trigger
    const triggerId = await ctx.db.insert("triggers", {
      name: args.name,
      clinicId: args.clinicId,
      conditions: args.conditions,
      actions: args.actions,
      isActive: true,
      requiresApproval: args.requiresApproval || false,
      createdBy: currentUser._id,
      societyIds: args.societyIds || undefined, // 🆕 Supporto società
    })
    
    return triggerId
  }
})

// Mutation per aggiornare un trigger
export const updateTrigger = mutation({
  args: {
    triggerId: v.id("triggers"),
    name: v.optional(v.string()),
    conditions: v.optional(v.any()),
    actions: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
    requiresApproval: v.optional(v.boolean()),
    societyIds: v.optional(v.array(v.id("societies"))), // 🆕 Supporto società
  },
  handler: async (ctx, { triggerId, ...updates }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che il trigger esista
    const trigger = await ctx.db.get(triggerId)
    if (!trigger) {
      throw new ConvexError("Trigger not found")
    }
    
    // Validazioni
    if (updates.name && updates.name.length < 2) {
      throw new ConvexError("Trigger name must be at least 2 characters long")
    }
    
    // Aggiorna il trigger
    await ctx.db.patch(triggerId, updates)
    
    return triggerId
  }
})

// Mutation per eliminare un trigger
export const deleteTrigger = mutation({
  args: { triggerId: v.id("triggers") },
  handler: async (ctx, { triggerId }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che il trigger esista
    const trigger = await ctx.db.get(triggerId)
    if (!trigger) {
      throw new ConvexError("Trigger not found")
    }
    
    // Elimina il trigger
    await ctx.db.delete(triggerId)
    
    return triggerId
  }
})

// Mutation per attivare/disattivare un trigger
export const toggleTrigger = mutation({
  args: { 
    triggerId: v.id("triggers"),
    isActive: v.boolean()
  },
  handler: async (ctx, { triggerId, isActive }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che il trigger esista
    const trigger = await ctx.db.get(triggerId)
    if (!trigger) {
      throw new ConvexError("Trigger not found")
    }
    
    // Aggiorna lo stato
    await ctx.db.patch(triggerId, { isActive })
    
    return triggerId
  }
})

// Query per ottenere statistiche sui trigger
export const getTriggerStats = query({
  args: { clinicId: v.optional(v.id("clinics")) },
  handler: async (ctx, { clinicId }) => {
    let triggers
    
    if (clinicId) {
      triggers = await ctx.db
        .query("triggers")
        .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
        .collect()
    } else {
      triggers = await ctx.db.query("triggers").collect()
    }
    
    const activeTriggers = triggers.filter(trigger => trigger.isActive)
    const inactiveTriggers = triggers.filter(trigger => !trigger.isActive)
    const pendingApproval = triggers.filter(trigger => trigger.requiresApproval && !trigger.isApproved)
    
    return {
      total: triggers.length,
      active: activeTriggers.length,
      inactive: inactiveTriggers.length,
      pendingApproval: pendingApproval.length
    }
  }
})

// Mutation per approvare un trigger
export const approveTrigger = mutation({
  args: { 
    triggerId: v.id("triggers")
  },
  handler: async (ctx, { triggerId }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che l'utente sia admin (controllo basato su permessi)
    const role = await ctx.db.get(currentUser.roleId)
    if (!role || !hasFullAccess(role)) {
      throw new ConvexError("Solo gli amministratori possono approvare i trigger")
    }
    
    // Verifica che il trigger esista
    const trigger = await ctx.db.get(triggerId)
    if (!trigger) {
      throw new ConvexError("Trigger not found")
    }
    
    // Verifica che il trigger richieda approvazione
    if (!trigger.requiresApproval) {
      throw new ConvexError("Questo trigger non richiede approvazione")
    }
    
    // Approva il trigger
    await ctx.db.patch(triggerId, {
      isApproved: true,
      approvedBy: currentUser._id,
      approvedAt: Date.now(),
      isActive: true // Attiva automaticamente il trigger approvato
    })
    
    return triggerId
  }
})

// Mutation per rifiutare un trigger
export const rejectTrigger = mutation({
  args: { 
    triggerId: v.id("triggers"),
    reason: v.optional(v.string())
  },
  handler: async (ctx, { triggerId, reason }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che l'utente sia admin (controllo basato su permessi)
    const role = await ctx.db.get(currentUser.roleId)
    if (!role || !hasFullAccess(role)) {
      throw new ConvexError("Solo gli amministratori possono rifiutare i trigger")
    }
    
    // Verifica che il trigger esista
    const trigger = await ctx.db.get(triggerId)
    if (!trigger) {
      throw new ConvexError("Trigger not found")
    }
    
    // Rifiuta il trigger
    await ctx.db.patch(triggerId, {
      isApproved: false,
      rejectedBy: currentUser._id,
      rejectedAt: Date.now(),
      rejectionReason: reason || 'Trigger rifiutato dall\'amministratore',
      isActive: false // Disattiva il trigger rifiutato
    })
    
    return triggerId
  }
})
