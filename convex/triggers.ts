import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"
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

// Mutation per creare un nuovo trigger
export const createTrigger = mutation({
  args: {
    name: v.string(),
    clinicId: v.id("clinics"),
    conditions: v.any(),
    actions: v.any(),
    requiresApproval: v.optional(v.boolean()),
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

// Mutations semplici senza autenticazione per lo sviluppo
export const createTriggerSimple = mutation({
  args: {
    name: v.string(),
    clinicId: v.id("clinics"),
    conditions: v.any(),
    actions: v.any(),
    requiresApproval: v.optional(v.boolean()),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Verifica che la clinica esista
    const clinic = await ctx.db.get(args.clinicId)
    if (!clinic) {
      throw new ConvexError("Clinic not found")
    }
    
    const defaultUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()
    
    if (!defaultUser) {
      throw new ConvexError("User not found")
    }
    
    // Crea il trigger
    const triggerId = await ctx.db.insert("triggers", {
      name: args.name,
      clinicId: args.clinicId,
      conditions: args.conditions,
      actions: args.actions,
      isActive: true,
      requiresApproval: args.requiresApproval || false,
      createdBy: defaultUser._id,
    })
    
    return triggerId
  }
})

export const updateTriggerSimple = mutation({
  args: {
    triggerId: v.id("triggers"),
    name: v.optional(v.string()),
    conditions: v.optional(v.any()),
    actions: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
    requiresApproval: v.optional(v.boolean()),
  },
  handler: async (ctx, { triggerId, ...updates }) => {
    // Verifica che il trigger esista
    const trigger = await ctx.db.get(triggerId)
    if (!trigger) {
      throw new ConvexError("Trigger not found")
    }
    
    // Aggiorna il trigger
    await ctx.db.patch(triggerId, updates)
    
    return triggerId
  }
})

export const deleteTriggerSimple = mutation({
  args: { triggerId: v.id("triggers") },
  handler: async (ctx, { triggerId }) => {
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
    const pendingApproval = triggers.filter(trigger => trigger.requiresApproval)
    
    return {
      total: triggers.length,
      active: activeTriggers.length,
      inactive: inactiveTriggers.length,
      pendingApproval: pendingApproval.length
    }
  }
})
