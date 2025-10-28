import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"
import { isAdminOrAgent, canManageAllTickets, getRoleType } from "./lib/permissions"

// ========================
// QUERIES - Articoli KB
// ========================

// Get articoli pubblici per clinica
export const getPublishedArticles = query({
  args: {
    clinicId: v.id("clinics"),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let articlesQuery = ctx.db
      .query("kbArticles")
      .withIndex("by_clinic", (q) => q.eq("clinicId", args.clinicId))
      .filter((q) => q.eq(q.field("isActive"), true))

    const articles = await articlesQuery.collect()

    // Filtra per categoria se specificata
    const filteredArticles = args.category 
      ? articles.filter(a => a.category === args.category)
      : articles

    // Popola i dati dell'autore
    const articlesWithAuthor = await Promise.all(
      filteredArticles.map(async (article) => {
        const author = await ctx.db.get(article.authorId)
        return {
          ...article,
          author: author ? {
            name: author.name,
            email: author.email
          } : null
        }
      })
    )

    return articlesWithAuthor
  }
})

// Ricerca avanzata full-text
export const searchArticles = query({
  args: {
    clinicId: v.id("clinics"),
    searchTerm: v.string(),
    category: v.optional(v.string()),
    difficulty: v.optional(v.union(v.literal("Facile"), v.literal("Medio"), v.literal("Avanzato"))),
  },
  handler: async (ctx, args) => {
    // Get all published articles for clinic
    const articles = await ctx.db
      .query("kbArticles")
      .withIndex("by_clinic", (q) => q.eq("clinicId", args.clinicId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

    const searchLower = args.searchTerm.toLowerCase()

    // Full-text search scoring
    const scoredArticles = articles.map(article => {
      let score = 0

      // Title match (highest weight)
      if (article.title.toLowerCase().includes(searchLower)) {
        score += 10
        // Exact match bonus
        if (article.title.toLowerCase() === searchLower) score += 5
      }

      // Excerpt match (medium weight)
      if (article.excerpt.toLowerCase().includes(searchLower)) {
        score += 5
      }

      // Content match (lower weight)
      if (article.content.toLowerCase().includes(searchLower)) {
        score += 2
      }

      // Tags match (high weight)
      if (article.tags) {
        article.tags.forEach(tag => {
          if (tag.toLowerCase().includes(searchLower)) score += 7
        })
      }

      // Category match (if specified)
      if (args.category && article.category === args.category) {
        score += 3
      }

      // Difficulty match (if specified)
      if (args.difficulty && article.difficulty === args.difficulty) {
        score += 2
      }

      return { ...article, searchScore: score }
    })

    // Filter articles with score > 0 and sort by score
    const relevantArticles = scoredArticles
      .filter(a => a.searchScore > 0)
      .sort((a, b) => b.searchScore - a.searchScore)

    // Popola i dati dell'autore
    const articlesWithAuthor = await Promise.all(
      relevantArticles.map(async (article) => {
        const author = await ctx.db.get(article.authorId)
        return {
          ...article,
          author: author ? {
            name: author.name,
            email: author.email
          } : null
        }
      })
    )

    return articlesWithAuthor
  }
})

// Get articolo singolo (incrementa views)
export const getArticleById = query({
  args: {
    articleId: v.id("kbArticles"),
  },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.articleId)
    
    if (!article) {
      throw new ConvexError("Articolo non trovato")
    }

    const author = await ctx.db.get(article.authorId)

    return {
      ...article,
      author: author ? {
        name: author.name,
        email: author.email
      } : null
    }
  }
})

// Incrementa views (mutation separata per non bloccare la query)
export const incrementViews = mutation({
  args: {
    articleId: v.id("kbArticles"),
  },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.articleId)
    if (!article) return

    await ctx.db.patch(args.articleId, {
      views: article.views + 1
    })
  }
})

// Toggle like su articolo
export const toggleLike = mutation({
  args: {
    articleId: v.id("kbArticles"),
    increment: v.boolean(), // true = like, false = unlike
  },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.articleId)
    if (!article) {
      throw new ConvexError("Articolo non trovato")
    }

    await ctx.db.patch(args.articleId, {
      likes: args.increment ? article.likes + 1 : Math.max(0, article.likes - 1)
    })
  }
})

// ========================
// MUTATIONS - Solo Agenti/Admin
// ========================

// Crea nuovo articolo (solo agenti/admin)
export const createArticle = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    excerpt: v.string(),
    category: v.string(),
    difficulty: v.union(v.literal("Facile"), v.literal("Medio"), v.literal("Avanzato")),
    featured: v.boolean(),
    tags: v.optional(v.array(v.string())),
    attachments: v.optional(v.array(v.object({
      name: v.string(),
      url: v.string(),
      type: v.string(),
      size: v.number(),
    }))),
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

    // Verifica permessi (solo agenti/admin, controllo basato su permessi)
    const role = await ctx.db.get(user.roleId)
    if (!canManageAllTickets(role)) {
      throw new ConvexError("Solo agenti e amministratori possono creare articoli")
    }

    if (!user.clinicId) {
      throw new ConvexError("User has no clinic assigned")
    }

    // Crea articolo
    const articleId = await ctx.db.insert("kbArticles", {
      title: args.title,
      content: args.content,
      excerpt: args.excerpt,
      category: args.category,
      difficulty: args.difficulty,
      clinicId: user.clinicId,
      authorId: user._id,
      views: 0,
      likes: 0,
      featured: args.featured,
      isActive: true,
      publishedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      tags: args.tags || [],
      attachments: args.attachments || [],
    })

    return { articleId }
  }
})

