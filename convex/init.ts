import { mutation, internalMutation } from "./_generated/server"
import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"

// Mutation per inizializzare il database con dati di base
export const initializeDatabase = mutation({
  args: {},
  returns: v.object({
    message: v.string(),
    data: v.object({
      permissions: v.number(),
      roles: v.number(),
      clinics: v.number(),
      departments: v.number(),
      categories: v.number(),
      ticketStatuses: v.number(),
    })
  }),
  handler: async (ctx) => {
    // Verifica se il database è già inizializzato
    const existingPermissions = await ctx.db.query("permissions").collect()
    if (existingPermissions.length > 0) {
      throw new ConvexError("Database already initialized")
    }
    
    console.log("Initializing database...")
    
    // 1. Crea i permessi di base
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
    
    console.log(`Created ${permissionIds.length} permissions`)
    
    // 2. Crea i ruoli di base
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
    
    console.log("Created system roles: User, Agent, Admin")
    
    // 3. Crea le cliniche di base
    // 🆕 Clinica HQ per utenti @primogroup.it
    const hqClinicId = await ctx.db.insert("clinics", {
      name: "HQ",
      code: "HQ",
      address: "Sede Centrale Primo Group",
      phone: "+39 000 000 0000",
      email: "hq@primogroup.it",
      settings: {
        allowPublicTickets: true,
        requireApprovalForCategories: false,
        defaultSlaHours: 24,
      },
      isActive: true,
    })
    
    // Clinica di esempio
    const exampleClinicId = await ctx.db.insert("clinics", {
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
    
    console.log("Created example clinic")
    
    // 4. Crea dipartimenti di esempio
    const itDepartmentId = await ctx.db.insert("departments", {
      name: "IT",
      clinicId: exampleClinicId,
      isActive: true,
    })
    
    const hrDepartmentId = await ctx.db.insert("departments", {
      name: "Risorse Umane",
      clinicId: exampleClinicId,
      isActive: true,
    })
    
    console.log("Created example departments")
    
    // 5. Crea categorie di esempio
    const categories = [
      {
        name: "Supporto Tecnico",
        slug: "supporto-tecnico",
        description: "Problemi tecnici e supporto IT",
        departmentId: itDepartmentId,
        visibility: "public" as const,
        parentId: undefined,
        path: [],
        depth: 0,
        order: 0,
        synonyms: ["supporto", "tecnico", "it"],
        requiresApproval: false,
        isActive: true,
      },
      {
        name: "Richieste HR",
        slug: "richieste-hr",
        description: "Richieste relative alle risorse umane",
        departmentId: hrDepartmentId,
        visibility: "public" as const,
        parentId: undefined,
        path: [],
        depth: 0,
        order: 1,
        synonyms: ["hr", "risorse", "umane"],
        requiresApproval: false,
        isActive: true,
      },
      {
        name: "Manutenzione",
        slug: "manutenzione",
        description: "Richieste di manutenzione strutture",
        visibility: "public" as const,
        parentId: undefined,
        path: [],
        depth: 0,
        order: 2,
        synonyms: ["manutenzione", "riparazione"],
        requiresApproval: false,
        isActive: true,
      }
    ]
    
    const categoryIds = await Promise.all(
      categories.map(category => ctx.db.insert("categories", category))
    )
    
    console.log("Created example categories")
    
    // 6. 🆕 Inizializza gli stati dei ticket (open, in_progress, closed)
    console.log("Initializing ticket statuses...")
    
    // Controlla se ci sono già stati nella tabella
    const existingStatuses = await ctx.db.query("ticketStatuses").first()
    let statusCount = 0
    
    if (!existingStatuses) {
      const defaultStatuses = [
        {
          name: "Aperto",
          slug: "open",
          description: "Ticket appena creato, in attesa di lavorazione",
          color: "#ef4444",
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
          color: "#f59e0b",
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
          color: "#22c55e",
          icon: "check-circle",
          order: 3,
          isSystem: true,
          isActive: true,
          isFinal: true,
        }
      ]
      
      for (const status of defaultStatuses) {
        await ctx.db.insert("ticketStatuses", status)
        statusCount++
      }
      console.log(`✅ ${statusCount} stati inizializzati`)
    } else {
      console.log(`⚠️ Stati già presenti, skip inizializzazione`)
    }
    
    return {
      message: "Database initialized successfully",
      data: {
        permissions: permissionIds.length,
        roles: 3,
        clinics: 2, // 🆕 HQ + Clinica Esempio
        departments: 2,
        categories: categoryIds.length,
        ticketStatuses: statusCount, // 🆕 Conteggio stati inizializzati
      }
    }
  }
})

// Mutation per resettare il database (solo per sviluppo)
export const resetDatabase = mutation({
  args: {},
  returns: v.object({ message: v.string() }),
  handler: async (ctx) => {
    console.log("Resetting database...")
    
    // Elimina tutti i dati in ordine inverso per rispettare le dipendenze
    const tables = [
      "auditLogs",
      "attachments", 
      "comments",
      "tickets",
      "categories",
      "departments",
      "users",
      "roles",
      "permissions",
      "clinics",
      "slaRules",
      "triggers",
      "macros"
    ]
    
    for (const tableName of tables) {
      const items = await ctx.db.query(tableName as any).collect()
      for (const item of items) {
        await ctx.db.delete(item._id)
      }
      console.log(`Cleared ${tableName}: ${items.length} items`)
    }
    
    return { message: "Database reset successfully" }
  }
})