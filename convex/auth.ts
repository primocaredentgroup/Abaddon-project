import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"
import { Id } from "./_generated/dataModel"

// Funzione helper per assegnare automaticamente la società basata sul dominio email
async function autoAssignSocietyByEmail(
  ctx: any,
  userId: Id<"users">,
  email: string
) {
  try {
    // Controllo se l'utente ha già una società assegnata
    const existingUserSociety = await ctx.db
      .query("userSocieties")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .first();

    // Se ha già una società, non faccio nulla
    if (existingUserSociety) {
      return;
    }

    // Estraggo il dominio dall'email (es. mario@primogroup.it → primogroup.it)
    const emailParts = email.toLowerCase().split("@");
    if (emailParts.length !== 2) {
      return;
    }

    const domain = emailParts[1];

    // Cerco un mapping attivo per questo dominio
    const domainMapping = await ctx.db
      .query("domainSocieties")
      .withIndex("by_domain_active", (q: any) =>
        q.eq("domain", domain).eq("isActive", true)
      )
      .first();

    if (!domainMapping) {
      return;
    }

    // Verifico che la società esista e sia attiva
    const society: any = await ctx.db.get(domainMapping.societyId);
    if (!society || !society.isActive) {
      return;
    }

    // Assegno automaticamente la società all'utente
    await ctx.db.insert("userSocieties", {
      userId: userId,
      societyId: society._id,
      assignedBy: userId, // Auto-assegnato
      assignedAt: Date.now(),
      isActive: true,
    });
  } catch (error) {
    // Non voglio che l'assegnazione della società blocchi il login
  }
}

// Query per ottenere o creare un utente da Auth0
export const getOrCreateUser = mutation({
  args: {
    auth0Id: v.string(),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { auth0Id, email, name }) => {
    // Cerca l'utente esistente
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", auth0Id))
      .unique()
    
    if (existingUser) {
      // Aggiorna l'ultimo accesso
      await ctx.db.patch(existingUser._id, { 
        lastLoginAt: Date.now() 
      })
      
      // 🆕 Controllo se deve essere assegnata una società
      await autoAssignSocietyByEmail(ctx, existingUser._id, email)
      
      return existingUser
    }

    // Se non trovato per auth0Id, prova ad associare per email (per utenti creati manualmente)
    const userByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique()

    if (userByEmail) {
      await ctx.db.patch(userByEmail._id, {
        auth0Id,
        name: userByEmail.name || name,
        lastLoginAt: Date.now(),
      })
      
      // 🆕 Controllo se deve essere assegnata una società
      await autoAssignSocietyByEmail(ctx, userByEmail._id, email)
      
      const patched = await ctx.db.get(userByEmail._id)
      return patched
    }
    
    // Se l'utente non esiste, verifica se abbiamo una clinica di default
    const defaultClinic = await ctx.db
      .query("clinics")
      .withIndex("by_code", (q) => q.eq("code", "DEMO001"))
      .unique()
    
    if (!defaultClinic) {
      throw new ConvexError("No default clinic found. Please initialize the database first.")
    }
    
    // Ottieni il ruolo utente di default
    const userRole = await ctx.db
      .query("roles")
      .withIndex("by_system", (q) => q.eq("isSystem", true))
      .filter((q) => q.eq(q.field("name"), "Utente"))
      .unique()
    
    if (!userRole) {
      throw new ConvexError("Default user role not found. Please initialize the database first.")
    }
    
    // Crea il nuovo utente
    const userId = await ctx.db.insert("users", {
      email,
      name,
      auth0Id,
      clinicId: defaultClinic._id,
      roleId: userRole._id,
      isActive: true,
      lastLoginAt: Date.now(),
      preferences: {
        notifications: {
          email: true,
          push: true,
        },
        dashboard: {
          defaultView: "my-tickets",
          itemsPerPage: 25,
        },
      },
    })
    
    // 🆕 Assegnazione automatica società basata sul dominio email
    await autoAssignSocietyByEmail(ctx, userId, email)
    
    const newUser = await ctx.db.get(userId)
    return newUser
  }
})

// Query per verificare i permessi di un utente
export const checkUserPermission = query({
  args: {
    resource: v.string(),
    action: v.string(),
    targetId: v.optional(v.string()),
  },
  handler: async (ctx, { resource, action, targetId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return false
    }
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .unique()
    
    if (!user || !user.isActive) {
      return false
    }
    
    // Ottieni il ruolo dell'utente
    const role = await ctx.db.get(user.roleId)
    if (!role) {
      return false
    }
    
    // Verifica se l'utente ha il permesso richiesto
    // Per ora usiamo un sistema semplificato con stringhe
    const permissionString = `${resource}:${action}`
    
    // Se ha "full_access", ha tutti i permessi
    if (role.permissions.includes("full_access")) {
      return true
    }
    
    // Altrimenti verifica se ha il permesso specifico
    return role.permissions.includes(permissionString)
  }
})

// Mutation per aggiornare il profilo utente
export const updateUserProfile = mutation({
  args: {
    name: v.optional(v.string()),
    preferences: v.optional(v.object({
      notifications: v.object({
        email: v.boolean(),
        push: v.boolean(),
      }),
      dashboard: v.object({
        defaultView: v.string(),
        itemsPerPage: v.number(),
      }),
    }))
  },
  handler: async (ctx, updates) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Authentication required")
    }
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .unique()
    
    if (!user) {
      throw new ConvexError("User not found")
    }
    
    // Validazioni
    if (updates.name && updates.name.length < 2) {
      throw new ConvexError("Name must be at least 2 characters long")
    }
    
    // Aggiorna l'utente
    await ctx.db.patch(user._id, updates)
    
    return user._id
  }
})