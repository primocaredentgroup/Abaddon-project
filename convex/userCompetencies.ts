import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"

/**
 * Query per ottenere le categorie di competenza di un utente
 */
export const getUserCompetencies = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Se non ha competenze, ritorna array vuoto
    if (!user.categoryCompetencies || user.categoryCompetencies.length === 0) {
      return []
    }

    // Popola le categorie con i loro dettagli
    const categories = await Promise.all(
      user.categoryCompetencies.map(async (catId) => {
        const category = await ctx.db.get(catId)
        return category
      })
    )

    // Filtra eventuali categorie cancellate
    return categories.filter(cat => cat !== null)
  }
})

/**
 * Mutation per assegnare categorie di competenza a un utente (solo admin)
 */
export const assignCompetenciesToUser = mutation({
  args: {
    userId: v.id("users"),
    categoryIds: v.array(v.id("categories")),
    adminEmail: v.string()
  },
  handler: async (ctx, { userId, categoryIds, adminEmail }) => {
    // Verifica che l'admin esista e sia effettivamente admin
    const admin = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", adminEmail))
      .first()

    if (!admin) {
      throw new ConvexError("Admin non trovato")
    }

    const adminRole = await ctx.db.get(admin.roleId)
    if (!adminRole || adminRole.name !== "Amministratore") {
      throw new ConvexError("Solo gli amministratori possono assegnare competenze")
    }

    // Verifica che l'utente esista
    const user = await ctx.db.get(userId)
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Verifica che tutte le categorie esistano
    const categories = await Promise.all(
      categoryIds.map(id => ctx.db.get(id))
    )
    
    if (categories.some(cat => cat === null)) {
      throw new ConvexError("Una o più categorie non esistono")
    }

    // Aggiorna le competenze dell'utente
    await ctx.db.patch(userId, {
      categoryCompetencies: categoryIds
    })

    return {
      success: true,
      userId,
      categoriesCount: categoryIds.length
    }
  }
})

/**
 * Query per ottenere tutti gli agenti con le loro competenze
 */
export const getAgentsWithCompetencies = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    // Trova il ruolo Agente
    const agentRole = await ctx.db
      .query("roles")
      .filter((q) => q.eq(q.field("name"), "Agente"))
      .first()

    if (!agentRole) {
      return []
    }

    // Trova tutti gli agenti della clinica
    const agents = await ctx.db
      .query("users")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .filter((q) => q.eq(q.field("roleId"), agentRole._id))
      .collect()

    // Popola le competenze per ogni agente
    const agentsWithCompetencies = await Promise.all(
      agents.map(async (agent) => {
        const competencies = agent.categoryCompetencies 
          ? await Promise.all(
              agent.categoryCompetencies.map(catId => ctx.db.get(catId))
            )
          : []

        return {
          ...agent,
          competencies: competencies.filter(cat => cat !== null)
        }
      })
    )

    return agentsWithCompetencies
  }
})

