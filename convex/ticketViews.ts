import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { ConvexError } from "convex/values"

// Query per ottenere tutte le viste di una clinica (per admin)
export const getViewsByClinic = query({
  args: {
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, { clinicId }) => {
    console.log(`👁️ getViewsByClinic chiamata per clinica ${clinicId}`)
    
    const views = await ctx.db
      .query("ticketViews")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .collect()
    
    // Popola i dati del creatore
    const viewsWithCreators = await Promise.all(
      views.map(async (view) => {
        const creator = await ctx.db.get(view.createdBy)
        return { ...view, creator }
      })
    )
    
    console.log(`✅ Trovate ${viewsWithCreators.length} viste per la clinica`)
    return viewsWithCreators
  }
})

// Query per ottenere le viste disponibili per un utente specifico
export const getAvailableViewsForUser = query({
  args: {
    userEmail: v.string(),
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, { userEmail, clinicId }) => {
    console.log(`👁️ getAvailableViewsForUser chiamata per ${userEmail}`)
    
    // Trova l'utente
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }
    
    // Ottieni il ruolo dell'utente
    const role = await ctx.db.get(user.roleId)
    const roleName = role?.name.toLowerCase()
    
    // Ottieni tutte le viste della clinica
    const allViews = await ctx.db
      .query("ticketViews")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()
    
    // Filtra le viste disponibili per l'utente
    const availableViews = allViews.filter(view => {
      // Viste pubbliche sono visibili a tutti
      if (view.isPublic) return true
      
      // Viste personali sono visibili solo al creatore
      if (view.isPersonal && view.createdBy === user._id) return true
      
      // Viste assegnate specificamente all'utente
      if (view.assignedTo && view.assignedTo.includes(user._id)) return true
      
      // Viste assegnate al ruolo dell'utente
      if (view.assignedToRoles && roleName && view.assignedToRoles.includes(roleName)) return true
      
      return false
    })
    
    // Popola i dati del creatore
    const viewsWithCreators = await Promise.all(
      availableViews.map(async (view) => {
        const creator = await ctx.db.get(view.createdBy)
        return { ...view, creator }
      })
    )
    
    console.log(`✅ Trovate ${viewsWithCreators.length} viste disponibili per l'utente`)
    return viewsWithCreators
  }
})

// Query per ottenere una vista specifica
export const getViewById = query({
  args: {
    viewId: v.id("ticketViews"),
  },
  handler: async (ctx, { viewId }) => {
    const view = await ctx.db.get(viewId)
    if (!view) {
      throw new ConvexError("Vista non trovata")
    }
    
    const creator = await ctx.db.get(view.createdBy)
    return { ...view, creator }
  }
})

// Mutation per creare una nuova vista
export const createView = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    creatorEmail: v.string(),
    clinicId: v.id("clinics"),
    isPublic: v.boolean(),
    isPersonal: v.boolean(),
    filters: v.object({
      status: v.optional(v.array(v.string())),
      categoryId: v.optional(v.id("categories")),
      assignedTo: v.optional(v.id("users")),
      clinicId: v.optional(v.id("clinics")),
      areaManager: v.optional(v.id("users")),
      dateRange: v.optional(v.object({
        type: v.string(),
        days: v.optional(v.number()),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
      })),
    }),
    assignedTo: v.optional(v.array(v.id("users"))),
    assignedToRoles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    console.log(`🆕 createView chiamata`)
    
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
    
    // Se non è personale e non è admin, non può creare viste pubbliche/assegnate
    const role = await ctx.db.get(creator.roleId)
    if (!args.isPersonal && role?.name !== 'Amministratore') {
      throw new ConvexError("Solo gli amministratori possono creare viste pubbliche o assegnate")
    }
    
    // Crea la vista
    const viewId = await ctx.db.insert("ticketViews", {
      name: args.name,
      description: args.description,
      createdBy: creator._id,
      clinicId: args.clinicId,
      isPublic: args.isPublic,
      isPersonal: args.isPersonal,
      filters: args.filters,
      assignedTo: args.assignedTo,
      assignedToRoles: args.assignedToRoles,
      isActive: true,
    })
    
    console.log(`✅ Vista ${viewId} creata`)
    return viewId
  }
})

