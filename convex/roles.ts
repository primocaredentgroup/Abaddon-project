import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"
import { getCurrentUser } from "./lib/utils"

// Query per ottenere tutti i permessi disponibili
export const getAllPermissions = query({
  handler: async (ctx) => {
    return await ctx.db.query("permissions").collect()
  }
})

// Query per ottenere tutti i ruoli
export const getAllRoles = query({
  args: { 
    clinicId: v.optional(v.id("clinics")),
    includeSystem: v.optional(v.boolean())
  },
  handler: async (ctx, { clinicId, includeSystem = true }) => {
    let roles
    
    if (clinicId) {
      roles = await ctx.db
        .query("roles")
        .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
        .collect()
    } else {
      roles = await ctx.db.query("roles").collect()
    }
    
    if (!includeSystem) {
      return roles.filter(role => !role.isSystem)
    }
    
    return roles
  }
})

// Query per ottenere un ruolo per ID
export const getRoleById = query({
  args: { roleId: v.id("roles") },
  handler: async (ctx, { roleId }) => {
    const role = await ctx.db.get(roleId)
    if (!role) {
      throw new ConvexError("Role not found")
    }
    
    // Ora permissions è già un array di stringhe, non serve fare lookup
    return {
      ...role,
      permissionDetails: role.permissions
    }
  }
})

// Mutation per creare i permessi di base del sistema
export const createSystemPermissions = mutation({
  handler: async (ctx) => {
    // Verifica se i permessi esistono già
    const existingPermissions = await ctx.db.query("permissions").collect()
    if (existingPermissions.length > 0) {
      return existingPermissions
    }
    
    const permissions = [
      // Permessi per ticket
      { resource: "tickets", action: "read", scope: "own" as const },
      { resource: "tickets", action: "read", scope: "clinic" as const },
      { resource: "tickets", action: "read", scope: "global" as const },
      { resource: "tickets", action: "write", scope: "own" as const },
      { resource: "tickets", action: "write", scope: "clinic" as const },
      { resource: "tickets", action: "write", scope: "global" as const },
      { resource: "tickets", action: "delete", scope: "own" as const },
      { resource: "tickets", action: "delete", scope: "clinic" as const },
      { resource: "tickets", action: "delete", scope: "global" as const },
      
      // Permessi per utenti
      { resource: "users", action: "read", scope: "clinic" as const },
      { resource: "users", action: "read", scope: "global" as const },
      { resource: "users", action: "write", scope: "clinic" as const },
      { resource: "users", action: "write", scope: "global" as const },
      { resource: "users", action: "delete", scope: "clinic" as const },
      { resource: "users", action: "delete", scope: "global" as const },
      
      // Permessi per cliniche
      { resource: "clinics", action: "read", scope: "global" as const },
      { resource: "clinics", action: "write", scope: "global" as const },
      { resource: "clinics", action: "delete", scope: "global" as const },
      
      // Permessi per categorie
      { resource: "categories", action: "read", scope: "clinic" as const },
      { resource: "categories", action: "write", scope: "clinic" as const },
      { resource: "categories", action: "delete", scope: "clinic" as const },
      { resource: "categories", action: "approve", scope: "clinic" as const },
      
      // Permessi per impostazioni
      { resource: "settings", action: "read", scope: "clinic" as const },
      { resource: "settings", action: "read", scope: "global" as const },
      { resource: "settings", action: "write", scope: "clinic" as const },
      { resource: "settings", action: "write", scope: "global" as const },
      
      // Permessi per report
      { resource: "reports", action: "read", scope: "clinic" as const },
      { resource: "reports", action: "read", scope: "global" as const },
    ]
    
    const permissionIds = await Promise.all(
      permissions.map(permission => ctx.db.insert("permissions", permission))
    )
    
    return permissionIds
  }
})

