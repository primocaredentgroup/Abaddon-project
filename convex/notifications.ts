import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"

// Get notifiche utente
export const getUserNotifications = query({
  args: {
    userEmail: v.string(),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verifica utente
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()

    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Query notifiche
    let query = ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))

    const allNotifications = await query.collect()

    // Filtra se richiesto solo non lette
    const notifications = args.unreadOnly
      ? allNotifications.filter(n => !n.isRead)
      : allNotifications

    // Ordina per data (più recenti prima)
    return notifications.sort((a, b) => b._creationTime - a._creationTime)
  }
})

// Conta notifiche non lette
export const getUnreadCount = query({
  args: {
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Verifica utente
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()

    if (!user) {
      return 0
    }

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => 
        q.eq("userId", user._id).eq("isRead", false)
      )
      .collect()

    return unreadNotifications.length
  }
})

// Segna notifica come letta
export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Verifica utente
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()

    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Verifica che la notifica appartenga all'utente
    const notification = await ctx.db.get(args.notificationId)
    if (!notification) {
      throw new ConvexError("Notifica non trovata")
    }

    if (notification.userId !== user._id) {
      throw new ConvexError("Notifica non appartenente all'utente")
    }

    // Segna come letta
    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: Date.now(),
    })

    return { success: true }
  }
})

// Segna tutte le notifiche come lette
export const markAllAsRead = mutation({
  args: {
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Verifica utente
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()

    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Get tutte le notifiche non lette
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => 
        q.eq("userId", user._id).eq("isRead", false)
      )
      .collect()

    // Segna tutte come lette
    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
        readAt: Date.now(),
      })
    }

    return { count: unreadNotifications.length }
  }
})

// Elimina notifica
export const deleteNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Verifica utente
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first()

    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Verifica che la notifica appartenga all'utente
    const notification = await ctx.db.get(args.notificationId)
    if (!notification) {
      throw new ConvexError("Notifica non trovata")
    }

    if (notification.userId !== user._id) {
      throw new ConvexError("Notifica non appartenente all'utente")
    }

    // Elimina
    await ctx.db.delete(args.notificationId)

    return { success: true }
  }
})

// Crea notifica (helper per altri moduli)
export const createNotification = mutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    relatedId: v.optional(v.string()),
    relatedUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      relatedId: args.relatedId,
      relatedUrl: args.relatedUrl,
      isRead: false,
    })

    return { notificationId }
  }
})


