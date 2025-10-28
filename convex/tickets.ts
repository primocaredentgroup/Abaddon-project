import { v } from "convex/values"
import { mutation, query, internalMutation, internalQuery } from "./_generated/server"
import { ConvexError } from "convex/values"
// import { getCurrentUser } from "./lib/utils" // Non usato al momento
import { internal } from "./_generated/api"
import { canManageAllTickets } from "./lib/permissions"
import { Id } from "./_generated/dataModel"
import type { QueryCtx, MutationCtx } from "./_generated/server"
import { userHasAccessToCategory } from "./categories"

// Helper function per ottenere tutte le clinic IDs dell'utente
async function getUserClinicIds(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<Id<"clinics">[]> {
  const user = await ctx.db.get(userId);
  if (!user) return [];
  
  // Ottieni cliniche da userClinics (attive)
  const userClinics = await ctx.db
    .query("userClinics")
    .withIndex("by_user_active", (q) =>
      q.eq("userId", userId).eq("isActive", true)
    )
    .collect();
  
  if (userClinics.length > 0) {
    return userClinics.map(uc => uc.clinicId);
  }
  
  // Fallback: usa user.clinicId se esiste (backward compatibility)
  if (user.clinicId) {
    return [user.clinicId];
  }
  
  return [];
}

// Query to get tickets for current user's clinic with filters
export const getByClinic = query({
  args: {
    status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed"))),
    assigneeId: v.optional(v.id("users")),
    creatorId: v.optional(v.id("users")),
    categoryId: v.optional(v.id("categories")),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }

    // Ottieni tutte le cliniche dell'utente
    const clinicIds = await getUserClinicIds(ctx, user._id);
    
    if (clinicIds.length === 0) {
      return { tickets: [], total: 0, hasMore: false };
    }

    // Ottieni tutti i ticket dalle cliniche dell'utente
    const allTickets = await ctx.db.query("tickets").collect();
    let tickets = allTickets.filter(t => clinicIds.includes(t.clinicId))

    // Apply filters
    if (args.status) {
      tickets = tickets.filter(t => t.status === args.status)
    }

    if (args.assigneeId) {
      tickets = tickets.filter(t => t.assigneeId === args.assigneeId)
    }

    if (args.creatorId) {
      tickets = tickets.filter(t => t.creatorId === args.creatorId)
    }

    if (args.categoryId) {
      tickets = tickets.filter(t => t.categoryId === args.categoryId)
    }

    if (args.visibility) {
      tickets = tickets.filter(t => t.visibility === args.visibility)
    }

    // Apply visibility rules - users can only see:
    // 1. Public tickets in their clinic
    // 2. Their own private tickets
    // 3. Private tickets assigned to them
    // TODO: Add role-based access for agents/admins
    tickets = tickets.filter(ticket => 
      ticket.visibility === 'public' ||
      ticket.creatorId === user._id ||
      ticket.assigneeId === user._id
    )

    // Sort by last activity (most recent first)
    tickets.sort((a, b) => b.lastActivityAt - a.lastActivityAt)

    // Apply pagination
    const offset = args.offset || 0
    const limit = args.limit || 50
    
    return {
      tickets: tickets.slice(offset, offset + limit),
      total: tickets.length,
      hasMore: tickets.length > offset + limit,
    }
  },
})

// 🔓 Query INTERNA per agent - NON richiede autenticazione
export const getByClinicInternal = internalQuery({
  args: {
    clinicId: v.id("clinics"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { clinicId, limit = 20 }) => {
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .order("desc")
      .take(limit)
    
    return tickets
  },
})

// Query per ottenere un ticket per ID con auth
export const getById = query({
  args: { 
    id: v.id("tickets"),
    userEmail: v.optional(v.string()) // Per test temporaneo
  },
  handler: async (ctx, { id, userEmail }) => {
    
    const ticket = await ctx.db.get(id)
    if (!ticket) {
      return null
    }
    
    // TEMPORARY: Per ora prendo l'utente con la tua email
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Verifica permessi: l'utente può vedere il ticket se:
    // 1. È il creatore
    // 2. È l'assegnatario
    // 3. Ha accesso alla clinica del ticket
    // 4. Il ticket è pubblico e nella sua clinica
    const clinicIds = await getUserClinicIds(ctx, user._id);
    const hasClinicAccess = clinicIds.includes(ticket.clinicId);
    
    const canView = 
      ticket.creatorId === user._id || 
      ticket.assigneeId === user._id ||
      hasClinicAccess ||
      (ticket.visibility === 'public' && hasClinicAccess)

    if (!canView) {
      throw new ConvexError("Non hai permessi per vedere questo ticket")
    }
    
    const result = {
      ...ticket,
      // Aggiungi i dati delle relazioni
      category: await ctx.db.get(ticket.categoryId),
      clinic: await ctx.db.get(ticket.clinicId),
      creator: await ctx.db.get(ticket.creatorId),
      assignee: ticket.assigneeId ? await ctx.db.get(ticket.assigneeId) : null,
    }
    
    return result
  },
})

// Query per ottenere TUTTI i ticket da risolvere per agenti (con evidenziati i sollecitati)
export const getNudgedTickets = query({
  args: {
    userEmail: v.optional(v.string()), // Per test temporaneo
  },
  handler: async (ctx, { userEmail }) => {
    
    // TEMPORARY: Per ora prendo l'utente con la tua email
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Verifica che l'utente sia un agente o admin (controllo basato su permessi)
    const role = await ctx.db.get(user.roleId)
    if (!role || !canManageAllTickets(role)) {
      throw new ConvexError("Solo agenti e admin possono vedere i ticket sollecitati")
    }

    // Ottieni TUTTI i ticket aperti o in corso (non solo quelli sollecitati)
    const allTickets = await ctx.db
      .query("tickets")
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "open"),
          q.eq(q.field("status"), "in_progress")
        )
      )
      .collect()

    // Ordina: prima i sollecitati, poi per data
    const sortedTickets = allTickets.sort((a, b) => {
      const aNudged = (a.nudgeCount || 0) > 0
      const bNudged = (b.nudgeCount || 0) > 0
      
      // Prima mostra i sollecitati
      if (aNudged && !bNudged) return -1
      if (!aNudged && bNudged) return 1
      
      // Tra i sollecitati, ordina per numero di solleciti
      if (aNudged && bNudged) {
        const nudgeDiff = (b.nudgeCount || 0) - (a.nudgeCount || 0)
        if (nudgeDiff !== 0) return nudgeDiff
      }
      
      // Altrimenti ordina per data (più recenti prima)
      return b._creationTime - a._creationTime
    })

    // Popola i dettagli per ogni ticket
    const ticketsWithDetails = await Promise.all(
      sortedTickets.map(async (ticket: any) => {
        const category = await ctx.db.get(ticket.categoryId)
        const clinic = await ctx.db.get(ticket.clinicId)
        const creator = await ctx.db.get(ticket.creatorId)
        const assignee = ticket.assigneeId ? await ctx.db.get(ticket.assigneeId) : null
        const lastNudger = ticket.lastNudgeBy ? await ctx.db.get(ticket.lastNudgeBy) : null
        
        return {
          ...ticket,
          category,
          clinic,
          creator,
          assignee,
          lastNudger,
        }
      })
    )

    const nudgedCount = ticketsWithDetails.filter(t => (t.nudgeCount || 0) > 0).length
    return ticketsWithDetails
  },
})