// Mutation per creare i ruoli di base del sistema
export const createSystemRoles = mutation({
  handler: async (ctx) => {
    // Verifica se i ruoli esistono già
    const existingRoles = await ctx.db
      .query("roles")
      .filter((q) => q.eq(q.field("isSystem"), true))
      .collect()
      
    if (existingRoles.length > 0) {
      return existingRoles
    }
    
    // Crea i ruoli con permissions come stringhe
    const userRoleId = await ctx.db.insert("roles", {
      name: "Utente",
      description: "Utente base che può creare e gestire i propri ticket",
      permissions: ["view_own_tickets", "create_tickets", "comment_tickets"],
      isSystem: true,
      isActive: true,
    })
    
    const agentRoleId = await ctx.db.insert("roles", {
      name: "Agente",
      description: "Agente che può gestire ticket della propria clinica",
      permissions: ["view_all_tickets", "create_tickets", "edit_tickets", "assign_tickets"],
      isSystem: true,
      isActive: true,
    })
    
    const adminRoleId = await ctx.db.insert("roles", {
      name: "Amministratore",
      description: "Amministratore con accesso completo al sistema",
      permissions: ["full_access"],
      isSystem: true,
      isActive: true,
    })
    
    return [userRoleId, agentRoleId, adminRoleId]
  }
})

// Mutation per creare un nuovo ruolo personalizzato
export const createRole = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    clinicId: v.optional(v.id("clinics")),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Validazioni
    if (args.name.length < 2) {
      throw new ConvexError("Role name must be at least 2 characters long")
    }
    
    // Crea il ruolo
    const roleId = await ctx.db.insert("roles", {
      name: args.name,
      description: args.description,
      clinicId: args.clinicId,
      permissions: args.permissions,
      isSystem: false,
      isActive: true,
    })
    
    return roleId
  }
})

// Mutation per aggiornare un ruolo
export const updateRole = mutation({
  args: {
    roleId: v.id("roles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { roleId, ...updates }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che il ruolo esista
    const role = await ctx.db.get(roleId)
    if (!role) {
      throw new ConvexError("Role not found")
    }
    
    // Non permettere modifica dei ruoli di sistema
    if (role.isSystem) {
      throw new ConvexError("Cannot modify system roles")
    }
    
    // Validazioni
    if (updates.name && updates.name.length < 2) {
      throw new ConvexError("Role name must be at least 2 characters long")
    }
    
    // Aggiorna il ruolo
    await ctx.db.patch(roleId, updates)
    
    return roleId
  }
})

// Mutation per eliminare un ruolo personalizzato
export const deleteRole = mutation({
  args: { roleId: v.id("roles") },
  handler: async (ctx, { roleId }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che il ruolo esista
    const role = await ctx.db.get(roleId)
    if (!role) {
      throw new ConvexError("Role not found")
    }
    
    // Non permettere eliminazione dei ruoli di sistema
    if (role.isSystem) {
      throw new ConvexError("Cannot delete system roles")
    }
    
    // Verifica che non ci siano utenti con questo ruolo
    const usersWithRole = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .collect()
      
    if (usersWithRole.length > 0) {
      throw new ConvexError("Cannot delete role: users are still assigned to this role")
    }
    
    // Elimina il ruolo
    await ctx.db.delete(roleId)
    
    return roleId
  }
})

// 🔧 MUTATION TEMPORANEA per fixare ruoli vecchi senza isActive
export const fixOldRolesSchema = mutation({
  handler: async (ctx) => {
    
    const allRoles = await ctx.db.query("roles").collect();
    
    let fixed = 0;
    let alreadyOk = 0;
    
    for (const role of allRoles) {
      // @ts-ignore - Ignoriamo il tipo perché stiamo fixando vecchi dati
      if (role.isActive === undefined) {
        await ctx.db.patch(role._id, {
          isActive: true,
        });
        fixed++;
      } else {
        alreadyOk++;
      }
      
      // Fix anche permissions se sono ancora ID invece di stringhe
      // @ts-ignore
      if (role.permissions && role.permissions.length > 0 && typeof role.permissions[0] !== 'string') {
        await ctx.db.patch(role._id, {
          permissions: role.name === "Amministratore" 
            ? ["full_access"]
            : role.name === "Agente"
            ? ["view_all_tickets", "create_tickets", "edit_tickets", "assign_tickets"]
            : ["view_own_tickets", "create_tickets", "comment_tickets"]
        });
      }
    }
    
    return {
      total: allRoles.length,
      fixed,
      alreadyOk,
      message: `✅ Fixed ${fixed} roles, ${alreadyOk} were already ok`
    };
  },
});