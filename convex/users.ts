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
    
    // Verifica permessi: solo gli admin possono modificare gli utenti
    const currentUserRole = await ctx.db.get(currentUser.roleId)
    
    if (!currentUserRole?.permissions?.includes("full_access")) {
      throw new ConvexError("Solo gli amministratori possono modificare gli utenti")
    }
    
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

// Mutation per sincronizzare auth0Id al login (auto-fix per ID sbagliati)
export const syncUserFromAuth0 = mutation({
  args: {
    auth0Id: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { auth0Id, email, name }) => {
    console.log('🔄 [syncUserFromAuth0] Inizio sync per:', { auth0Id, email })
    
    // 1. Cerca per auth0Id
    let user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", auth0Id))
      .unique()
    
    if (user) {
      console.log('✅ [syncUserFromAuth0] Utente trovato per auth0Id, aggiorno lastLogin')
      // Trovato per auth0Id corretto, aggiorna solo lastLogin
      await ctx.db.patch(user._id, { 
        lastLoginAt: Date.now(),
        name: name || user.name // Aggiorna nome se fornito
      })
      return user._id
    }
    
    // 2. Se non trovato per auth0Id, cerca per email
    user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique()
    
    if (user) {
      console.log('⚠️ [syncUserFromAuth0] Utente trovato per email ma con auth0Id diverso!')
      console.log('   Vecchio auth0Id:', user.auth0Id)
      console.log('   Nuovo auth0Id:', auth0Id)
      
      // Trovato per email ma con auth0Id diverso → AGGIORNA!
      await ctx.db.patch(user._id, { 
        auth0Id,  // 🔑 Aggiorna con l'ID corretto da Auth0
        lastLoginAt: Date.now(),
        name: name || user.name
      })
      
      console.log('✅ [syncUserFromAuth0] auth0Id aggiornato con successo!')
      return user._id
    }
    
    // 3. Se non esiste proprio, ritorna null (o crea se vuoi)
    console.log('❌ [syncUserFromAuth0] Utente non trovato né per auth0Id né per email')
    return null
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

// Query per ottenere tutti gli agenti disponibili per assegnazione ticket
export const getAvailableAgents = query({
  args: { 
    clinicId: v.optional(v.id("clinics")),
    userEmail: v.optional(v.string()) // Per test temporaneo
  },
  handler: async (ctx, { clinicId, userEmail }) => {
    console.log(`👥 getAvailableAgents chiamata per clinica ${clinicId}`)
    
    // TEMPORARY: Per ora prendo l'utente con la tua email per controlli permessi
    const currentUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()

    if (!currentUser) {
      throw new ConvexError("Utente non trovato")
    }

    // Solo agenti e admin possono vedere la lista degli agenti
    const currentUserRole = await ctx.db.get(currentUser.roleId)
    if (!currentUserRole || (currentUserRole.name !== 'Agente' && currentUserRole.name !== 'Amministratore')) {
      throw new ConvexError("Solo agenti e admin possono vedere la lista degli agenti")
    }

    // Ottieni tutti i ruoli di tipo agent e admin
    const agentRoles = await ctx.db
      .query("roles")
      .filter((q) => 
        q.or(
          q.eq(q.field("name"), "Agente"),
          q.eq(q.field("name"), "Amministratore")
        )
      )
      .collect()

    const agentRoleIds = agentRoles.map(role => role._id)

    // Ottieni tutti gli utenti con ruolo agent/admin
    let agents = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

    // Filtra solo agenti e admin
    agents = agents.filter(user => agentRoleIds.includes(user.roleId))

    // Se specificata una clinica, filtra per quella clinica
    if (clinicId) {
      agents = agents.filter(user => user.clinicId === clinicId)
    }

    // Popola i dettagli del ruolo e della clinica
    const agentsWithDetails = await Promise.all(
      agents.map(async (agent) => {
        const [role, clinic] = await Promise.all([
          ctx.db.get(agent.roleId),
          ctx.db.get(agent.clinicId)
        ])
        return {
          _id: agent._id,
          name: agent.name,
          email: agent.email,
          role: role ? { _id: role._id, name: role.name } : null,
          clinic: clinic ? { _id: clinic._id, name: clinic.name } : null,
        }
      })
    )

    console.log(`✅ Trovati ${agentsWithDetails.length} agenti disponibili`)
    return agentsWithDetails
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

// Mutation semplificata per aggiornare ruolo utente per ID (per sviluppo)
export const updateUserRoleById = mutation({
  args: {
    userId: v.id("users"),
    newRoleId: v.id("roles")
  },
  handler: async (ctx, { userId, newRoleId }) => {
    // Trova l'utente
    const user = await ctx.db.get(userId)
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Trova il ruolo
    const role = await ctx.db.get(newRoleId)
    if (!role) {
      throw new ConvexError("Ruolo non trovato")
    }

    // Aggiorna il ruolo dell'utente
    await ctx.db.patch(userId, { roleId: newRoleId })

    return {
      userId,
      oldRoleId: user.roleId,
      newRoleId,
      newRoleName: role.name
    }
  }
});