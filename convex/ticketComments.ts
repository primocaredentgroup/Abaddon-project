import { v } from "convex/values"
import { mutation, query, internalMutation } from "./_generated/server"
import { ConvexError } from "convex/values"
import type { Id } from "./_generated/dataModel"

// Query per ottenere tutti i commenti di un ticket
export const getByTicketId = query({
  args: { 
    ticketId: v.id("tickets"),
    userEmail: v.optional(v.string()) // Per test temporaneo
  },
  handler: async (ctx, { ticketId, userEmail }) => {
    console.log(`💬 getTicketComments chiamata per ticket ${ticketId}`)
    
    // TEMPORARY: Per ora prendo l'utente con la tua email
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Verifica che l'utente possa vedere questo ticket
    const ticket = await ctx.db.get(ticketId)
    if (!ticket) {
      throw new ConvexError("Ticket non trovato")
    }

    // Controllo permessi: creatore, assignee, o stesso clinic
    const canView = 
      ticket.creatorId === user._id || 
      ticket.assigneeId === user._id ||
      ticket.clinicId === user.clinicId ||
      ticket.visibility === 'public'

    if (!canView) {
      throw new ConvexError("Non hai permessi per vedere i commenti di questo ticket")
    }

    // Ottieni tutti i commenti del ticket
    const comments = await ctx.db
      .query("ticketComments")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .order("asc")
      .collect()

    // Popola i dati dell'autore per ogni commento
    const commentsWithAuthor = await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId)
        return {
          ...comment,
          author: {
            id: author?._id,
            name: author?.name || author?.email?.split('@')[0] || 'Utente',
            email: author?.email,
            role: await ctx.db.get(author?.roleId!)
          }
        }
      })
    )

    console.log(`✅ Trovati ${commentsWithAuthor.length} commenti per ticket ${ticketId}`)
    return commentsWithAuthor
  },
})

// Mutation per aggiungere un commento
export const add = mutation({
  args: {
    ticketId: v.id("tickets"),
    content: v.string(),
    isInternal: v.optional(v.boolean()),
    userEmail: v.optional(v.string()) // Per test temporaneo
  },
  handler: async (ctx, { ticketId, content, isInternal, userEmail }) => {
    console.log(`💬 addComment chiamata per ticket ${ticketId}:`, { content: content.substring(0, 50) + '...' })
    
    // TEMPORARY: Per ora prendo l'utente con la tua email
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Verifica che l'utente possa commentare questo ticket
    const ticket = await ctx.db.get(ticketId)
    if (!ticket) {
      throw new ConvexError("Ticket non trovato")
    }

    // Controllo permessi: creatore, assignee, o stesso clinic
    const canComment = 
      ticket.creatorId === user._id || 
      ticket.assigneeId === user._id ||
      ticket.clinicId === user.clinicId

    if (!canComment) {
      throw new ConvexError("Non hai permessi per commentare questo ticket")
    }

    // Aggiungi il commento
    const commentId = await ctx.db.insert("ticketComments", {
      ticketId,
      authorId: user._id,
      content,
      isInternal: isInternal || false,
    })

    // Aggiorna lastActivityAt del ticket
    await ctx.db.patch(ticketId, {
      lastActivityAt: Date.now(),
    })

    console.log(`✅ Commento aggiunto con ID: ${commentId}`)
    return commentId
  },
})

// Mutation per sollecitare un ticket (nudge)
export const nudge = mutation({
  args: {
    ticketId: v.id("tickets"),
    userEmail: v.optional(v.string()) // Per test temporaneo
  },
  handler: async (ctx, { ticketId, userEmail }) => {
    console.log(`🔔 nudgeTicket chiamata per ticket ${ticketId}`)
    
    // TEMPORARY: Per ora prendo l'utente con la tua email
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Verifica che l'utente possa sollecitare questo ticket
    const ticket = await ctx.db.get(ticketId)
    if (!ticket) {
      throw new ConvexError("Ticket non trovato")
    }

    // Solo il creatore può sollecitare
    if (ticket.creatorId !== user._id) {
      throw new ConvexError("Solo il creatore del ticket può sollecitarne la risoluzione")
    }

    // Verifica che non sia già stato sollecitato di recente (max 1 volta ogni 24h)
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000
    if (ticket.lastNudgeAt && ticket.lastNudgeAt > twentyFourHoursAgo) {
      throw new ConvexError("Puoi sollecitare un ticket solo una volta ogni 24 ore")
    }

    // Aggiorna il ticket con il sollecito
    await ctx.db.patch(ticketId, {
      nudgeCount: (ticket.nudgeCount || 0) + 1,
      lastNudgeAt: Date.now(),
      lastNudgeBy: user._id,
      lastActivityAt: Date.now(),
    })

    // Aggiungi un commento automatico
    await ctx.db.insert("ticketComments", {
      ticketId,
      authorId: user._id,
      content: `🔔 L'utente ha sollecitato la risoluzione di questo ticket.`,
      isInternal: false,
    })

    console.log(`✅ Ticket ${ticketId} sollecitato! Conteggio: ${(ticket.nudgeCount || 0) + 1}`)
    return { 
      success: true, 
      nudgeCount: (ticket.nudgeCount || 0) + 1 
    }
  },
})

// Query per ottenere ticket sollecitati (per dashboard agenti)
export const getNudgedTickets = query({
  args: {
    userEmail: v.optional(v.string()) // Per test temporaneo
  },
  handler: async (ctx, { userEmail }) => {
    console.log(`🔔 getNudgedTickets chiamata`)
    
    // TEMPORARY: Per ora prendo l'utente con la tua email
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), userEmail))
      .first()
    
    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Solo agenti/admin possono vedere i solleciti
    const role = await ctx.db.get(user.roleId)
    if (role?.name !== 'agent' && role?.name !== 'admin') {
      return [] // Utenti normali non vedono solleciti
    }

    // Trova ticket sollecitati negli ultimi 7 giorni
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    
    const nudgedTickets = await ctx.db
      .query("tickets")
      .withIndex("by_last_nudge", (q) => q.gt("lastNudgeAt", sevenDaysAgo))
      .filter((q) => q.neq(q.field("status"), "closed")) // Escludi ticket chiusi
      .order("desc")
      .collect()

    // Popola i dati correlati
    const ticketsWithData = await Promise.all(
      nudgedTickets.map(async (ticket) => {
        const [creator, assignee, category, clinic] = await Promise.all([
          ctx.db.get(ticket.creatorId),
          ticket.assigneeId ? ctx.db.get(ticket.assigneeId) : null,
          ctx.db.get(ticket.categoryId),
          ctx.db.get(ticket.clinicId),
        ])

        return {
          ...ticket,
          creator,
          assignee,
          category,
          clinic,
        }
      })
    )

    console.log(`✅ Trovati ${ticketsWithData.length} ticket sollecitati`)
    return ticketsWithData
  },
})