// Mutation per aggiornare un ticket
export const update: any = mutation({
  args: {
    id: v.id("tickets"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed"))),
    assigneeId: v.optional(v.id("users")),
    categoryId: v.optional(v.id("categories")),
    clinicId: v.optional(v.id("clinics")),
    userEmail: v.optional(v.string()) // Per test temporaneo
  },
  handler: async (ctx, args): Promise<any> => {
    
    // TEMPORARY: Per ora prendo l'utente con la tua email
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    const ticket = await ctx.db.get(args.id)
    if (!ticket) {
      throw new ConvexError("Ticket non trovato")
    }

    // Verifica permessi
    const role = await ctx.db.get(user.roleId)
    // Controllo permessi basato su ruolo
    const canEdit = 
      ticket.creatorId === user._id || 
      ticket.assigneeId === user._id ||
      canManageAllTickets(role)

    if (!canEdit) {
      throw new ConvexError("Non hai permessi per modificare questo ticket")
    }

    // Prepara i dati da aggiornare
    const updateData: any = {
      lastActivityAt: Date.now(),
    }

    if (args.title) updateData.title = args.title
    if (args.description) updateData.description = args.description
    if (args.status) updateData.status = args.status
    if (args.assigneeId !== undefined) updateData.assigneeId = args.assigneeId
    if (args.categoryId) updateData.categoryId = args.categoryId
    if (args.clinicId) updateData.clinicId = args.clinicId

    // Aggiorna il ticket
    await ctx.db.patch(args.id, updateData)

    return { success: true }
  },
})

// Mutation specifica per cambiare l'assegnatario di un ticket (solo per agenti/admin)
export const changeAssignee: any = mutation({
  args: {
    ticketId: v.id("tickets"),
    newAssigneeId: v.optional(v.id("users")), // null per rimuovere assegnazione
    userEmail: v.optional(v.string()) // Per test temporaneo
  },
  handler: async (ctx, args): Promise<any> => {
    
    // TEMPORARY: Per ora prendo l'utente con la tua email
    const currentUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()

    if (!currentUser) {
      throw new ConvexError("Utente non trovato")
    }

    // Verifica che l'utente corrente sia un agente o admin
    const currentUserRole = await ctx.db.get(currentUser.roleId)
    if (!currentUserRole || (currentUserRole.name !== 'Agente' && currentUserRole.name !== 'Amministratore')) {
      throw new ConvexError("Solo agenti e admin possono cambiare l'assegnatario dei ticket")
    }

    // Verifica che il ticket esista
    const ticket = await ctx.db.get(args.ticketId)
    if (!ticket) {
      throw new ConvexError("Ticket non trovato")
    }

    // Se viene specificato un nuovo assegnatario, verifica che esista e sia un agente/admin
    if (args.newAssigneeId) {
      const newAssignee = await ctx.db.get(args.newAssigneeId)
      if (!newAssignee) {
        throw new ConvexError("Nuovo assegnatario non trovato")
      }

      const newAssigneeRole = await ctx.db.get(newAssignee.roleId)
      if (!newAssigneeRole || (newAssigneeRole.name !== 'Agente' && newAssigneeRole.name !== 'Amministratore')) {
        throw new ConvexError("Il nuovo assegnatario deve essere un agente o admin")
      }

      // Verifica che il nuovo assegnatario sia attivo
      if (!newAssignee.isActive) {
        throw new ConvexError("Il nuovo assegnatario deve essere un utente attivo")
      }
    }

    // Aggiorna l'assegnatario del ticket
    await ctx.db.patch(args.ticketId, {
      assigneeId: args.newAssigneeId,
      lastActivityAt: Date.now(), // Aggiorna anche l'attività
    })

    const actionText = args.newAssigneeId ? "assegnato" : "rimossa assegnazione"
    
    return { 
      success: true, 
      ticketId: args.ticketId,
      newAssigneeId: args.newAssigneeId 
    }
  },
})

// Query to get tickets assigned to current user
export const getMyAssigned = query({
  args: {
    status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }

    let query = ctx.db
      .query("tickets")
      .withIndex("by_assignee", (q) => q.eq("assigneeId", user._id))

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status))
    }

    const tickets = await query.collect()
    
    // Sort by last activity
    tickets.sort((a, b) => b.lastActivityAt - a.lastActivityAt)

    const limit = args.limit || 20
    return tickets.slice(0, limit)
  },
})

// Query to get tickets created by current user
export const getMyCreated = query({
  args: {
    status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }

    let query = ctx.db
      .query("tickets")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status))
    }

    const tickets = await query.collect()
    
    // Sort by creation time (most recent first)
    tickets.sort((a, b) => b._creationTime - a._creationTime)

    const limit = args.limit || 20
    return tickets.slice(0, limit)
  },
})

