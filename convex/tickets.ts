import { v } from "convex/values"
import { mutation, query, internalMutation, internalQuery } from "./_generated/server"
import { ConvexError } from "convex/values"
// import { getCurrentUser } from "./lib/utils" // Non usato al momento
import { internal } from "./_generated/api"
import { canManageAllTickets } from "./lib/permissions"

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

    let query = ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))

    // Apply filters
    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status))
    }

    if (args.assigneeId) {
      query = query.filter((q) => q.eq(q.field("assigneeId"), args.assigneeId))
    }

    if (args.creatorId) {
      query = query.filter((q) => q.eq(q.field("creatorId"), args.creatorId))
    }

    if (args.categoryId) {
      query = query.filter((q) => q.eq(q.field("categoryId"), args.categoryId))
    }

    if (args.visibility) {
      query = query.filter((q) => q.eq(q.field("visibility"), args.visibility))
    }

    let tickets = await query.collect()

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
    console.log(`🔍 getById chiamata per ticket ${id}`)
    
    const ticket = await ctx.db.get(id)
    if (!ticket) {
      console.log(`❌ Ticket ${id} non trovato`)
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

    // Verifica permessi
    const canView = 
      ticket.creatorId === user._id || 
      ticket.assigneeId === user._id ||
      ticket.clinicId === user.clinicId ||
      ticket.visibility === 'public'

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
    
    console.log(`✅ Ticket ${id} trovato: ${ticket.title}`)
    return result
  },
})

