import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"

// Get commenti per articolo
export const getCommentsByArticle = query({
  args: {
    articleId: v.id("kbArticles"),
  },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("kbArticleComments")
      .withIndex("by_article", (q) => q.eq("articleId", args.articleId))
      .collect()

    // Popola dati autore
    const commentsWithAuthor = await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId)
        return {
          ...comment,
          author: author ? {
            name: author.name,
            email: author.email
          } : null
        }
      })
    )

    // Organizza commenti in thread (top-level + risposte)
    const topLevelComments = commentsWithAuthor.filter(c => !c.parentCommentId)
    const replies = commentsWithAuthor.filter(c => c.parentCommentId)

    const commentsWithReplies = topLevelComments.map(comment => ({
      ...comment,
      replies: replies.filter(r => r.parentCommentId === comment._id)
    }))

    return commentsWithReplies
  }
})

// Aggiungi commento
export const addComment = mutation({
  args: {
    articleId: v.id("kbArticles"),
    content: v.string(),
    parentCommentId: v.optional(v.id("kbArticleComments")),
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

    // Crea commento
    const commentId = await ctx.db.insert("kbArticleComments", {
      articleId: args.articleId,
      authorId: user._id,
      content: args.content,
      parentCommentId: args.parentCommentId,
      isEdited: false,
    })

    // Se è una risposta, notifica l'autore del commento parent
    if (args.parentCommentId) {
      const parentComment = await ctx.db.get(args.parentCommentId)
      if (parentComment && parentComment.authorId !== user._id) {
        await ctx.db.insert("notifications", {
          userId: parentComment.authorId,
          type: "kb_comment_reply",
          title: "Nuova risposta al tuo commento",
          message: `${user.name} ha risposto al tuo commento sull'articolo KB`,
          relatedId: args.articleId,
          relatedUrl: `/kb/article/${args.articleId}`,
          isRead: false,
        })
      }
    } else {
      // Notifica l'autore dell'articolo
      const article = await ctx.db.get(args.articleId)
      if (article && article.authorId !== user._id) {
        await ctx.db.insert("notifications", {
          userId: article.authorId,
          type: "kb_comment",
          title: "Nuovo commento sul tuo articolo",
          message: `${user.name} ha commentato "${article.title}"`,
          relatedId: args.articleId,
          relatedUrl: `/kb/article/${args.articleId}`,
          isRead: false,
        })
      }
    }

    console.log(`💬 Commento aggiunto da ${args.userEmail} su articolo ${args.articleId}`)
    return { commentId }
  }
})

// Modifica commento
export const editComment = mutation({
  args: {
    commentId: v.id("kbArticleComments"),
    content: v.string(),
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

    // Verifica che sia l'autore
    const comment = await ctx.db.get(args.commentId)
    if (!comment) {
      throw new ConvexError("Commento non trovato")
    }

    if (comment.authorId !== user._id) {
      throw new ConvexError("Puoi modificare solo i tuoi commenti")
    }

    // Modifica commento
    await ctx.db.patch(args.commentId, {
      content: args.content,
      isEdited: true,
      editedAt: Date.now(),
    })

    console.log(`✏️ Commento modificato da ${args.userEmail}`)
    return { success: true }
  }
})

// Elimina commento
export const deleteComment = mutation({
  args: {
    commentId: v.id("kbArticleComments"),
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

    // Verifica che sia l'autore o admin/agente
    const comment = await ctx.db.get(args.commentId)
    if (!comment) {
      throw new ConvexError("Commento non trovato")
    }

    const role = await ctx.db.get(user.roleId)
    const isAuthor = comment.authorId === user._id
    const isAdmin = role?.name === 'Amministratore' || role?.name === 'Agente'

    if (!isAuthor && !isAdmin) {
      throw new ConvexError("Non hai i permessi per eliminare questo commento")
    }

    // Elimina commento e tutte le risposte
    const replies = await ctx.db
      .query("kbArticleComments")
      .withIndex("by_parent", (q) => q.eq("parentCommentId", args.commentId))
      .collect()

    for (const reply of replies) {
      await ctx.db.delete(reply._id)
    }

    await ctx.db.delete(args.commentId)

    console.log(`🗑️ Commento eliminato da ${args.userEmail}`)
    return { success: true }
  }
})