// Mutation to create a new ticket
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    categoryId: v.id("categories"),
    attributes: v.optional(v.any()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }

    // Verifica che l'utente abbia una clinica assegnata
    if (!user.clinicId) {
      throw new ConvexError("User has no clinic assigned")
    }

    // Verify category exists and user has access (via società)
    const category = await ctx.db.get(args.categoryId)
    if (!category) {
      throw new ConvexError("Category not found")
    }
    
    // Verifica accesso via società (importato in cima)
    const hasAccess = await userHasAccessToCategory(ctx, user._id, args.categoryId)
    if (!hasAccess) {
      throw new ConvexError("Access denied to this category")
    }

    // Get clinic settings to check if public tickets are allowed
    const clinic = await ctx.db.get(user.clinicId!)
    const visibility = args.visibility || 'private'
    
    // Per ora tutti i ticket sono privati, rimuoveremo questa logica
    // if (visibility === 'public' && !(clinic as any)?.settings?.allowPublicTickets) {
    //   throw new ConvexError("Public tickets are not allowed in this clinic")
    // }

    // Validate attributes if provided
    if (args.attributes) {
      const validationErrors = await ctx.runMutation(internal.categoryAttributes.validateTicketAttributes, {
        categoryId: args.categoryId,
        attributes: args.attributes,
      })

      if (validationErrors.length > 0) {
        throw new ConvexError(`Validation errors: ${validationErrors.map((e: any) => e.message).join(', ')}`)
      }
    }

    // Create the ticket
    const now = Date.now()
    const ticketId: any = await ctx.db.insert("tickets", {
      title: args.title.trim(),
      description: args.description.trim(),
      status: "open",
      ticketNumber: 0, // Placeholder - questa funzione sarà rimossa
      categoryId: args.categoryId,
      clinicId: user.clinicId!,
      creatorId: user._id,
      visibility,
      lastActivityAt: now,
      attributeCount: 0, // Will be updated when attributes are added
      priority: 1, // Default: Molto Bassa (1/5)
    })

    // Save attributes if provided
    if (args.attributes && Object.keys(args.attributes).length > 0) {
      // Note: setTicketAttributes is not exported as internal, so we'll handle attributes differently
      // For now, we'll skip setting attributes in the create mutation
    }

    // Log the creation
    await ctx.runMutation(internal.auditLogs.log, {
      entityType: "ticket",
      entityId: ticketId,
      action: "created",
      changes: {
        title: args.title,
        description: args.description,
        categoryId: args.categoryId,
        visibility,
      },
    })

    return ticketId
  },
})

// Mutation to create a ticket with authentication
export const createWithAuth = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    categoryId: v.id("categories"),
    clinicId: v.optional(v.id("clinics")), // 🆕 Clinica da usare (se omessa usa user.clinicId)
    attributes: v.optional(v.any()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    priority: v.optional(v.number()), // Priorità 1-5 (solo agenti/admin, default: 1)
    userEmail: v.string(),
  },
  handler: async (ctx, args): Promise<{ ticketId: any, ticketNumber: number }> => {
    
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato nel sistema")
    }
    
    // Determina clinicId da usare
    let targetClinicId: Id<"clinics"> | undefined = args.clinicId;
    
    if (targetClinicId) {
      // Se clinicId è passato, verifica che l'utente abbia accesso a questa clinica
      const userClinic = await ctx.db
        .query("userClinics")
        .withIndex("by_user_clinic", (q) =>
          q.eq("userId", user._id).eq("clinicId", targetClinicId!)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .unique();
      
      if (!userClinic) {
        throw new ConvexError("Non hai accesso a questa clinica");
      }
    } else {
      // Fallback: usa user.clinicId (backward compatibility)
      if (!user.clinicId) {
        throw new ConvexError("Nessuna clinica associata all'utente");
      }
      targetClinicId = user.clinicId;
    }
    
    // Dopo i check sopra, targetClinicId è garantito essere defined
    if (!targetClinicId) {
      throw new ConvexError("Clinic ID not determined");
    }

    // Verify category exists
    const category = await ctx.db.get(args.categoryId)
    if (!category) {
      throw new ConvexError("Categoria non trovata")
    }
    

    // Ottieni il prossimo numero ticket GLOBALE
    const ticketNumber: any = await ctx.runMutation(internal.counters.getNextNumber, {
      counterName: "tickets"
    })
    

    // Get clinic settings to check if public tickets are allowed
    const clinic = await ctx.db.get(targetClinicId!)
    const visibility = args.visibility || 'private'
    
    // Gestisci priorità (solo agenti/admin possono impostarla diversa da 1)
    let priority = 1; // Default per tutti gli utenti
    if (args.priority !== undefined) {
      // Validazione priorità
      if (args.priority < 1 || args.priority > 5) {
        throw new ConvexError("Priorità non valida. Deve essere tra 1 e 5.");
      }
      // Verifica che l'utente sia agente/admin
      const role = await ctx.db.get(user.roleId);
      if (role && (role.permissions.includes("manage_all_tickets") || role.permissions.includes("assign_tickets"))) {
        priority = args.priority;
      }
      // Se non è agente/admin, ignora il valore e usa default 1
    }
    
    // Per ora tutti i ticket sono privati
    // if (visibility === 'public' && !(clinic as any)?.settings?.allowPublicTickets) {
    //   console.warn('⚠️ Ticket pubblici non permessi, forzo a privato')
    //   // Non fallire, forza a privato
    // }

    // Create the ticket
    const now = Date.now()
    const ticketId: any = await ctx.db.insert("tickets", {
      title: args.title.trim(),
      description: args.description.trim(),
      status: "open",
      ticketNumber: ticketNumber, // Il numero incrementale che abbiamo generato
      categoryId: args.categoryId,
      clinicId: targetClinicId!, // 🆕 Usa la clinica selezionata
      creatorId: user._id,
      visibility: visibility, // ✅ Usa il valore dal parametro (default: 'private')
      lastActivityAt: now,
      attributeCount: 0,
      priority: priority, // Priorità 1-5 (default: 1, modificabile solo da agenti/admin)
    })


    // 🎯 ESEGUI I TRIGGER ATTIVI DELLA CLINICA
    const triggers = await ctx.db
      .query("triggers")
      .withIndex("by_clinic", (q) => q.eq("clinicId", targetClinicId!))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()


    for (const trigger of triggers) {
      
      let conditionMet = false

      // Valuta le condizioni
      if (trigger.conditions.type === 'category_match') {
        // Confronta con lo slug della categoria
        const categorySlug = category.slug
        conditionMet = categorySlug === trigger.conditions.value
      } else if (trigger.conditions.type === 'status_change') {
        // Confronta con lo status del ticket (sempre "open" alla creazione)
        conditionMet = 'open' === trigger.conditions.value
      } else if (trigger.conditions.type === 'priority_eq') {
        // Confronta con la priorità del ticket (priorità esatta)
        conditionMet = priority === parseInt(trigger.conditions.value)
      } else if (trigger.conditions.type === 'priority_gte') {
        // Confronta con la priorità del ticket (priorità >= valore)
        conditionMet = priority >= parseInt(trigger.conditions.value)
      } else if (trigger.conditions.type === 'priority_lte') {
        // Confronta con la priorità del ticket (priorità <= valore)
        conditionMet = priority <= parseInt(trigger.conditions.value)
      }

      // Se la condizione è soddisfatta, esegui le azioni
      if (conditionMet) {

        if (trigger.actions.type === 'assign_user') {
          // Trova l'utente da assegnare per email
          const assigneeUser = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("email"), trigger.actions.value))
            .first()

          if (assigneeUser) {
            // Assegna il ticket all'utente
            await ctx.db.patch(ticketId, { 
              assigneeId: assigneeUser._id,
              lastActivityAt: Date.now()
            })
          } else {
            console.warn(`  ⚠️ Utente ${trigger.actions.value} non trovato`)
          }
        } else if (trigger.actions.type === 'change_status') {
          // Cambia lo status del ticket
          await ctx.db.patch(ticketId, { 
            status: trigger.actions.value,
            lastActivityAt: Date.now()
          })
        } else if (trigger.actions.type === 'set_priority') {
          // Imposta la priorità del ticket (1-5)
          const newPriority = parseInt(trigger.actions.value);
          if (newPriority >= 1 && newPriority <= 5) {
            await ctx.db.patch(ticketId, { 
              priority: newPriority,
              lastActivityAt: Date.now()
            })
          } else {
            console.warn(`  ⚠️ Priorità non valida: ${trigger.actions.value} (deve essere 1-5)`)
          }
        }
      } else {
      }
    }

    return { ticketId, ticketNumber }
  },
})

