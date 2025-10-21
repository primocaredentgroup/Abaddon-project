import { v } from "convex/values"
import { query } from "./_generated/server"
import { ConvexError } from "convex/values"
import { canManageAllTickets } from "./lib/permissions"

/**
 * Query "Ticket da Gestire" per agenti
 * 
 * Un agente vede:
 * 1. I suoi ticket assegnati direttamente
 * 2. I ticket non assegnati della sua clinica nelle sue categorie di competenza
 * 3. I ticket del suo "gruppo" (stessa clinica + stesse categorie di competenza)
 * 
 * NON vede ticket assegnati ad altri se non sono delle sue categorie
 */
export const getTicketsToManage = query({
  args: {
    userEmail: v.string(),
  },
  handler: async (ctx, { userEmail }) => {
    console.log('🎯 getTicketsToManage chiamata per:', userEmail)

    // Trova l'utente
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", userEmail))
      .first()

    if (!user) {
      throw new ConvexError("Utente non trovato")
    }

    // Verifica che sia un agente (controllo basato su permessi)
    const role = await ctx.db.get(user.roleId)
    if (!role || !canManageAllTickets(role)) {
      console.log('⚠️  Utente non ha permessi di gestione ticket')
      return []
    }

    // Ottieni le competenze dell'utente
    const userCompetencies = user.categoryCompetencies || []
    console.log('📚 Competenze utente:', userCompetencies.length)

    // Trova tutti i ticket della clinica
    const allTickets = await ctx.db
      .query("tickets")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId))
      .collect()

    console.log('📊 Totale ticket nella clinica:', allTickets.length)

    // Filtra i ticket secondo le regole
    const ticketsToManage = allTickets.filter(ticket => {
      // 1. Ticket assegnati direttamente all'agente
      if (ticket.assigneeId === user._id) {
        return true
      }

      // 2. Ticket non assegnati nelle categorie di competenza
      if (!ticket.assigneeId) {
        // Se l'agente non ha competenze specifiche, vede tutti i ticket non assegnati
        if (userCompetencies.length === 0) {
          return true
        }
        // Altrimenti solo quelli delle sue categorie
        return userCompetencies.includes(ticket.categoryId)
      }

      // 3. Ticket assegnati ad altri MA nelle categorie di competenza (gruppo)
      if (ticket.assigneeId && ticket.assigneeId !== user._id) {
        // Se l'agente non ha competenze, non vede ticket di altri
        if (userCompetencies.length === 0) {
          return false
        }
        // Vede solo se è nelle sue categorie di competenza
        return userCompetencies.includes(ticket.categoryId)
      }

      return false
    })

    console.log('✅ Ticket da gestire:', ticketsToManage.length)

    // Popola i dettagli
    const populatedTickets = await Promise.all(
      ticketsToManage.map(async (ticket) => {
        const [category, clinic, creator, assignee] = await Promise.all([
          ctx.db.get(ticket.categoryId),
          ctx.db.get(ticket.clinicId),
          ctx.db.get(ticket.creatorId),
          ticket.assigneeId ? ctx.db.get(ticket.assigneeId) : null
        ])

        return {
          ...ticket,
          category,
          clinic,
          creator,
          assignee
        }
      })
    )

    // Ordina per: prima sollecitati, poi per data
    return populatedTickets.sort((a, b) => {
      // Prima i sollecitati
      const aNudged = (a.nudgeCount || 0) > 0
      const bNudged = (b.nudgeCount || 0) > 0
      
      if (aNudged && !bNudged) return -1
      if (!aNudged && bNudged) return 1
      
      // Poi per ultimo sollecito
      if (a.lastNudgeAt && b.lastNudgeAt) {
        return b.lastNudgeAt - a.lastNudgeAt
      }
      
      // Infine per data creazione
      return b._creationTime - a._creationTime
    })
  }
})

