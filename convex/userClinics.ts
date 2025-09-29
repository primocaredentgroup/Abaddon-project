import { v } from "convex/values"
import { mutation, query, internalMutation } from "./_generated/server"
import { ConvexError } from "convex/values"
import { getCurrentUser } from "./lib/utils"
import type { Id } from "./_generated/dataModel"

// Query per ottenere tutte le cliniche di un utente
export const getUserClinics = query({
  args: { 
    userId: v.optional(v.id("users")),
    userEmail: v.optional(v.string())
  },
  handler: async (ctx, { userId, userEmail }) => {
    // TEMPORARY: Per ora prendo l'utente con la tua email, poi metteremo l'autenticazione
    let user;
    if (userId) {
      user = await ctx.db.get(userId)
    } else {
      user = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("email"), userEmail || "s.petretto@primogroup.it"))
        .first()
    }
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Ottieni tutte le relazioni utente-clinica
    const userClinics = await ctx.db
      .query("userClinics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

    // Popola i dati delle cliniche
    const clinicsWithRoles = await Promise.all(
      userClinics.map(async (uc) => {
        const clinic = await ctx.db.get(uc.clinicId)
        return {
          ...clinic,
          userRole: uc.role,
          joinedAt: uc.joinedAt,
        }
      })
    )

    return clinicsWithRoles
  },
})

// Query per ottenere tutti gli utenti di una clinica
export const getClinicUsers = query({
  args: { 
    clinicId: v.id("clinics"),
    role: v.optional(v.union(v.literal("user"), v.literal("agent"), v.literal("admin")))
  },
  handler: async (ctx, { clinicId, role }) => {
    let query = ctx.db
      .query("userClinics")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .filter((q) => q.eq(q.field("isActive"), true))

    // Filtra per ruolo se specificato
    if (role) {
      query = query.filter((q) => q.eq(q.field("role"), role))
    }

    const userClinics = await query.collect()

    // Popola i dati degli utenti
    const usersWithRoles = await Promise.all(
      userClinics.map(async (uc) => {
        const user = await ctx.db.get(uc.userId)
        return {
          ...user,
          clinicRole: uc.role,
          joinedAt: uc.joinedAt,
        }
      })
    )

    return usersWithRoles
  },
})

// Mutation per aggiungere un utente a una clinica
export const addUserToClinic = mutation({
  args: {
    userId: v.id("users"),
    clinicId: v.id("clinics"),
    role: v.union(v.literal("user"), v.literal("agent"), v.literal("admin")),
  },
  handler: async (ctx, { userId, clinicId, role }) => {
    // Verifica che l'utente corrente sia admin
    const currentUser = await getCurrentUser(ctx)
    // TODO: Aggiungi controllo permessi

    // Verifica che l'utente e la clinica esistano
    const user = await ctx.db.get(userId)
    const clinic = await ctx.db.get(clinicId)
    
    if (!user || !clinic) {
      throw new ConvexError("Utente o clinica non trovati")
    }

    // Verifica che la relazione non esista già
    const existing = await ctx.db
      .query("userClinics")
      .withIndex("by_user_clinic", (q) => q.eq("userId", userId).eq("clinicId", clinicId))
      .unique()

    if (existing) {
      if (existing.isActive) {
        throw new ConvexError("L'utente è già associato a questa clinica")
      } else {
        // Riattiva la relazione esistente
        await ctx.db.patch(existing._id, {
          isActive: true,
          role: role,
          joinedAt: Date.now(),
        })
        return existing._id
      }
    }

    // Crea la nuova relazione
    const relationId = await ctx.db.insert("userClinics", {
      userId,
      clinicId,
      role,
      isActive: true,
      joinedAt: Date.now(),
    })

    console.log(`✅ Utente ${user.email} aggiunto alla clinica ${clinic.name} come ${role}`)
    return relationId
  },
})

// Mutation per rimuovere un utente da una clinica
export const removeUserFromClinic = mutation({
  args: {
    userId: v.id("users"),
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, { userId, clinicId }) => {
    // Verifica permessi
    const currentUser = await getCurrentUser(ctx)
    // TODO: Aggiungi controllo permessi

    // Trova la relazione
    const relation = await ctx.db
      .query("userClinics")
      .withIndex("by_user_clinic", (q) => q.eq("userId", userId).eq("clinicId", clinicId))
      .unique()

    if (!relation) {
      throw new ConvexError("Relazione utente-clinica non trovata")
    }

    // Disattiva la relazione (soft delete)
    await ctx.db.patch(relation._id, {
      isActive: false,
    })

    console.log(`✅ Utente rimosso dalla clinica`)
    return relation._id
  },
})

// Query per verificare se un utente ha accesso a una clinica
export const hasClinicAccess = query({
  args: {
    userId: v.optional(v.id("users")),
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, { userId, clinicId }) => {
    const user = userId ? await ctx.db.get(userId) : await getCurrentUser(ctx)
    if (!user) return false

    // Verifica nella tabella userClinics
    const relation = await ctx.db
      .query("userClinics")
      .withIndex("by_user_clinic", (q) => q.eq("userId", user._id).eq("clinicId", clinicId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique()

    return !!relation
  },
})

// Query per ottenere il ruolo di un utente in una specifica clinica
export const getUserRoleInClinic = query({
  args: {
    userId: v.optional(v.id("users")),
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, { userId, clinicId }) => {
    const user = userId ? await ctx.db.get(userId) : await getCurrentUser(ctx)
    if (!user) return null

    const relation = await ctx.db
      .query("userClinics")
      .withIndex("by_user_clinic", (q) => q.eq("userId", user._id).eq("clinicId", clinicId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique()

    return relation?.role || null
  },
})

// Migration per popolare la tabella userClinics con i dati esistenti
export const migrateExistingUsersToMultiClinic = mutation({
  args: {},
  handler: async (ctx) => {
    console.log('🔄 Migrazione utenti verso sistema multi-clinica...')

    // Ottieni tutti gli utenti
    const allUsers = await ctx.db.query("users").collect()
    let migrated = 0

    for (const user of allUsers) {
      // Verifica se esiste già una relazione
      const existing = await ctx.db
        .query("userClinics")
        .withIndex("by_user_clinic", (q) => q.eq("userId", user._id).eq("clinicId", user.clinicId))
        .unique()

      if (!existing) {
        // Ottieni il ruolo dell'utente
        const role = await ctx.db.get(user.roleId)
        const clinicRole = role?.name === "Agente" ? "agent" : 
                          role?.name === "Amministratore" ? "admin" : "user"

        // Crea la relazione
        await ctx.db.insert("userClinics", {
          userId: user._id,
          clinicId: user.clinicId,
          role: clinicRole,
          isActive: true,
          joinedAt: user._creationTime,
        })

        migrated++
        console.log(`✅ Utente ${user.email} migrato con ruolo ${clinicRole}`)
      }
    }

    console.log(`✅ Migrazione completata: ${migrated} utenti migrati`)
    return { migrated }
  },
})