// Query to get my created tickets with authentication
// Query per ottenere i miei ticket creati (UTENTE vede solo i suoi)
export const getMyCreatedWithAuth = query({
  args: {
    status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed"))),
    limit: v.optional(v.number()),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato nel sistema")
    }

    // UTENTE: vede solo i ticket che ha creato LUI
    let query = ctx.db
      .query("tickets")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status))
    }

    const tickets = await query.collect()
    
    // Sort by creation time (most recent first)  
    tickets.sort((a, b) => b._creationTime - a._creationTime)

    const limit = args.limit || 20
    const limitedTickets = tickets.slice(0, limit)

    // Popola i dati correlati (category, clinic, creator, assignee)
    const ticketsWithDetails = await Promise.all(
      limitedTickets.map(async (ticket) => {
        const [category, clinic, creator, assignee] = await Promise.all([
          ctx.db.get(ticket.categoryId),
          ctx.db.get(ticket.clinicId),
          ctx.db.get(ticket.creatorId),
          ticket.assigneeId ? ctx.db.get(ticket.assigneeId) : null,
        ])

        return {
          ...ticket,
          category,
          clinic,
          creator,
          assignee,
        }
      })
    )

    return ticketsWithDetails
  },
})

// Query per ottenere ticket delle mie cliniche (UTENTE può vedere anche ticket di altri nelle sue cliniche)
export const getMyClinicTicketsWithAuth = query({
  args: {
    status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed"))),
    limit: v.optional(v.number()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()
    
    if (!user) return []

    // 🏥 Ottieni TUTTE le cliniche dell'utente (multi-clinic + fallback)
    const clinicIds = await getUserClinicIds(ctx, user._id);

    if (clinicIds.length === 0) {
      return []; // Nessuna clinica associata
    }

    // Ottieni tutti i ticket delle cliniche dell'utente
    const allTickets = await ctx.db.query("tickets").collect()
    
    // 🆕 Filtra per:
    // 1. Cliniche dell'utente
    // 2. SOLO ticket pubblici (i privati vanno in "I miei ticket")
    let relevantTickets = allTickets
      .filter(ticket => clinicIds.includes(ticket.clinicId))
      .filter(ticket => ticket.visibility === 'public')

    // Filtra per status se specificato
    if (args.status) {
      relevantTickets = relevantTickets.filter(ticket => ticket.status === args.status)
    }


    // Sort by creation time (most recent first)
    relevantTickets.sort((a, b) => b._creationTime - a._creationTime)

    const limit = args.limit || 20
    const limitedTickets = relevantTickets.slice(0, limit)

    // Popola i dati correlati
    const ticketsWithDetails = await Promise.all(
      limitedTickets.map(async (ticket) => {
        const [category, clinic, creator, assignee] = await Promise.all([
          ctx.db.get(ticket.categoryId),
          ctx.db.get(ticket.clinicId),
          ctx.db.get(ticket.creatorId),
          ticket.assigneeId ? ctx.db.get(ticket.assigneeId) : null,
        ])

        return {
          ...ticket,
          category,
          clinic,
          creator,
          assignee,
        }
      })
    )

    return ticketsWithDetails
  },
})

// Query per ottenere ticket assegnati a me (AGENTE)
export const getMyAssignedTicketsWithAuth = query({
  args: {
    status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed"))),
    limit: v.optional(v.number()),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()
    
    if (!user) return []

    // AGENTE: vede tutti i ticket assegnati a lui di TUTTE le cliniche
    let query = ctx.db
      .query("tickets")
      .withIndex("by_assignee", (q) => q.eq("assigneeId", user._id))

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status))
    }

    const tickets = await query.collect()

    // Sort by creation time (most recent first)
    tickets.sort((a, b) => b._creationTime - a._creationTime)

    const limit = args.limit || 20
    const limitedTickets = tickets.slice(0, limit)

    // Popola i dati correlati
    const ticketsWithDetails = await Promise.all(
      limitedTickets.map(async (ticket) => {
        const [category, clinic, creator, assignee] = await Promise.all([
          ctx.db.get(ticket.categoryId),
          ctx.db.get(ticket.clinicId),
          ctx.db.get(ticket.creatorId),
          ticket.assigneeId ? ctx.db.get(ticket.assigneeId) : null,
        ])

        return {
          ...ticket,
          category,
          clinic,
          creator,
          assignee,
        }
      })
    )

    return ticketsWithDetails
  },
})

// Funzione update duplicata rimossa - viene usata quella sopra con userEmail