// Query per ottenere TUTTI i ticket da risolvere per agenti (con evidenziati i sollecitati)
export const getNudgedTickets = query({
  args: {
    userEmail: v.optional(v.string()), // Per test temporaneo
  },
  handler: async (ctx, { userEmail }) => {
    console.log('🔔 getNudgedTickets chiamata per agenti')
    
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
    console.log(`✅ Trovati ${ticketsWithDetails.length} ticket da risolvere (${nudgedCount} sollecitati)`)
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
    console.log(`🔄 update chiamata per ticket ${args.id}:`, args)
    
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

    console.log(`✅ Ticket ${args.id} aggiornato`)
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
    console.log(`👤 changeAssignee chiamata per ticket ${args.ticketId}, nuovo assegnatario: ${args.newAssigneeId}`)
    
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
    console.log(`✅ Ticket ${args.ticketId} ${actionText}`)
    
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

    // Verify category exists and user has access
    const category = await ctx.db.get(args.categoryId)
    if (!category || category.clinicId !== user.clinicId) {
      throw new ConvexError("Category not found or access denied")
    }

    // Get clinic settings to check if public tickets are allowed
    const clinic = await ctx.db.get(user.clinicId)
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
      clinicId: user.clinicId,
      creatorId: user._id,
      visibility,
      lastActivityAt: now,
      attributeCount: 0, // Will be updated when attributes are added
    })

    // Save attributes if provided
    if (args.attributes && Object.keys(args.attributes).length > 0) {
      // Note: setTicketAttributes is not exported as internal, so we'll handle attributes differently
      // For now, we'll skip setting attributes in the create mutation
      console.log("Attributes provided but not yet implemented for internal mutations")
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
    attributes: v.optional(v.any()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    userEmail: v.string(),
  },
  handler: async (ctx, args): Promise<{ ticketId: any, ticketNumber: number }> => {
    console.log('🎫 createWithAuth chiamata con:', args)
    
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato nel sistema")
    }
    
    console.log('👤 Utente trovato:', { id: user._id, email: user.email, clinic: user.clinicId })

    // Verify category exists
    const category = await ctx.db.get(args.categoryId)
    if (!category) {
      throw new ConvexError("Categoria non trovata")
    }
    
    console.log('📂 Categoria trovata:', { id: category._id, name: category.name })

    // Ottieni il prossimo numero ticket GLOBALE
    const ticketNumber: any = await ctx.runMutation(internal.counters.getNextNumber, {
      counterName: "tickets"
    })
    
    console.log('🔢 Numero ticket assegnato:', ticketNumber)

    // Get clinic settings to check if public tickets are allowed
    const clinic = await ctx.db.get(user.clinicId)
    const visibility = args.visibility || 'private'
    
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
      clinicId: user.clinicId,
      creatorId: user._id,
      visibility: 'private', // Per ora tutti i ticket sono privati
      lastActivityAt: now,
      attributeCount: 0,
    })

    console.log('✅ Ticket creato con ID:', ticketId, 'numero:', ticketNumber)

    // 🎯 ESEGUI I TRIGGER ATTIVI DELLA CLINICA
    const triggers = await ctx.db
      .query("triggers")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

    console.log(`🔍 Trovati ${triggers.length} trigger attivi per la clinica ${user.clinicId}`)

    for (const trigger of triggers) {
      console.log(`🎯 Valutazione trigger: ${trigger.name}`, trigger.conditions)
      
      let conditionMet = false

      // Valuta le condizioni
      if (trigger.conditions.type === 'category_match') {
        // Confronta con lo slug della categoria
        const categorySlug = category.slug
        conditionMet = categorySlug === trigger.conditions.value
        console.log(`  ↳ Categoria match? ${categorySlug} === ${trigger.conditions.value} = ${conditionMet}`)
      } else if (trigger.conditions.type === 'status_change') {
        // Confronta con lo status del ticket (sempre "open" alla creazione)
        conditionMet = 'open' === trigger.conditions.value
        console.log(`  ↳ Status match? open === ${trigger.conditions.value} = ${conditionMet}`)
      }

      // Se la condizione è soddisfatta, esegui le azioni
      if (conditionMet) {
        console.log(`✅ Condizione soddisfatta! Eseguo azione: ${trigger.actions.type}`)

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
            console.log(`  ↳ Ticket assegnato a ${assigneeUser.email}`)
          } else {
            console.warn(`  ⚠️ Utente ${trigger.actions.value} non trovato`)
          }
        } else if (trigger.actions.type === 'change_status') {
          // Cambia lo status del ticket
          await ctx.db.patch(ticketId, { 
            status: trigger.actions.value,
            lastActivityAt: Date.now()
          })
          console.log(`  ↳ Status cambiato in ${trigger.actions.value}`)
        }
      } else {
        console.log(`❌ Condizione NON soddisfatta, salto trigger`)
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
    console.log('📋 getMyCreatedWithAuth chiamata con:', args)
    
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato nel sistema")
    }
    
    console.log('👤 Utente trovato per query ticket:', { id: user._id, email: user.email })

    // UTENTE: vede solo i ticket che ha creato LUI
    let query = ctx.db
      .query("tickets")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status))
    }

    const tickets = await query.collect()
    
    console.log(`📊 Trovati ${tickets.length} ticket creati dall'utente ${user.email}`)
    
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
    console.log('🏥 getMyClinicTicketsWithAuth chiamata con:', args)
    
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()
    
    if (!user) return []

    // Ottieni tutte le cliniche dell'utente dalla nuova tabella userClinics
    const userClinics = await ctx.db
      .query("userClinics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

    if (userClinics.length === 0) {
      // Fallback: usa la clinica principale per backward compatibility
      const clinicIds = [user.clinicId]
      console.log(`🔄 Fallback: usando clinica principale ${user.clinicId}`)
    } else {
      const clinicIds = userClinics.map(uc => uc.clinicId)
      console.log(`🏥 Utente ha accesso a ${clinicIds.length} cliniche:`, clinicIds)
    }

    const clinicIds = userClinics.length > 0 
      ? userClinics.map(uc => uc.clinicId)
      : [user.clinicId] // Fallback

    // Ottieni tutti i ticket delle cliniche dell'utente
    const allTickets = await ctx.db.query("tickets").collect()
    let relevantTickets = allTickets.filter(ticket => 
      clinicIds.includes(ticket.clinicId)
    )

    // 🆕 Filtra per mostrare SOLO ticket pubblici (i privati vanno in "I miei ticket")
    relevantTickets = relevantTickets.filter(ticket => ticket.visibility === 'public')

    // Filtra per status se specificato
    if (args.status) {
      relevantTickets = relevantTickets.filter(ticket => ticket.status === args.status)
    }

    console.log(`📊 Trovati ${relevantTickets.length} ticket pubblici nelle cliniche dell'utente`)

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
    console.log('🎯 getMyAssignedTicketsWithAuth chiamata con:', args)
    
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
    
    console.log(`🎯 Trovati ${tickets.length} ticket assegnati all'agente ${user.email}`)

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

    // Start with clinic-based query
    let query = ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", args.clinicId || user.clinicId))

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
    console.log('🙋 assignToMe chiamata per ticket:', ticketId, 'da utente:', userEmail)

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
      console.log('⚠️ Ticket già assegnato a questo utente')
      return { success: true, alreadyAssigned: true }
    }

    // Assegna il ticket all'utente
    await ctx.db.patch(ticketId, {
      assigneeId: user._id,
      lastActivityAt: Date.now(),
    })

    console.log('✅ Ticket assegnato con successo a:', userEmail)

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

    // Get all tickets for the clinic
    const allTickets = await ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))
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

    // Start with clinic-based query
    let tickets = await ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))
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
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))
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
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

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
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))
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

    const limit = Math.min(args.limit || 20, 100) // Max 100 items per page
    const orderBy = args.orderBy || "lastActivityAt"
    const orderDirection = args.orderDirection || "desc"

    let query = ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))

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

    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))
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

    const limit = Math.min(args.limit || 10, 50)
    const since = args.since || (Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours

    let query = ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))
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

    const searchTerms = args.query.toLowerCase().split(' ').filter(term => term.length > 0)
    const limit = Math.min(args.limit || 20, 100)
    const offset = args.offset || 0

    let query = ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))

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
    
    console.log(`🔍 Cercando ticket #${ticketNumber} nella clinica ${targetClinicId}`)

    const ticket = await ctx.db
      .query("tickets")
      .withIndex("by_clinic_ticket_number", (q) => 
        q.eq("clinicId", targetClinicId).eq("ticketNumber", ticketNumber)
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

    console.log(`✅ Ticket #${ticketNumber} trovato:`, { id: ticket._id, title: ticket.title })

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
    console.log('🔧 Inizio migration: aggiunta ticketNumber GLOBALI ai ticket esistenti...')
    
    // Trova tutti i ticket senza ticketNumber
    const allTickets = await ctx.db.query("tickets").collect()
    const ticketsWithoutNumber = allTickets.filter(ticket => !ticket.ticketNumber)
    
    console.log(`📊 Trovati ${ticketsWithoutNumber.length} ticket da aggiornare`)
    
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
      
      console.log(`✅ Ticket ${ticket._id} aggiornato con numero GLOBALE #${globalTicketNumber}`)
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
      console.log(`🗑️ Rimosso contatore per-clinica obsoleto: ${oldCounter.clinicId}`)
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
      console.log(`📝 Contatore GLOBALE creato con valore: ${globalTicketNumber - 1}`)
    } else {
      await ctx.db.patch(globalCounter._id, {
        currentValue: globalTicketNumber - 1,
      })
      console.log(`🔄 Contatore GLOBALE aggiornato a: ${globalTicketNumber - 1}`)
    }
    
    console.log(`✅ Migration GLOBALE completata! ${totalUpdated} ticket con numeri globali`)
    
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
    console.log('🔄 RESET e migration verso numeri GLOBALI...')
    
    // STEP 1: Rimuovi ticketNumber da tutti i ticket
    const allTickets = await ctx.db.query("tickets").collect()
    for (const ticket of allTickets) {
      if (ticket.ticketNumber) {
        await ctx.db.patch(ticket._id, {
          ticketNumber: undefined as any
        })
      }
    }
    console.log(`🗑️ Rimossi ticketNumber da ${allTickets.length} ticket`)
    
    // STEP 2: Rimuovi tutti i contatori esistenti
    const allCounters = await ctx.db.query("counters").collect()
    for (const counter of allCounters) {
      await ctx.db.delete(counter._id)
    }
    console.log(`🗑️ Rimossi ${allCounters.length} contatori esistenti`)
    
    // STEP 3: Esegui la migration globale
    const result: any = await ctx.runMutation(internal.tickets.addTicketNumbersToExistingTickets, {})
    
    console.log('✅ Reset e migration GLOBALE completata!')
    return result
  },
})

// Funzione pubblica per eseguire la migration (solo per admin)
export const runTicketNumberMigration: any = mutation({
  args: {},
  handler: async (ctx): Promise<any> => {
    // Per ora nessun controllo admin, poi aggiungeremo
    console.log('🚀 Avvio migration ticket numbers via API...')
    
    const result: any = await ctx.runMutation(internal.tickets.addTicketNumbersToExistingTickets, {})
    
    return result
  },
})
