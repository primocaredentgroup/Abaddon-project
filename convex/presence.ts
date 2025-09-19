import { v } from "convex/values"
import { mutation, query, internalMutation } from "./_generated/server"
import { ConvexError } from "convex/values"

// Add presence table to schema if not already defined
// This would need to be added to schema.ts:
/*
presence: defineTable({
  userId: v.id("users"),
  ticketId: v.optional(v.id("tickets")),
  lastSeen: v.number(),
  isActive: v.boolean(),
  sessionId: v.string(),
})
  .index("by_user", ["userId"])
  .index("by_ticket", ["ticketId"])
  .index("by_user_ticket", ["userId", "ticketId"])
  .index("by_active", ["isActive"])
  .index("by_last_seen", ["lastSeen"]),
*/

// Mutation to update user presence
export const updatePresence = mutation({
  args: {
    ticketId: v.optional(v.id("tickets")),
    isActive: v.boolean(),
    sessionId: v.optional(v.string()),
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

    const sessionId = args.sessionId || `${user._id}-${Date.now()}`
    const now = Date.now()

    // Find existing presence record
    let presenceQuery = ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", user._id))

    if (args.ticketId) {
      presenceQuery = presenceQuery.filter(q => q.eq(q.field("ticketId"), args.ticketId))
    } else {
      presenceQuery = presenceQuery.filter(q => q.eq(q.field("ticketId"), undefined))
    }

    const existingPresence = await presenceQuery.first()

    if (existingPresence) {
      // Update existing presence
      await ctx.db.patch(existingPresence._id, {
        lastSeen: now,
        isActive: args.isActive,
        sessionId,
      })
      return existingPresence._id
    } else {
      // Create new presence record
      return await ctx.db.insert("presence", {
        userId: user._id,
        ticketId: args.ticketId,
        lastSeen: now,
        isActive: args.isActive,
        sessionId,
      })
    }
  },
})

// Query to get active users for a ticket
export const getActiveUsers = query({
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

    // Verify ticket access
    const ticket = await ctx.db.get(ticketId)
    if (!ticket) {
      throw new ConvexError("Ticket not found")
    }

    const hasAccess = 
      ticket.clinicId === user.clinicId && (
        ticket.visibility === 'public' ||
        ticket.creatorId === user._id ||
        ticket.assigneeId === user._id
      )

    if (!hasAccess) {
      throw new ConvexError("Access denied")
    }

    // Get active presence records for this ticket
    const activeThreshold = Date.now() - 5 * 60 * 1000 // 5 minutes
    
    const presenceRecords = await ctx.db
      .query("presence")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .filter(q => 
        q.and(
          q.eq(q.field("isActive"), true),
          q.gt(q.field("lastSeen"), activeThreshold)
        )
      )
      .collect()

    // Enrich with user information
    const activeUsers = await Promise.all(
      presenceRecords.map(async (presence) => {
        const presenceUser = await ctx.db.get(presence.userId)
        return {
          _id: presenceUser?._id,
          name: presenceUser?.name,
          email: presenceUser?.email,
          lastSeen: presence.lastSeen,
          isActive: presence.isActive,
        }
      })
    )

    return activeUsers.filter(u => u._id) // Filter out null users
  },
})

// Query to get general active users in clinic
export const getActiveUsersInClinic = query({
  args: {
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

    // Get all users in the same clinic
    const clinicUsers = await ctx.db
      .query("users")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))
      .collect()

    const clinicUserIds = new Set(clinicUsers.map(u => u._id))
    
    // Get active presence records
    const activeThreshold = Date.now() - 10 * 60 * 1000 // 10 minutes for general presence
    
    const presenceRecords = await ctx.db
      .query("presence")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter(q => q.gt(q.field("lastSeen"), activeThreshold))
      .collect()

    // Filter to clinic users and get most recent presence per user
    const userPresenceMap = new Map()
    
    presenceRecords.forEach(presence => {
      if (clinicUserIds.has(presence.userId)) {
        const existing = userPresenceMap.get(presence.userId)
        if (!existing || presence.lastSeen > existing.lastSeen) {
          userPresenceMap.set(presence.userId, presence)
        }
      }
    })

    // Enrich with user information
    const activeUsers = await Promise.all(
      Array.from(userPresenceMap.values()).map(async (presence) => {
        const presenceUser = await ctx.db.get(presence.userId)
        return {
          _id: presenceUser?._id,
          name: presenceUser?.name,
          email: presenceUser?.email,
          lastSeen: presence.lastSeen,
          isActive: presence.isActive,
          currentTicket: presence.ticketId,
        }
      })
    )

    const validUsers = activeUsers.filter(u => u._id)
    
    // Sort by last seen (most recent first)
    validUsers.sort((a, b) => b.lastSeen - a.lastSeen)

    const limit = args.limit || 20
    return validUsers.slice(0, limit)
  },
})

// Internal mutation to cleanup old presence records
export const cleanupPresence = internalMutation({
  args: {
    olderThanMinutes: v.number(),
  },
  handler: async (ctx, { olderThanMinutes }) => {
    const cutoffTime = Date.now() - (olderThanMinutes * 60 * 1000)
    
    const oldRecords = await ctx.db
      .query("presence")
      .withIndex("by_last_seen", (q) => q.lt("lastSeen", cutoffTime))
      .collect()

    let deletedCount = 0
    for (const record of oldRecords) {
      await ctx.db.delete(record._id)
      deletedCount++
    }

    return { deletedCount }
  },
})

// Query to get presence statistics
export const getPresenceStats = query({
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

    // Get all users in clinic
    const clinicUsers = await ctx.db
      .query("users")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))
      .collect()

    const totalUsers = clinicUsers.length
    
    // Get active users (last 10 minutes)
    const activeThreshold = Date.now() - 10 * 60 * 1000
    const activePresence = await ctx.db
      .query("presence")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter(q => q.gt(q.field("lastSeen"), activeThreshold))
      .collect()

    const clinicUserIds = new Set(clinicUsers.map(u => u._id))
    const activeUsers = activePresence.filter(p => clinicUserIds.has(p.userId))
    
    // Get unique active users
    const uniqueActiveUsers = new Set(activeUsers.map(p => p.userId))

    return {
      totalUsers,
      activeUsers: uniqueActiveUsers.size,
      onlinePercentage: totalUsers > 0 ? Math.round((uniqueActiveUsers.size / totalUsers) * 100) : 0,
    }
  },
})