// Query to get all tickets for the "all tickets" page
export const list = query({
  args: {
    status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed"))),
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }
    
    const clinicId = args.clinicId || user.clinicId
    if (!clinicId) {
      throw new ConvexError("Clinic ID not found")
    }

    // Start with clinic-based query
    let query = ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))

    // Apply status filter if provided
    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status))
    }

    const tickets = await query.collect()

    // Apply visibility rules
    const visibleTickets = tickets.filter(ticket => 
      ticket.visibility === 'public' ||
      ticket.creatorId === user._id ||
      ticket.assigneeId === user._id
    )

    // Sort by last activity (most recent first)
    visibleTickets.sort((a, b) => b.lastActivityAt - a.lastActivityAt)

    // Enrich with related data
    const enrichedTickets = await Promise.all(
      visibleTickets.map(async (ticket) => {
        const [category, assignee, creator, department] = await Promise.all([
          ticket.categoryId ? ctx.db.get(ticket.categoryId) : null,
          ticket.assigneeId ? ctx.db.get(ticket.assigneeId) : null,
          ctx.db.get(ticket.creatorId),
          ticket.departmentId ? ctx.db.get(ticket.departmentId) : null,
        ])

        return {
          ...ticket,
          category,
          assignee,
          creator,
          department,
        }
      })
    )

    return enrichedTickets
  },
})

// Mutation to assign ticket to user
export const assign = mutation({
  args: {
    ticketId: v.id("tickets"),
    assigneeId: v.optional(v.id("users")),
  },
  handler: async (ctx, { ticketId, assigneeId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }

    const ticket = await ctx.db.get(ticketId)
    if (!ticket || ticket.clinicId !== user.clinicId) {
      throw new ConvexError("Ticket not found or access denied")
    }

    // TODO: Add role-based permission check (only agents/admins can assign)

    // Validate assignee if provided
    if (assigneeId) {
      const assignee = await ctx.db.get(assigneeId)
      if (!assignee || assignee.clinicId !== user.clinicId) {
        throw new ConvexError("Invalid assignee")
      }
      // TODO: Add role validation for assignee (must be agent or admin)
    }

    const oldAssigneeId = ticket.assigneeId

    // Update the assignment
    await ctx.db.patch(ticketId, {
      assigneeId,
      lastActivityAt: Date.now(),
    })

    // Log the assignment change
    await ctx.runMutation(internal.auditLogs.log, {
      entityType: "ticket",
      entityId: ticketId,
      action: assigneeId ? "assigned" : "unassigned",
      changes: {
        assigneeId: {
          from: oldAssigneeId,
          to: assigneeId,
        },
      },
    })

    return ticketId
  },
})

// Mutation per assegnare il ticket a se stessi
export const assignToMe = mutation({
  args: {
    ticketId: v.id("tickets"),
    userEmail: v.string()
  },
  handler: async (ctx, { ticketId, userEmail }) => {

    // Trova l'utente corrente
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", userEmail))
      .first()

    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Verifica che sia un agente o admin (controllo basato su permessi)
    const role = await ctx.db.get(user.roleId)
    if (!role || !canManageAllTickets(role)) {
      throw new ConvexError("Solo agenti e admin possono assegnarsi ticket")
    }

    // Verifica che il ticket esista e appartenga alla stessa clinica
    const ticket = await ctx.db.get(ticketId)
    if (!ticket) {
      throw new ConvexError("Ticket non trovato")
    }

    if (ticket.clinicId !== user.clinicId) {
      throw new ConvexError("Non puoi assegnarti ticket di altre cliniche")
    }

    // Verifica che il ticket non sia già assegnato all'utente
    if (ticket.assigneeId === user._id) {
      return { success: true, alreadyAssigned: true }
    }

    // Assegna il ticket all'utente
    await ctx.db.patch(ticketId, {
      assigneeId: user._id,
      lastActivityAt: Date.now(),
    })


    return { 
      success: true, 
      ticketId,
      assigneeId: user._id,
      alreadyAssigned: false
    }
  },
})

// Mutation to change ticket status
export const changeStatus = mutation({
  args: {
    ticketId: v.id("tickets"),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed")),
  },
  handler: async (ctx, { ticketId, status }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }

    const ticket = await ctx.db.get(ticketId)
    if (!ticket || ticket.clinicId !== user.clinicId) {
      throw new ConvexError("Ticket not found or access denied")
    }

    // Check permissions
    const canChangeStatus = 
      ticket.assigneeId === user._id ||
      ticket.creatorId === user._id
      // TODO: Add role-based check for agents/admins

    if (!canChangeStatus) {
      throw new ConvexError("Insufficient permissions to change ticket status")
    }

    const oldStatus = ticket.status

    // Update the status
    await ctx.db.patch(ticketId, {
      status,
      lastActivityAt: Date.now(),
    })

    // Log the status change
    await ctx.runMutation(internal.auditLogs.log, {
      entityType: "ticket",
      entityId: ticketId,
      action: "status_changed",
      changes: {
        status: {
          from: oldStatus,
          to: status,
        },
      },
    })

    return ticketId
  },
})

// Internal mutation for creating audit logs
export const createAuditLog = internalMutation({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
    userId: v.id("users"),
    changes: v.any(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLogs", args)
  },
})

// Query to get ticket statistics for dashboard
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }
    
    if (!user.clinicId) {
      throw new ConvexError("User has no clinic assigned")
    }

    // Get all tickets for the clinic
    const allTickets = await ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId!))
      .collect()

    // Filter by visibility rules
    const visibleTickets = allTickets.filter(ticket => 
      ticket.visibility === 'public' ||
      ticket.creatorId === user._id ||
      ticket.assigneeId === user._id
    )

    // Calculate statistics
    const stats = {
      total: visibleTickets.length,
      open: visibleTickets.filter(t => t.status === 'open').length,
      inProgress: visibleTickets.filter(t => t.status === 'in_progress').length,
      closed: visibleTickets.filter(t => t.status === 'closed').length,
      myAssigned: visibleTickets.filter(t => t.assigneeId === user._id).length,
      myCreated: visibleTickets.filter(t => t.creatorId === user._id).length,
      unassigned: visibleTickets.filter(t => !t.assigneeId).length,
    }

    return stats
  },
})

