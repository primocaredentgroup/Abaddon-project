import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"

// Query to get comments for a ticket
export const getByTicket = query({
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

    // Check access permissions
    const hasAccess = 
      ticket.clinicId === user.clinicId && (
        ticket.visibility === 'public' ||
        ticket.creatorId === user._id ||
        ticket.assigneeId === user._id
      )

    if (!hasAccess) {
      throw new ConvexError("Access denied")
    }

    // Get comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .collect()

    // Enrich with author information
    const enrichedComments = await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId)
        return {
          ...comment,
          author: author ? {
            _id: author._id,
            name: author.name,
            email: author.email,
          } : null,
        }
      })
    )

    // Sort by creation time (oldest first for chat-like experience)
    return enrichedComments.sort((a, b) => a._creationTime - b._creationTime)
  },
})

// Mutation to create a new comment
export const create = mutation({
  args: {
    ticketId: v.id("tickets"),
    content: v.string(),
    isInternal: v.boolean(),
    attachments: v.optional(v.array(v.string())),
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

    // Verify ticket access
    const ticket = await ctx.db.get(args.ticketId)
    if (!ticket) {
      throw new ConvexError("Ticket not found")
    }

    // Check access permissions
    const hasAccess = 
      ticket.clinicId === user.clinicId && (
        ticket.visibility === 'public' ||
        ticket.creatorId === user._id ||
        ticket.assigneeId === user._id
      )

    if (!hasAccess) {
      throw new ConvexError("Access denied")
    }

    // Check if ticket is closed
    if (ticket.status === 'closed') {
      throw new ConvexError("Cannot add comments to closed tickets")
    }

    // Create the comment
    const commentId = await ctx.db.insert("comments", {
      ticketId: args.ticketId,
      authorId: user._id,
      content: args.content.trim(),
      isInternal: args.isInternal,
      attachments: args.attachments || [],
    })

    // Update ticket's last activity
    await ctx.db.patch(args.ticketId, {
      lastActivityAt: Date.now(),
    })

    // Log the comment creation
    await ctx.runMutation("auditLogs:log", {
      entityType: "ticket",
      entityId: args.ticketId,
      action: "comment_added",
      changes: {
        commentId,
        content: args.content,
        isInternal: args.isInternal,
      },
    })

    return commentId
  },
})

// Mutation to update a comment (only by author, within time limit)
export const update = mutation({
  args: {
    commentId: v.id("comments"),
    content: v.string(),
  },
  handler: async (ctx, { commentId, content }) => {
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

    const comment = await ctx.db.get(commentId)
    if (!comment) {
      throw new ConvexError("Comment not found")
    }

    // Only author can edit their comment
    if (comment.authorId !== user._id) {
      throw new ConvexError("You can only edit your own comments")
    }

    // Check time limit (e.g., 15 minutes)
    const editTimeLimit = 15 * 60 * 1000 // 15 minutes in milliseconds
    const timeSinceCreation = Date.now() - comment._creationTime
    
    if (timeSinceCreation > editTimeLimit) {
      throw new ConvexError("Comment can only be edited within 15 minutes of creation")
    }

    // Verify ticket access
    const ticket = await ctx.db.get(comment.ticketId)
    if (!ticket) {
      throw new ConvexError("Associated ticket not found")
    }

    if (ticket.status === 'closed') {
      throw new ConvexError("Cannot edit comments on closed tickets")
    }

    const oldContent = comment.content

    // Update the comment
    await ctx.db.patch(commentId, {
      content: content.trim(),
    })

    // Log the edit
    await ctx.runMutation("auditLogs:log", {
      entityType: "ticket",
      entityId: comment.ticketId,
      action: "comment_edited",
      changes: {
        commentId,
        content: {
          from: oldContent,
          to: content,
        },
      },
    })

    return commentId
  },
})

// Mutation to delete a comment (only by author or admin)
export const remove = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, { commentId }) => {
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

    const comment = await ctx.db.get(commentId)
    if (!comment) {
      throw new ConvexError("Comment not found")
    }

    // Only author can delete their comment (or admin - TODO: add role check)
    if (comment.authorId !== user._id) {
      throw new ConvexError("You can only delete your own comments")
    }

    // Verify ticket access
    const ticket = await ctx.db.get(comment.ticketId)
    if (!ticket) {
      throw new ConvexError("Associated ticket not found")
    }

    // Log the deletion before removing
    await ctx.runMutation("auditLogs:log", {
      entityType: "ticket",
      entityId: comment.ticketId,
      action: "comment_deleted",
      changes: {
        commentId,
        content: comment.content,
      },
    })

    // Delete the comment
    await ctx.db.delete(commentId)

    return { success: true }
  },
})

// Query to get comment statistics
export const getStats = query({
  args: {
    ticketId: v.optional(v.id("tickets")),
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

    let query = ctx.db.query("comments")

    if (ticketId) {
      // Verify ticket access first
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

      query = query.withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
    }

    const comments = await query.collect()

    // Filter comments based on ticket access (if not filtering by specific ticket)
    let accessibleComments = comments
    if (!ticketId) {
      accessibleComments = []
      for (const comment of comments) {
        const ticket = await ctx.db.get(comment.ticketId)
        if (ticket && ticket.clinicId === user.clinicId) {
          const hasAccess = 
            ticket.visibility === 'public' ||
            ticket.creatorId === user._id ||
            ticket.assigneeId === user._id
          
          if (hasAccess) {
            accessibleComments.push(comment)
          }
        }
      }
    }

    return {
      total: accessibleComments.length,
      internal: accessibleComments.filter(c => c.isInternal).length,
      public: accessibleComments.filter(c => !c.isInternal).length,
      byAuthor: accessibleComments.reduce((acc, comment) => {
        acc[comment.authorId] = (acc[comment.authorId] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    }
  },
})


