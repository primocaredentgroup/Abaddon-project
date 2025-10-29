import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { ConvexError } from "convex/values"
import { hasFullAccess } from "./lib/permissions"

// Query per ottenere tutte le SLA rules (globale, senza filtro clinica)
export const getAllSLARules = query({
  args: {
    userId: v.optional(v.id("users")), // Opzionale: per filtrare per società utente
  },
  handler: async (ctx, { userId }) => {
    // Carica tutte le regole SLA
    const allRules = await ctx.db.query("slaRules").collect();
    
    // Se userId è specificato, filtra per società utente
    let filteredRules = allRules;
    
    if (userId) {
      // Ottieni società dell'utente
      const userSocieties = await ctx.db
        .query("userSocieties")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      
      const userSocietyIds = userSocieties.map(us => us.societyId);
      
      // Filtra regole: includi regole globali O regole con società in comune
      filteredRules = allRules.filter(rule => {
        if (!rule.societyIds || rule.societyIds.length === 0) {
          return true; // Regola globale
        }
        return rule.societyIds.some(sid => userSocietyIds.includes(sid));
      });
    }
    
    // Popola i dati del creatore se disponibile
    const rulesWithCreators = await Promise.all(
      filteredRules.map(async (rule) => {
        if (rule.createdBy) {
          const creator = await ctx.db.get(rule.createdBy)
          return { ...rule, creator }
        }
        return { ...rule, creator: null }
      })
    )
    
    return rulesWithCreators
  }
})

// Query per ottenere solo le SLA rules attive (globale, con filtro società opzionale)
export const getActiveSLARules = query({
  args: {
    userId: v.optional(v.id("users")), // Opzionale: per filtrare per società utente
  },
  handler: async (ctx, { userId }) => {
    // Carica tutte le regole SLA attive
    const activeRules = await ctx.db
      .query("slaRules")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    // Se userId non è specificato, ritorna tutte le regole attive
    if (!userId) {
      return activeRules;
    }
    
    // Ottieni società dell'utente
    const userSocieties = await ctx.db
      .query("userSocieties")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const userSocietyIds = userSocieties.map(us => us.societyId);
    
    // Filtra regole: includi regole globali O regole con società in comune
    return activeRules.filter(rule => {
      if (!rule.societyIds || rule.societyIds.length === 0) {
        return true; // Regola globale
      }
      return rule.societyIds.some(sid => userSocietyIds.includes(sid));
    });
  }
})

// Mutation per creare una nuova SLA rule
export const createSLARule = mutation({
  args: {
    name: v.string(),
    conditions: v.any(),
    targetHours: v.number(),
    requiresApproval: v.optional(v.boolean()),
    creatorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    
    // Trova l'utente creatore
    const creator = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.creatorEmail))
      .first()
    
    if (!creator) {
      throw new ConvexError("Creatore non trovato")
    }
    
    // 🆕 Calcola automaticamente societyIds dalle categorie in conditions
    const conditions = args.conditions as any;
    const categoryIds = conditions?.categories || [];
    const societyIdsSet = new Set<string>();
    
    for (const categoryId of categoryIds) {
      const category = await ctx.db
        .query("categories")
        .filter((q) => q.eq(q.field("_id"), categoryId))
        .first();
      
      if (category?.societyIds && category.societyIds.length > 0) {
        category.societyIds.forEach(sid => societyIdsSet.add(sid));
      }
    }
    
    const societyIds = Array.from(societyIdsSet);
    
    // Crea la SLA rule
    const ruleId = await ctx.db.insert("slaRules", {
      name: args.name,
      conditions: args.conditions,
      targetHours: args.targetHours,
      isActive: true,
      requiresApproval: args.requiresApproval || false,
      createdBy: creator._id,
      societyIds: societyIds.length > 0 ? societyIds as any : undefined, // undefined = regola globale
    })
    
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
    
    // Verifica che la rule esista
    const rule = await ctx.db.get(ruleId)
    if (!rule) {
      throw new ConvexError("SLA rule non trovata")
    }
    
    // 🆕 Se stiamo aggiornando conditions, SOSTITUISCI completamente (non merge)
    // perché potremmo voler RIMUOVERE campi (es. priority quando selezioniamo "all")
    const patchData: any = { ...updates }
    
    if (updates.conditions) {
      // Sostituisci completamente le conditions invece di fare merge
      patchData.conditions = updates.conditions
    }
    
    // Aggiorna la rule
    await ctx.db.patch(ruleId, patchData)
    
    return ruleId
  }
})

// Mutation per eliminare una SLA rule
export const deleteSLARule = mutation({
  args: {
    ruleId: v.id("slaRules"),
  },
  handler: async (ctx, { ruleId }) => {
    
    // Verifica che la rule esista
    const rule = await ctx.db.get(ruleId)
    if (!rule) {
      throw new ConvexError("SLA rule non trovata")
    }
    
    // Elimina la rule
    await ctx.db.delete(ruleId)
    
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
    
    // Verifica che l'utente sia admin (controllo basato su permessi)
    const role = await ctx.db.get(approver.roleId)
    if (!role || !hasFullAccess(role)) {
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
    
    // Verifica che l'utente sia admin (controllo basato su permessi)
    const role = await ctx.db.get(approver.roleId)
    if (!role || !hasFullAccess(role)) {
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
    
    return ruleId
  }
})