// Query for advanced ticket search with filters
export const search = query({
  args: {
    searchTerm: v.optional(v.string()),
    status: v.optional(v.array(v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed")))),
    categoryId: v.optional(v.id("categories")),
    assigneeId: v.optional(v.id("users")),
    creatorId: v.optional(v.id("users")),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    attributes: v.optional(v.any()), // Dynamic attribute filters
    sortBy: v.optional(v.union(
      v.literal("created"),
      v.literal("updated"),
      v.literal("title"),
      v.literal("status")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }
    
    if (!user.clinicId) {
      throw new ConvexError("User has no clinic assigned")
    }

    // Start with clinic-based query
    let tickets = await ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId!))
      .collect()

    // Apply visibility rules
    tickets = tickets.filter(ticket => 
      ticket.visibility === 'public' ||
      ticket.creatorId === user._id ||
      ticket.assigneeId === user._id
    )

    // Apply filters
    if (args.status && args.status.length > 0) {
      tickets = tickets.filter(ticket => args.status!.includes(ticket.status as any))
    }

    if (args.categoryId) {
      tickets = tickets.filter(ticket => ticket.categoryId === args.categoryId)
    }

    if (args.assigneeId) {
      tickets = tickets.filter(ticket => ticket.assigneeId === args.assigneeId)
    }

    if (args.creatorId) {
      tickets = tickets.filter(ticket => ticket.creatorId === args.creatorId)
    }

    if (args.visibility) {
      tickets = tickets.filter(ticket => ticket.visibility === args.visibility)
    }

    // Date range filter
    if (args.dateFrom || args.dateTo) {
      tickets = tickets.filter(ticket => {
        const ticketDate = ticket._creationTime
        if (args.dateFrom && ticketDate < args.dateFrom) return false
        if (args.dateTo && ticketDate > args.dateTo) return false
        return true
      })
    }

    // Text search
    if (args.searchTerm) {
      const searchLower = args.searchTerm.toLowerCase()
      tickets = tickets.filter(ticket => 
        ticket.title.toLowerCase().includes(searchLower) ||
        ticket.description.toLowerCase().includes(searchLower)
      )
    }

    // TODO: Implement attribute-based filtering
    // This would require joining with ticketAttributes table

    // Sorting
    const sortBy = args.sortBy || "updated"
    const sortOrder = args.sortOrder || "desc"

    tickets.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case "created":
          aValue = a._creationTime
          bValue = b._creationTime
          break
        case "updated":
          aValue = a.lastActivityAt
          bValue = b.lastActivityAt
          break
        case "title":
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case "status":
          // Custom status order: open, in_progress, closed
          const statusOrder: Record<string, number> = { open: 0, in_progress: 1, closed: 2 }
          aValue = statusOrder[a.status] ?? 999 // Stati sconosciuti vanno in fondo
          bValue = statusOrder[b.status] ?? 999
          break
        default:
          aValue = a.lastActivityAt
          bValue = b.lastActivityAt
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    // Pagination
    const offset = args.offset || 0
    const limit = args.limit || 20
    const paginatedTickets = tickets.slice(offset, offset + limit)

    // Enrich with related data
    const enrichedTickets = await Promise.all(
      paginatedTickets.map(async (ticket) => {
        const [creator, assignee, category] = await Promise.all([
          ctx.db.get(ticket.creatorId),
          ticket.assigneeId ? ctx.db.get(ticket.assigneeId) : null,
          ctx.db.get(ticket.categoryId),
        ])

        return {
          ...ticket,
          creator: creator ? {
            _id: creator._id,
            name: creator.name,
            email: creator.email,
          } : null,
          assignee: assignee ? {
            _id: assignee._id,
            name: assignee.name,
            email: assignee.email,
          } : null,
          category: category ? {
            _id: category._id,
            name: category.name,
          } : null,
        }
      })
    )

    return {
      tickets: enrichedTickets,
      total: tickets.length,
      hasMore: tickets.length > offset + limit,
      filters: {
        searchTerm: args.searchTerm,
        status: args.status,
        categoryId: args.categoryId,
        assigneeId: args.assigneeId,
        creatorId: args.creatorId,
        visibility: args.visibility,
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
      },
      sorting: {
        sortBy,
        sortOrder,
      },
      pagination: {
        offset,
        limit,
        total: tickets.length,
      },
    }
  },
})

// Query to get search suggestions
export const getSearchSuggestions = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { searchTerm, limit = 10 }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }
    
    if (!user.clinicId) {
      throw new ConvexError("User has no clinic assigned")
    }

    if (searchTerm.length < 2) {
      return []
    }

    const searchLower = searchTerm.toLowerCase()
    const suggestions: Array<{
      type: 'ticket' | 'category' | 'user'
      id: string
      title: string
      subtitle?: string
    }> = []

    // Search tickets
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId!))
      .collect()

    const accessibleTickets = tickets.filter(ticket => 
      ticket.visibility === 'public' ||
      ticket.creatorId === user._id ||
      ticket.assigneeId === user._id
    )

    const matchingTickets = accessibleTickets
      .filter(ticket => 
        ticket.title.toLowerCase().includes(searchLower) ||
        ticket.description.toLowerCase().includes(searchLower)
      )
      .slice(0, Math.floor(limit / 2))

    suggestions.push(...matchingTickets.map(ticket => ({
      type: 'ticket' as const,
      id: ticket._id,
      title: ticket.title,
      subtitle: `Ticket • ${ticket.status}`,
    })))

    // Search categories
    // 🏢 Ottieni categorie filtrate per società dell'utente (importato in cima)
    const allCategories = await ctx.db
      .query("categories")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    // Filtra categorie per accesso utente (via società)
    const categoriesWithAccess = [];
    for (const category of allCategories) {
      const hasAccess = await userHasAccessToCategory(ctx, user._id, category._id);
      if (hasAccess) {
        categoriesWithAccess.push(category);
      }
    }
    const categories = categoriesWithAccess;

    const matchingCategories = categories
      .filter(category => 
        category.name.toLowerCase().includes(searchLower)
      )
      .slice(0, Math.floor(limit / 4))

    suggestions.push(...matchingCategories.map(category => ({
      type: 'category' as const,
      id: category._id,
      title: category.name,
      subtitle: 'Categoria',
    })))

    // Search users
    const users = await ctx.db
      .query("users")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId!))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

    const matchingUsers = users
      .filter(u => 
        u.name.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower)
      )
      .slice(0, Math.floor(limit / 4))

    suggestions.push(...matchingUsers.map(u => ({
      type: 'user' as const,
      id: u._id,
      title: u.name,
      subtitle: `Utente • ${u.email}`,
    })))

    return suggestions.slice(0, limit)
  },
})