// Aggiorna articolo esistente (solo agenti/admin)
export const updateArticle = mutation({
  args: {
    articleId: v.id("kbArticles"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    category: v.optional(v.string()),
    difficulty: v.optional(v.union(v.literal("Facile"), v.literal("Medio"), v.literal("Avanzato"))),
    featured: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
    attachments: v.optional(v.array(v.object({
      name: v.string(),
      url: v.string(),
      type: v.string(),
      size: v.number(),
    }))),
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

    // Verifica permessi (controllo basato su permessi)
    const role = await ctx.db.get(user.roleId)
    if (!canManageAllTickets(role)) {
      throw new ConvexError("Solo agenti e amministratori possono modificare articoli")
    }

    // Verifica esistenza articolo
    const article = await ctx.db.get(args.articleId)
    if (!article) {
      throw new ConvexError("Articolo non trovato")
    }

    // Aggiorna articolo
    const updates: any = {
      lastUpdatedAt: Date.now()
    }

    if (args.title !== undefined) updates.title = args.title
    if (args.content !== undefined) updates.content = args.content
    if (args.excerpt !== undefined) updates.excerpt = args.excerpt
    if (args.category !== undefined) updates.category = args.category
    if (args.difficulty !== undefined) updates.difficulty = args.difficulty
    if (args.featured !== undefined) updates.featured = args.featured
    if (args.isActive !== undefined) updates.isActive = args.isActive
    if (args.tags !== undefined) updates.tags = args.tags
    if (args.attachments !== undefined) updates.attachments = args.attachments

    await ctx.db.patch(args.articleId, updates)

    return { success: true }
  }
})

// Elimina articolo (solo agenti/admin)
export const deleteArticle = mutation({
  args: {
    articleId: v.id("kbArticles"),
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

    // Verifica permessi (controllo basato su permessi)
    const role = await ctx.db.get(user.roleId)
    if (!canManageAllTickets(role)) {
      throw new ConvexError("Solo agenti e amministratori possono eliminare articoli")
    }

    // Elimina articolo
    await ctx.db.delete(args.articleId)

    return { success: true }
  }
})

// ========================
// SUGGESTIONS - Tutti possono suggerire
// ========================

// Crea suggerimento (tutti gli utenti)
export const createSuggestion = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    priority: v.union(v.literal("Bassa"), v.literal("Media"), v.literal("Alta")),
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

    if (!user.clinicId) {
      throw new ConvexError("User has no clinic assigned")
    }

    // Crea suggerimento
    const suggestionId = await ctx.db.insert("articleSuggestions", {
      title: args.title,
      description: args.description,
      category: args.category,
      priority: args.priority,
      clinicId: user.clinicId,
      suggestedBy: user._id,
      status: "pending",
    })

    // 🔔 Notifica tutti gli agenti/admin della clinica
    const agentsAndAdmins = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clinicId"), user.clinicId))
      .collect()

    for (const agent of agentsAndAdmins) {
      const role = await ctx.db.get(agent.roleId)
      if (isAdminOrAgent(role)) {
        await ctx.db.insert("notifications", {
          userId: agent._id,
          type: "kb_suggestion",
          title: "💡 Nuovo suggerimento KB",
          message: `${user.name} ha suggerito: "${args.title}"`,
          relatedId: suggestionId,
          relatedUrl: `/kb/suggestions`,
          isRead: false,
        })
      }
    }

    return { suggestionId }
  }
})

// Get suggerimenti per clinica (solo agenti/admin)
export const getSuggestionsByClinic = query({
  args: {
    clinicId: v.id("clinics"),
    userEmail: v.string(),
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
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

    // Verifica permessi (controllo basato su permessi)
    const role = await ctx.db.get(user.roleId)
    if (!canManageAllTickets(role)) {
      throw new ConvexError("Solo agenti e amministratori possono vedere i suggerimenti")
    }

    // Query suggerimenti
    let query = ctx.db
      .query("articleSuggestions")
      .withIndex("by_clinic", (q) => q.eq("clinicId", args.clinicId))

    const suggestions = await query.collect()

    // Filtra per status se specificato
    const filtered = args.status 
      ? suggestions.filter(s => s.status === args.status)
      : suggestions

    // Popola dati utente suggeritore
    const suggestionsWithUser = await Promise.all(
      filtered.map(async (suggestion) => {
        const suggestor = await ctx.db.get(suggestion.suggestedBy)
        const reviewer = suggestion.reviewedBy ? await ctx.db.get(suggestion.reviewedBy) : null
        
        return {
          ...suggestion,
          suggestor: suggestor ? {
            name: suggestor.name,
            email: suggestor.email
          } : null,
          reviewer: reviewer ? {
            name: reviewer.name,
            email: reviewer.email
          } : null
        }
      })
    )

    return suggestionsWithUser
  }
})

// Approva/rifiuta suggerimento (solo agenti/admin)
export const reviewSuggestion = mutation({
  args: {
    suggestionId: v.id("articleSuggestions"),
    action: v.union(v.literal("approve"), v.literal("reject")),
    notes: v.optional(v.string()),
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

    // Verifica permessi (controllo basato su permessi)
    const role = await ctx.db.get(user.roleId)
    if (!canManageAllTickets(role)) {
      throw new ConvexError("Solo agenti e amministratori possono revisionare suggerimenti")
    }

    // Aggiorna suggerimento
    await ctx.db.patch(args.suggestionId, {
      status: args.action === "approve" ? "approved" : "rejected",
      reviewedBy: user._id,
      reviewedAt: Date.now(),
      reviewNotes: args.notes,
    })

    const suggestion = await ctx.db.get(args.suggestionId)
    
    return { success: true }
  }
})