// Mutation per aggiornare una vista
export const updateView = mutation({
  args: {
    viewId: v.id("ticketViews"),
    userEmail: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    isPersonal: v.optional(v.boolean()),
    filters: v.optional(v.object({
      status: v.optional(v.array(v.string())),
      categoryId: v.optional(v.id("categories")),
      assignedTo: v.optional(v.id("users")),
      clinicId: v.optional(v.id("clinics")),
      areaManager: v.optional(v.id("users")),
      dateRange: v.optional(v.object({
        type: v.string(),
        days: v.optional(v.number()),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
      })),
    })),
    assignedTo: v.optional(v.array(v.id("users"))),
    assignedToRoles: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { viewId, userEmail, ...updates }) => {
    console.log(`🔄 updateView chiamata per ${viewId}`)
    
    // Trova l'utente
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }
    
    // Verifica che la vista esista
    const view = await ctx.db.get(viewId)
    if (!view) {
      throw new ConvexError("Vista non trovata")
    }
    
    // Verifica permessi: solo il creatore o un admin può modificare
    const role = await ctx.db.get(user.roleId)
    if (view.createdBy !== user._id && role?.name !== 'Amministratore') {
      throw new ConvexError("Non hai i permessi per modificare questa vista")
    }
    
    // Aggiorna la vista
    await ctx.db.patch(viewId, updates)
    
    console.log(`✅ Vista ${viewId} aggiornata`)
    return viewId
  }
})

// Mutation per eliminare una vista
export const deleteView = mutation({
  args: {
    viewId: v.id("ticketViews"),
    userEmail: v.string(),
  },
  handler: async (ctx, { viewId, userEmail }) => {
    console.log(`🗑️ deleteView chiamata per ${viewId}`)
    
    // Trova l'utente
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }
    
    // Verifica che la vista esista
    const view = await ctx.db.get(viewId)
    if (!view) {
      throw new ConvexError("Vista non trovata")
    }
    
    // Verifica permessi: solo il creatore o un admin può eliminare
    const role = await ctx.db.get(user.roleId)
    if (view.createdBy !== user._id && role?.name !== 'Amministratore') {
      throw new ConvexError("Non hai i permessi per eliminare questa vista")
    }
    
    // Elimina la vista
    await ctx.db.delete(viewId)
    
    console.log(`✅ Vista ${viewId} eliminata`)
    return { success: true }
  }
})

// Query per ottenere i ticket filtrati in base a una vista
export const getTicketsByView = query({
  args: {
    viewId: v.id("ticketViews"),
    userEmail: v.string(),
  },
  handler: async (ctx, { viewId, userEmail }) => {
    console.log(`🎫 getTicketsByView chiamata per vista ${viewId}`)
    
    // Trova l'utente
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }
    
    // Ottieni la vista
    const view = await ctx.db.get(viewId)
    if (!view) {
      throw new ConvexError("Vista non trovata")
    }
    
    // Verifica che l'utente possa accedere a questa vista
    const role = await ctx.db.get(user.roleId)
    const roleName = role?.name.toLowerCase()
    
    const canAccess = 
      view.isPublic ||
      (view.isPersonal && view.createdBy === user._id) ||
      (view.assignedTo && view.assignedTo.includes(user._id)) ||
      (view.assignedToRoles && roleName && view.assignedToRoles.includes(roleName))
    
    if (!canAccess) {
      throw new ConvexError("Non hai accesso a questa vista")
    }
    
    // Ottieni tutti i ticket della clinica
    let tickets = await ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", view.clinicId))
      .collect()
    
    // Applica i filtri della vista
    const filters = view.filters
    
    // Filtro per stato
    if (filters.status && filters.status.length > 0) {
      tickets = tickets.filter(t => filters.status!.includes(t.status))
    }
    
    // Filtro per categoria
    if (filters.categoryId) {
      tickets = tickets.filter(t => t.categoryId === filters.categoryId)
    }
    
    // Filtro per assegnatario
    if (filters.assignedTo) {
      tickets = tickets.filter(t => t.assigneeId === filters.assignedTo)
    }
    
    // Filtro per data
    if (filters.dateRange) {
      const now = Date.now()
      if (filters.dateRange.type === 'last_days' && filters.dateRange.days) {
        const cutoff = now - (filters.dateRange.days * 24 * 60 * 60 * 1000)
        tickets = tickets.filter(t => t._creationTime >= cutoff)
      } else if (filters.dateRange.type === 'last_month') {
        const cutoff = now - (30 * 24 * 60 * 60 * 1000)
        tickets = tickets.filter(t => t._creationTime >= cutoff)
      } else if (filters.dateRange.type === 'custom' && filters.dateRange.startDate && filters.dateRange.endDate) {
        tickets = tickets.filter(t => 
          t._creationTime >= filters.dateRange!.startDate! && 
          t._creationTime <= filters.dateRange!.endDate!
        )
      }
    }
    
    console.log(`✅ Trovati ${tickets.length} ticket per la vista`)
    return tickets
  }
})