// Optimized query for paginated tickets with cursor-based pagination
export const getPaginatedTickets = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed"))),
    assigneeId: v.optional(v.id("users")),
    categoryId: v.optional(v.id("categories")),
    orderBy: v.optional(v.union(v.literal("createdAt"), v.literal("updatedAt"), v.literal("lastActivityAt"))),
    orderDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }
    
    if (!user.clinicId) {
      throw new ConvexError("User has no clinic assigned")
    }

    const limit = Math.min(args.limit || 20, 100) // Max 100 items per page
    const orderBy = args.orderBy || "lastActivityAt"
    const orderDirection = args.orderDirection || "desc"

    let query = ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId!))

    // Apply filters
    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status))
    }

    if (args.assigneeId) {
      query = query.filter((q) => q.eq(q.field("assigneeId"), args.assigneeId))
    }

    if (args.categoryId) {
      query = query.filter((q) => q.eq(q.field("categoryId"), args.categoryId))
    }

    // Handle cursor pagination
    if (args.cursor) {
      const cursorDoc = await ctx.db.get(args.cursor as any)
      if (cursorDoc) {
        const cursorValue = (cursorDoc as any)[orderBy]
        if (orderDirection === "desc") {
          query = query.filter((q: any) => q.lt(q.field(orderBy as any), cursorValue))
        } else {
          query = query.filter((q: any) => q.gt(q.field(orderBy as any), cursorValue))
        }
      }
    }

    // Note: Ordering is handled by the index and cursor logic above

    const tickets = await query.take(limit + 1) // Take one extra to check if there are more

    const hasMore = tickets.length > limit
    const results = hasMore ? tickets.slice(0, limit) : tickets
    const nextCursor = hasMore ? results[results.length - 1]._id : null

    // Enrich with related data
    const enrichedTickets = await Promise.all(
      results.map(async (ticket) => {
        const [category, assignee, creator] = await Promise.all([
          ticket.categoryId ? ctx.db.get(ticket.categoryId) : null,
          ticket.assigneeId ? ctx.db.get(ticket.assigneeId) : null,
          ctx.db.get((ticket as any).createdBy || ticket.creatorId),
        ])

        return {
          ...ticket,
          category,
          assignee,
          creator,
        }
      })
    )

    return {
      tickets: enrichedTickets,
      hasMore,
      nextCursor,
    }
  },
})

// Optimized query for ticket counts and stats
export const getTicketCounts = query({
  args: {
    groupBy: v.optional(v.union(v.literal("status"), v.literal("category"), v.literal("assignee"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }
    
    if (!user.clinicId) {
      throw new ConvexError("User has no clinic assigned")
    }

    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId!))
      .collect()

    const counts = {
      total: tickets.length,
      open: tickets.filter(t => t.status === "open").length,
      in_progress: tickets.filter(t => t.status === "in_progress").length,
      closed: tickets.filter(t => t.status === "closed").length,
    }

    if (args.groupBy === "category") {
      const categoryGroups = new Map<string, number>()
      tickets.forEach(ticket => {
        const categoryId = ticket.categoryId || "uncategorized"
        categoryGroups.set(categoryId, (categoryGroups.get(categoryId) || 0) + 1)
      })
      return {
        ...counts,
        byCategory: Object.fromEntries(categoryGroups),
      }
    }

    if (args.groupBy === "assignee") {
      const assigneeGroups = new Map<string, number>()
      tickets.forEach(ticket => {
        const assigneeId = ticket.assigneeId || "unassigned"
        assigneeGroups.set(assigneeId, (assigneeGroups.get(assigneeId) || 0) + 1)
      })
      return {
        ...counts,
        byAssignee: Object.fromEntries(assigneeGroups),
      }
    }

    return counts
  },
})

// Optimized query for recent activity
export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }
    
    if (!user.clinicId) {
      throw new ConvexError("User has no clinic assigned")
    }

    const limit = Math.min(args.limit || 10, 50)
    const since = args.since || (Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours

    let query = ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId!))
      .filter((q: any) => q.gte(q.field("lastActivityAt"), since))
      .order("desc")

    const tickets = await query.take(limit)

    // Enrich with basic related data
    const enrichedTickets = await Promise.all(
      tickets.map(async (ticket) => {
        const category = ticket.categoryId ? await ctx.db.get(ticket.categoryId) : null
        return {
          ...ticket,
          category: category ? { _id: category._id, name: category.name } : null,
        }
      })
    )

    return enrichedTickets
  },
})

// Optimized search with full-text capabilities
export const searchTicketsOptimized = query({
  args: {
    query: v.string(),
    filters: v.optional(v.object({
      status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed"))),
      categoryId: v.optional(v.id("categories")),
      assigneeId: v.optional(v.id("users")),
      dateFrom: v.optional(v.number()),
      dateTo: v.optional(v.number()),
    })),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }
    
    if (!user.clinicId) {
      throw new ConvexError("User has no clinic assigned")
    }

    const searchTerms = args.query.toLowerCase().split(' ').filter(term => term.length > 0)
    const limit = Math.min(args.limit || 20, 100)
    const offset = args.offset || 0

    let query = ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId!))

    // Apply basic filters first for better performance
    if (args.filters?.status) {
      query = query.filter((q: any) => q.eq(q.field("status"), args.filters!.status))
    }

    if (args.filters?.categoryId) {
      query = query.filter((q: any) => q.eq(q.field("categoryId"), args.filters!.categoryId))
    }

    if (args.filters?.assigneeId) {
      query = query.filter((q: any) => q.eq(q.field("assigneeId"), args.filters!.assigneeId))
    }

    if (args.filters?.dateFrom) {
      query = query.filter((q: any) => q.gte(q.field("_creationTime"), args.filters!.dateFrom))
    }

    if (args.filters?.dateTo) {
      query = query.filter((q: any) => q.lte(q.field("_creationTime"), args.filters!.dateTo))
    }

    const allTickets = await query.collect()

    // Apply text search
    const matchedTickets = allTickets.filter(ticket => {
      const searchableText = [
        ticket.title,
        ticket.description,
      ].join(' ').toLowerCase()

      return searchTerms.every(term => searchableText.includes(term))
    })

    // Apply pagination
    const paginatedTickets = matchedTickets.slice(offset, offset + limit)

    // Enrich with related data
    const enrichedTickets = await Promise.all(
      paginatedTickets.map(async (ticket) => {
        const [category, assignee] = await Promise.all([
          ticket.categoryId ? ctx.db.get(ticket.categoryId) : null,
          ticket.assigneeId ? ctx.db.get(ticket.assigneeId) : null,
        ])

        return {
          ...ticket,
          category,
          assignee,
        }
      })
    )

    return {
      tickets: enrichedTickets,
      total: matchedTickets.length,
      hasMore: offset + limit < matchedTickets.length,
    }
  },
})

