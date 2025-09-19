import { v } from "convex/values"
import { mutation, query, internalMutation } from "./_generated/server"
import { ConvexError } from "convex/values"
import { internal } from "./_generated/api"

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

// Query to get a single ticket by ID
export const getById = query({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, { ticketId }) => {
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
    if (!ticket) {
      throw new ConvexError("Ticket not found")
    }

    // Check access permissions
    const hasAccess = 
      ticket.clinicId === user.clinicId && (
        ticket.visibility === 'public' ||
        ticket.creatorId === user._id ||
        ticket.assigneeId === user._id
        // TODO: Add role-based access check for agents/admins
      )

    if (!hasAccess) {
      throw new ConvexError("Access denied")
    }

    // Enrich with related data
    const [creator, assignee, category] = await Promise.all([
      ctx.db.get(ticket.creatorId),
      ticket.assigneeId ? ctx.db.get(ticket.assigneeId) : null,
      ctx.db.get(ticket.categoryId),
    ])

    return {
      ...ticket,
      creator,
      assignee,
      category,
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
    
    if (visibility === 'public' && !clinic?.settings?.allowPublicTickets) {
      throw new ConvexError("Public tickets are not allowed in this clinic")
    }

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
    const ticketId = await ctx.db.insert("tickets", {
      title: args.title.trim(),
      description: args.description.trim(),
      status: "open",
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

// Mutation to update ticket basic information
export const update = mutation({
  args: {
    ticketId: v.id("tickets"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("closed"))),
    assigneeId: v.optional(v.id("users")),
    attributes: v.optional(v.any()),
  },
  handler: async (ctx, { ticketId, ...updates }) => {
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

    // Check permissions for different operations
    const canEditBasicInfo = ticket.creatorId === user._id || ticket.status !== 'closed'
    const canManageTicket = ticket.assigneeId === user._id // TODO: Add role-based check for agents/admins

    if ((updates.title || updates.description) && !canEditBasicInfo) {
      throw new ConvexError("Cannot edit closed tickets or tickets you don't own")
    }

    if ((updates.status || updates.assigneeId) && !canManageTicket) {
      throw new ConvexError("Insufficient permissions to manage this ticket")
    }

    // Validate assignee if provided
    if (updates.assigneeId) {
      const assignee = await ctx.db.get(updates.assigneeId)
      if (!assignee || assignee.clinicId !== user.clinicId) {
        throw new ConvexError("Invalid assignee")
      }
      // TODO: Add role validation for assignee (must be agent or admin)
    }

    // Prepare update data
    const updateData: any = {
      ...updates,
      lastActivityAt: Date.now(),
    }

    // Clean up string fields
    if (updateData.title) {
      updateData.title = updateData.title.trim()
    }
    if (updateData.description) {
      updateData.description = updateData.description.trim()
    }

    // Update the ticket
    await ctx.db.patch(ticketId, updateData)

    // Update attributes if provided
    if (updates.attributes) {
      // Note: setTicketAttributes is not exported as internal, so we'll handle attributes differently
      // For now, we'll skip updating attributes in the update mutation
      console.log("Attributes provided but not yet implemented for internal mutations")
    }

    // Log the changes
    const changes: any = {}
    Object.keys(updates).forEach(key => {
      if ((updates as any)[key] !== undefined) {
        changes[key] = {
          from: (ticket as any)[key],
          to: (updates as any)[key],
        }
      }
    })

    await ctx.runMutation(internal.auditLogs.log, {
      entityType: "ticket",
      entityId: ticketId,
      action: "updated",
      changes,
    })

    return ticketId
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
      tickets = tickets.filter(ticket => args.status!.includes(ticket.status))
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
          const statusOrder = { open: 0, in_progress: 1, closed: 2 }
          aValue = statusOrder[a.status]
          bValue = statusOrder[b.status]
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
