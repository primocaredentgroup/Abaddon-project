import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"
import { getCurrentUser, isValidEmail } from "./lib/utils"

// Query per ottenere l'utente corrente
export const getCurrentUserProfile = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .unique()
      
    if (!user) {
      return null
    }
    
    // Popola i dati della clinica e del ruolo
    const [clinic, role] = await Promise.all([
      ctx.db.get(user.clinicId),
      ctx.db.get(user.roleId)
    ])
    
    return {
      ...user,
      clinic,
      role
    }
  }
})

// Query per ottenere tutti gli utenti di una clinica
export const getUsersByClinic = query({
  args: { 
    clinicId: v.id("clinics"),
    isActive: v.optional(v.boolean())
  },
  handler: async (ctx, { clinicId, isActive }) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .collect()
    
    // Filtra per stato attivo se specificato
    const filteredUsers = isActive !== undefined 
      ? users.filter(user => user.isActive === isActive)
      : users
    
    // Popola i dati del ruolo per ogni utente
    const usersWithRoles = await Promise.all(
      filteredUsers.map(async (user) => {
        const role = await ctx.db.get(user.roleId)
        return { ...user, role }
      })
    )
    
    return usersWithRoles
  }
})

// Query per ottenere un utente per ID
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    if (!user) {
      throw new ConvexError("User not found")
    }
    
    // Popola i dati della clinica e del ruolo
    const [clinic, role] = await Promise.all([
      ctx.db.get(user.clinicId),
      ctx.db.get(user.roleId)
    ])
    
    return {
      ...user,
      clinic,
      role
    }
  }
})

// Mutation per creare un nuovo utente
export const createUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    clinicId: v.optional(v.id("clinics")),
    roleId: v.id("roles"),
    auth0Id: v.string(),
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
  handler: async (ctx, args) => {
    // Validazioni
    if (!isValidEmail(args.email)) {
      throw new ConvexError("Invalid email format")
    }
    
    if (args.name.length < 2) {
      throw new ConvexError("Name must be at least 2 characters long")
    }
    
    // Verifica che l'email non esista già
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique()
      
    if (existingUser) {
      throw new ConvexError("User with this email already exists")
    }
    
    // Verifica che l'auth0Id non esista già
    const existingAuth0User = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", args.auth0Id))
      .unique()
      
    if (existingAuth0User) {
      throw new ConvexError("User with this Auth0 ID already exists")
    }
    
    // Risolvi la clinica: se non passata, prova con DEMO001 (creala se manca)
    let clinicId = args.clinicId
    if (!clinicId) {
      const defaultClinic = await ctx.db
        .query("clinics")
        .withIndex("by_code", (q) => q.eq("code", "DEMO001"))
        .unique()
      if (!defaultClinic) {
        // Crea automaticamente una clinica di default se non esiste
        clinicId = await ctx.db.insert("clinics", {
          name: "Clinica Esempio",
          code: "DEMO001",
          address: "Via Roma 123, Milano",
          phone: "+39 02 1234567",
          email: "info@clinicaesempio.it",
          settings: {
            allowPublicTickets: true,
            requireApprovalForCategories: false,
            defaultSlaHours: 24,
          },
          isActive: true,
        })
      } else {
        clinicId = defaultClinic._id
      }
    } else {
      const clinic = await ctx.db.get(clinicId)
      if (!clinic) {
        throw new ConvexError("Clinic not found")
      }
    }
    
    // Verifica che il ruolo esista
    const role = await ctx.db.get(args.roleId)
    if (!role) {
      throw new ConvexError("Role not found")
    }
    
    // Crea l'utente con preferenze di default
    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      clinicId,
      roleId: args.roleId,
      auth0Id: args.auth0Id,
      isActive: true,
      preferences: args.preferences || {
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
    
    return userId
  }
})

// Mutation per aggiornare un utente
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    clinicId: v.optional(v.id("clinics")),
    roleId: v.optional(v.id("roles")),
    isActive: v.optional(v.boolean()),
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
  handler: async (ctx, { userId, ...updates }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che l'utente esista
    const user = await ctx.db.get(userId)
    if (!user) {
      throw new ConvexError("User not found")
    }
    
    // Validazioni
    if (updates.name && updates.name.length < 2) {
      throw new ConvexError("Name must be at least 2 characters long")
    }
    
    // Verifica che la clinica esista se fornita
    if (updates.clinicId) {
      const clinic = await ctx.db.get(updates.clinicId)
      if (!clinic) {
        throw new ConvexError("Clinic not found")
      }
    }
    
    // Verifica che il ruolo esista se fornito
    if (updates.roleId) {
      const role = await ctx.db.get(updates.roleId)
      if (!role) {
        throw new ConvexError("Role not found")
      }
    }
    
    // Aggiorna l'utente
    await ctx.db.patch(userId, updates)
    
    return userId
  }
})

// Mutation per aggiornare le preferenze dell'utente corrente
export const updateMyPreferences = mutation({
  args: {
    preferences: v.object({
      notifications: v.object({
        email: v.boolean(),
        push: v.boolean(),
      }),
      dashboard: v.object({
        defaultView: v.string(),
        itemsPerPage: v.number(),
      }),
    })
  },
  handler: async (ctx, { preferences }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Aggiorna le preferenze
    await ctx.db.patch(currentUser._id, { preferences })
    
    return currentUser._id
  }
})