// Query per trovare un ticket tramite numero incrementale
export const getByTicketNumber = query({
  args: {
    ticketNumber: v.number(),
    clinicId: v.optional(v.id("clinics")), // Se non specificato, usa clinica dell'utente
    userEmail: v.string(),
  },
  handler: async (ctx, { ticketNumber, clinicId, userEmail }) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato nel sistema")
    }

    const targetClinicId = clinicId || user.clinicId
    

    const ticket = await ctx.db
      .query("tickets")
      .withIndex("by_clinic_ticket_number", (q) => 
        q.eq("clinicId", targetClinicId!).eq("ticketNumber", ticketNumber)
      )
      .first()

    if (!ticket) {
      return null
    }

    // Arricchisci con categoria e assegnatario
    const [category, assignee] = await Promise.all([
      ctx.db.get(ticket.categoryId),
      ticket.assigneeId ? ctx.db.get(ticket.assigneeId) : null,
    ])


    return {
      ...ticket,
      category,
      assignee,
    }
  },
})

// Migration: Aggiunta ticketNumber GLOBALI ai ticket esistenti
export const addTicketNumbersToExistingTickets = internalMutation({
  args: {},
  handler: async (ctx) => {
    
    // Trova tutti i ticket senza ticketNumber
    const allTickets = await ctx.db.query("tickets").collect()
    const ticketsWithoutNumber = allTickets.filter(ticket => !ticket.ticketNumber)
    
    
    if (ticketsWithoutNumber.length === 0) {
      return { message: "Nessun ticket da aggiornare", updated: 0 }
    }
    
    // Ordina TUTTI i ticket per data di creazione per numerazione GLOBALE cronologica
    const sortedTickets = ticketsWithoutNumber.sort((a, b) => a._creationTime - b._creationTime)
    
    let globalTicketNumber = 1
    let totalUpdated = 0
    
    // Assegna numeri sequenziali GLOBALI a tutti i ticket
    for (const ticket of sortedTickets) {
      // Aggiorna il ticket con il numero globale
      await ctx.db.patch(ticket._id, {
        ticketNumber: globalTicketNumber
      })
      
      globalTicketNumber++
      totalUpdated++
    }
    
    // Rimuovi tutti i contatori per-clinica vecchi
    const oldCounters = await ctx.db
      .query("counters")
      .filter((q) => q.eq(q.field("name"), "tickets") && q.neq(q.field("clinicId"), undefined))
      .collect()
    
    for (const oldCounter of oldCounters) {
      await ctx.db.delete(oldCounter._id)
    }
    
    // Crea/aggiorna il contatore GLOBALE unico
    let globalCounter = await ctx.db
      .query("counters")
      .filter((q) => q.eq(q.field("name"), "tickets") && q.eq(q.field("clinicId"), undefined))
      .first()
    
    if (!globalCounter) {
      await ctx.db.insert("counters", {
        name: "tickets",
        clinicId: undefined as any, // Contatore globale
        currentValue: globalTicketNumber - 1, // L'ultimo numero usato
      })
    } else {
      await ctx.db.patch(globalCounter._id, {
        currentValue: globalTicketNumber - 1,
      })
    }
    
    
    return { 
      message: `Migration GLOBALE completata! ${totalUpdated} ticket con numeri globali unici`, 
      updated: totalUpdated 
    }
  },
})

// Funzione per resettare e rifare la migration GLOBALE
export const resetAndMigrateToGlobalNumbers: any = mutation({
  args: {},
  handler: async (ctx): Promise<any> => {
    
    // STEP 1: Rimuovi ticketNumber da tutti i ticket
    const allTickets = await ctx.db.query("tickets").collect()
    for (const ticket of allTickets) {
      if (ticket.ticketNumber) {
        await ctx.db.patch(ticket._id, {
          ticketNumber: undefined as any
        })
      }
    }
    
    // STEP 2: Rimuovi tutti i contatori esistenti
    const allCounters = await ctx.db.query("counters").collect()
    for (const counter of allCounters) {
      await ctx.db.delete(counter._id)
    }
    
    // STEP 3: Esegui la migration globale
    const result: any = await ctx.runMutation(internal.tickets.addTicketNumbersToExistingTickets, {})
    
    return result
  },
})

// Funzione pubblica per eseguire la migration (solo per admin)
export const runTicketNumberMigration: any = mutation({
  args: {},
  handler: async (ctx): Promise<any> => {
    // Per ora nessun controllo admin, poi aggiungeremo
    
    const result: any = await ctx.runMutation(internal.tickets.addTicketNumbersToExistingTickets, {})
    
    return result
  },
})

// Mutation per aggiornare la priorità di un ticket (solo agenti/admin)
export const updatePriority = mutation({
  args: {
    ticketId: v.id("tickets"),
    priority: v.number(),
    userEmail: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Validazione priorità
    if (args.priority < 1 || args.priority > 5) {
      throw new ConvexError("Priorità non valida. Deve essere tra 1 e 5.");
    }

    // Verifica autenticazione
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Non autenticato");
    }

    // Ottieni utente
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("Utente non trovato");
    }

    // Verifica che l'utente sia agente o admin
    const role = await ctx.db.get(user.roleId);
    if (!role) {
      throw new ConvexError("Ruolo utente non trovato");
    }

    const canModifyPriority = role.permissions.includes("manage_all_tickets") || 
                               role.permissions.includes("assign_tickets");
    
    if (!canModifyPriority) {
      throw new ConvexError("Solo agenti e amministratori possono modificare la priorità");
    }

    // Ottieni ticket
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new ConvexError("Ticket non trovato");
    }

    // Aggiorna priorità
    await ctx.db.patch(args.ticketId, {
      priority: args.priority,
      lastActivityAt: Date.now(),
    });

    return {
      success: true,
      message: `Priorità aggiornata a ${args.priority}`,
    };
  },
})
