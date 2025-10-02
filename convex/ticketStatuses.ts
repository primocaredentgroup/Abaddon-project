import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"

// Query per ottenere tutti gli stati attivi
export const getActiveStatuses = query({
  args: {},
  handler: async (ctx) => {
    const statuses = await ctx.db
      .query("ticketStatuses")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect()
    
    // Ordina per order
    statuses.sort((a, b) => a.order - b.order)
    
    return statuses
  }
})

// Query per ottenere tutti gli stati (anche inattivi)
export const getAllStatuses = query({
  args: {},
  handler: async (ctx) => {
    const statuses = await ctx.db
      .query("ticketStatuses")
      .collect()
    
    // Ordina per order
    statuses.sort((a, b) => a.order - b.order)
    
    return statuses
  }
})

// Query per ottenere uno stato per slug
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("ticketStatuses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first()
  }
})

// Mutation per creare un nuovo stato
export const createStatus = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
    order: v.number(),
    isSystem: v.optional(v.boolean()),
    isFinal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verifica che lo slug sia univoco
    const existing = await ctx.db
      .query("ticketStatuses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first()
    
    if (existing) {
      throw new ConvexError(`Uno stato con slug "${args.slug}" esiste già`)
    }
    
    const statusId = await ctx.db.insert("ticketStatuses", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      color: args.color,
      icon: args.icon,
      order: args.order,
      isSystem: args.isSystem || false,
      isActive: true,
      isFinal: args.isFinal || false,
    })
    
    return statusId
  }
})

// Mutation per aggiornare uno stato
export const updateStatus = mutation({
  args: {
    statusId: v.id("ticketStatuses"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    order: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    isFinal: v.optional(v.boolean()),
  },
  handler: async (ctx, { statusId, ...updates }) => {
    const status = await ctx.db.get(statusId)
    if (!status) {
      throw new ConvexError("Stato non trovato")
    }
    
    // Non permettere di modificare stati di sistema
    if (status.isSystem && updates.isActive === false) {
      throw new ConvexError("Non puoi disattivare uno stato di sistema")
    }
    
    await ctx.db.patch(statusId, updates)
    return statusId
  }
})

// Mutation per eliminare uno stato (solo se non è di sistema)
export const deleteStatus = mutation({
  args: { statusId: v.id("ticketStatuses") },
  handler: async (ctx, { statusId }) => {
    const status = await ctx.db.get(statusId)
    if (!status) {
      throw new ConvexError("Stato non trovato")
    }
    
    if (status.isSystem) {
      throw new ConvexError("Non puoi eliminare uno stato di sistema")
    }
    
    // Verifica che non ci siano ticket con questo stato
    const ticketsWithStatus = await ctx.db
      .query("tickets")
      .withIndex("by_status", (q) => q.eq("status", status.slug))
      .first()
    
    if (ticketsWithStatus) {
      throw new ConvexError("Impossibile eliminare: ci sono ticket con questo stato")
    }
    
    await ctx.db.delete(statusId)
    return statusId
  }
})

// Mutation per inizializzare gli stati di default
export const initializeDefaultStatuses = mutation({
  args: {},
  handler: async (ctx) => {
    // Controlla se ci sono già stati
    const existing = await ctx.db.query("ticketStatuses").first()
    if (existing) {
      return { message: "Stati già inizializzati", count: 0 }
    }
    
    const defaultStatuses = [
      {
        name: "Aperto",
        slug: "open",
        description: "Ticket appena creato, in attesa di lavorazione",
        color: "#ef4444", // red-500
        icon: "circle",
        order: 1,
        isSystem: true,
        isActive: true,
        isFinal: false,
      },
      {
        name: "In Corso",
        slug: "in_progress",
        description: "Ticket in lavorazione da un agente",
        color: "#f59e0b", // amber-500
        icon: "clock",
        order: 2,
        isSystem: true,
        isActive: true,
        isFinal: false,
      },
      {
        name: "Chiuso",
        slug: "closed",
        description: "Ticket completato e chiuso",
        color: "#22c55e", // green-500
        icon: "check-circle",
        order: 3,
        isSystem: true,
        isActive: true,
        isFinal: true,
      }
    ]
    
    let count = 0
    for (const status of defaultStatuses) {
      await ctx.db.insert("ticketStatuses", status)
      count++
    }
    
    return { message: `${count} stati inizializzati`, count }
  }
})