// Mutation per aggiornare l'ultimo accesso
export const updateLastLogin = mutation({
  handler: async (ctx) => {
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
    
    await ctx.db.patch(user._id, { lastLoginAt: Date.now() })
    
    return user._id
  }
})

// Mutation per disattivare un utente
export const deactivateUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che l'utente esista
    const user = await ctx.db.get(userId)
    if (!user) {
      throw new ConvexError("User not found")
    }
    
    // Non permettere di disattivare se stesso
    if (userId === currentUser._id) {
      throw new ConvexError("Cannot deactivate yourself")
    }
    
    // Disattiva l'utente
    await ctx.db.patch(userId, { isActive: false })
    
    return userId
  }
})

// Query per ottenere statistiche utenti
export const getUserStats = query({
  args: { clinicId: v.optional(v.id("clinics")) },
  handler: async (ctx, { clinicId }) => {
    let users
    
    if (clinicId) {
      users = await ctx.db
        .query("users")
        .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
        .collect()
    } else {
      users = await ctx.db.query("users").collect()
    }
    
    const activeUsers = users.filter(user => user.isActive)
    const inactiveUsers = users.filter(user => !user.isActive)
    
    // Raggruppa per ruolo
    const roleStats = new Map()
    for (const user of users) {
      const role = await ctx.db.get(user.roleId)
      if (role) {
        const count = roleStats.get(role.name) || 0
        roleStats.set(role.name, count + 1)
      }
    }
    
    return {
      total: users.length,
      active: activeUsers.length,
      inactive: inactiveUsers.length,
      byRole: Object.fromEntries(roleStats)
    }
  }
})

// Query per ottenere tutti gli utenti (opzionale filtro per clinica)
export const getAllUsers = query({
  args: { clinicId: v.optional(v.id("clinics")) },
  handler: async (ctx, { clinicId }) => {
    let users
    if (clinicId) {
      users = await ctx.db
        .query("users")
        .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
        .collect()
    } else {
      users = await ctx.db.query("users").collect()
    }

    const withRole = await Promise.all(
      users.map(async (u) => ({ ...u, role: await ctx.db.get(u.roleId) }))
    )
    return withRole
  }
})

// Query per ottenere un utente per email (richiesta dalla guida Auth0)
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

// Mutation per aggiornare ultimo accesso (richiesta dalla guida Auth0)
export const updateLastAccess = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastLoginAt: Date.now(),
    });
  },
});

// Mutation per aggiornare ruolo utente senza autenticazione (solo per sviluppo)
export const updateUserRoleByEmail = mutation({
  args: {
    email: v.string(),
    newRoleName: v.string()
  },
  handler: async (ctx, { email, newRoleName }) => {
    // Trova l'utente per email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique()
    
    if (!user) {
      throw new ConvexError(`Utente con email ${email} non trovato`)
    }
    
    // Trova il ruolo per nome
    const role = await ctx.db
      .query("roles")
      .filter((q) => q.eq(q.field("name"), newRoleName))
      .unique()
    
    if (!role) {
      throw new ConvexError(`Ruolo ${newRoleName} non trovato`)
    }
    
    // Aggiorna il ruolo dell'utente
    await ctx.db.patch(user._id, { roleId: role._id })
    
    return {
      userId: user._id,
      oldRoleId: user.roleId,
      newRoleId: role._id,
      newRoleName: role.name
    }
  }
})

// Funzioni per la sincronizzazione Auth0 - VERSIONE SEMPLIFICATA PER LA GUIDA
export const createUserSimple = mutation({
  args: { 
    email: v.string(),
    nome: v.string(),
    cognome: v.string(),
    ruolo: v.string()
  },
  handler: async (ctx, args) => {
    // Trova un ruolo di default
    const roles = await ctx.db.query("roles").collect();
    const defaultRole = roles.find(r => r.name === args.ruolo) || roles[0];
    
    if (!defaultRole) {
      throw new Error("Nessun ruolo trovato nel sistema");
    }
    
    // Trova o crea una clinica di default
    let defaultClinicId;
    const defaultClinic = await ctx.db
      .query("clinics")
      .filter((q) => q.eq(q.field("code"), "DEMO001"))
      .first();
    
    if (!defaultClinic) {
      // Crea clinica di default
      defaultClinicId = await ctx.db.insert("clinics", {
        name: "Clinica Esempio",
        code: "DEMO001", 
        address: "Via Roma 123, Milano",
        phone: "+39 02 1234567",
        email: "info@clinicaesempio.it",
        settings: {
          allowPublicTickets: true,
          requireApprovalForCategories: false,
          defaultSlaHours: 24,
        },
        isActive: true,
      });
    } else {
      defaultClinicId = defaultClinic._id;
    }

    // Crea l'utente con lo schema completo
    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: `${args.nome} ${args.cognome}`,
      auth0Id: `auth0|${args.email.replace('@', '_').replace('.', '_')}`,
      roleId: defaultRole._id,
      clinicId: defaultClinicId,
      isActive: true,
      preferences: {
        notifications: { email: true, push: true },
        dashboard: { defaultView: "my-tickets", itemsPerPage: 25 },
      },
    });
    
    return userId;
  },
});