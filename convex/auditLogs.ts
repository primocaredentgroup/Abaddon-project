import { v } from "convex/values"
import { mutation, query, internalMutation } from "./_generated/server"
import { ConvexError } from "convex/values"

// Internal mutation to create audit log entries
export const log = internalMutation({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
    changes: v.any(),
    metadata: v.optional(v.any()),
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

    return await ctx.db.insert("auditLogs", {
      ...args,
      userId: user._id,
    })
  },
})

// Query to get audit logs for an entity
export const getByEntity = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
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

    // For tickets, verify access to the entity
    if (args.entityType === "ticket") {
      const ticket = await ctx.db.get(args.entityId as any)
      if (!ticket || ('clinicId' in ticket && ticket.clinicId !== user.clinicId)) {
        throw new ConvexError("Access denied")
      }

      // Check visibility rules for tickets
      const hasAccess = 
        'visibility' in ticket && ticket.visibility === 'public' ||
        'creatorId' in ticket && ticket.creatorId === user._id ||
        'assigneeId' in ticket && ticket.assigneeId === user._id

      if (!hasAccess) {
        throw new ConvexError("Access denied")
      }
    }

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) => 
        q.eq("entityType", args.entityType).eq("entityId", args.entityId)
      )
      .collect()

    // Sort by creation time (most recent first)
    logs.sort((a, b) => b._creationTime - a._creationTime)

    // Apply pagination
    const offset = args.offset || 0
    const limit = args.limit || 50
    const paginatedLogs = logs.slice(offset, offset + limit)

    // Enrich with user information
    const enrichedLogs = await Promise.all(
      paginatedLogs.map(async (log) => {
        const logUser = await ctx.db.get(log.userId)
        return {
          ...log,
          user: logUser ? {
            _id: logUser._id,
            name: logUser.name,
            email: logUser.email,
          } : null,
        }
      })
    )

    return {
      logs: enrichedLogs,
      total: logs.length,
      hasMore: logs.length > offset + limit,
    }
  },
})

// Query to get recent audit logs for a user's clinic
export const getRecentByClinic = query({
  args: {
    limit: v.optional(v.number()),
    entityType: v.optional(v.string()),
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

    // TODO: Add role-based access control (only admins/agents should see all logs)

    let logs = await ctx.db
      .query("auditLogs")
      .collect()

    // Filter logs based on entity access
    const accessibleLogs = []
    
    for (const log of logs) {
      let hasAccess = false

      if (log.entityType === "ticket") {
        const ticket = await ctx.db.get(log.entityId as any)
        if (ticket && 'clinicId' in ticket && ticket.clinicId === user.clinicId) {
          hasAccess = 
            'visibility' in ticket && ticket.visibility === 'public' ||
            'creatorId' in ticket && ticket.creatorId === user._id ||
            'assigneeId' in ticket && ticket.assigneeId === user._id
        }
      } else if (log.entityType === "category" || log.entityType === "user") {
        // For other entity types, check if user has clinic access
        hasAccess = true // TODO: Implement proper access control
      }

      if (hasAccess) {
        accessibleLogs.push(log)
      }
    }

    // Filter by entity type if specified
    const filteredLogs = args.entityType 
      ? accessibleLogs.filter(log => log.entityType === args.entityType)
      : accessibleLogs

    // Sort by creation time (most recent first)
    filteredLogs.sort((a, b) => b._creationTime - a._creationTime)

    // Apply limit
    const limit = args.limit || 20
    const limitedLogs = filteredLogs.slice(0, limit)

    // Enrich with user and entity information
    const enrichedLogs = await Promise.all(
      limitedLogs.map(async (log) => {
        const [logUser, entity] = await Promise.all([
          ctx.db.get(log.userId),
          log.entityType === "ticket" ? ctx.db.get(log.entityId as any) : null,
        ])

        return {
          ...log,
          user: logUser ? {
            _id: logUser._id,
            name: logUser.name,
            email: logUser.email,
          } : null,
          entity: entity && 'title' in entity ? {
            _id: entity._id,
            title: entity.title,
          } : null,
        }
      })
    )

    return enrichedLogs
  },
})

// Query to get audit log statistics
export const getStats = query({
  args: {
    entityType: v.optional(v.string()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
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

    // TODO: Add role-based access control

    let logs = await ctx.db.query("auditLogs").collect()

    // Filter by date range if specified
    if (args.dateFrom || args.dateTo) {
      logs = logs.filter(log => {
        const logTime = log._creationTime
        if (args.dateFrom && logTime < args.dateFrom) return false
        if (args.dateTo && logTime > args.dateTo) return false
        return true
      })
    }

    // Filter by entity type if specified
    if (args.entityType) {
      logs = logs.filter(log => log.entityType === args.entityType)
    }

    // Calculate statistics
    const stats = {
      total: logs.length,
      byAction: {} as Record<string, number>,
      byEntityType: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
    }

    // Count by action
    logs.forEach(log => {
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1
      stats.byEntityType[log.entityType] = (stats.byEntityType[log.entityType] || 0) + 1
      stats.byUser[log.userId] = (stats.byUser[log.userId] || 0) + 1
    })

    return stats
  },
})

// Mutation to bulk delete old audit logs (admin only)
export const cleanup = mutation({
  args: {
    olderThanDays: v.number(),
    entityType: v.optional(v.string()),
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

    // TODO: Add admin role check
    // if (!user.isAdmin) {
    //   throw new ConvexError("Admin access required")
    // }

    const cutoffTime = Date.now() - (args.olderThanDays * 24 * 60 * 60 * 1000)

    let logsToDelete = await ctx.db
      .query("auditLogs")
      .filter((q) => q.lt(q.field("_creationTime"), cutoffTime))
      .collect()

    if (args.entityType) {
      logsToDelete = logsToDelete.filter(log => log.entityType === args.entityType)
    }

    // Delete logs in batches
    let deletedCount = 0
    for (const log of logsToDelete) {
      await ctx.db.delete(log._id)
      deletedCount++
    }

    return { deletedCount }
  },
})
