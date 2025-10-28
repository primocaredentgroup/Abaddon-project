import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"
import { getCurrentUser, generateSlug } from "./lib/utils"
import { userHasAccessToCategory } from "./categories"

// Query per ottenere tutti i tag di una clinica
export const getTagsByClinic = query({
  args: { 
    clinicId: v.id("clinics"),
    categoryId: v.optional(v.id("categories")),
    isActive: v.optional(v.boolean())
  },
  handler: async (ctx, { clinicId, categoryId, isActive }) => {
    let query = ctx.db
      .query("tags")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
    
    const tags = await query.collect()
    
    // Applica filtri
    let filteredTags = tags
    
    if (categoryId !== undefined) {
      filteredTags = filteredTags.filter(tag => tag.categoryId === categoryId)
    }
    
    if (isActive !== undefined) {
      filteredTags = filteredTags.filter(tag => tag.isActive === isActive)
    }
    
    // Ordina per utilizzo decrescente
    filteredTags.sort((a, b) => b.usageCount - a.usageCount)
    
    // Popola i dati della categoria se presente
    const tagsWithCategories = await Promise.all(
      filteredTags.map(async (tag) => {
        const category = tag.categoryId 
          ? await ctx.db.get(tag.categoryId)
          : null
        return { ...tag, category }
      })
    )
    
    return tagsWithCategories
  }
})

// Query per cercare tag
export const searchTags = query({
  args: { 
    clinicId: v.id("clinics"),
    searchTerm: v.string(),
    limit: v.optional(v.number())
  },
  handler: async (ctx, { clinicId, searchTerm, limit = 20 }) => {
    const tags = await ctx.db
      .query("tags")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .collect()
    
    const searchLower = searchTerm.toLowerCase()
    
    // Cerca in nome e sinonimi
    const matchingTags = tags
      .filter(tag => 
        tag.isActive && (
          tag.name.toLowerCase().includes(searchLower) ||
          tag.synonyms.some(synonym => synonym.toLowerCase().includes(searchLower))
        )
      )
      .sort((a, b) => {
        // Priorità: match esatto nome > match inizio nome > match sinonimi > usage count
        const aExact = a.name.toLowerCase() === searchLower ? 3 : 0
        const bExact = b.name.toLowerCase() === searchLower ? 3 : 0
        const aStart = a.name.toLowerCase().startsWith(searchLower) ? 2 : 0
        const bStart = b.name.toLowerCase().startsWith(searchLower) ? 2 : 0
        const aScore = aExact + aStart + (a.usageCount / 100)
        const bScore = bExact + bStart + (b.usageCount / 100)
        return bScore - aScore
      })
      .slice(0, limit)
    
    return matchingTags
  }
})

// Mutation per creare un nuovo tag
export const createTag = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    clinicId: v.id("clinics"),
    categoryId: v.optional(v.id("categories")),
    color: v.optional(v.string()),
    synonyms: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Verifica autenticazione (commentata per test)
    // const currentUser = await getCurrentUser(ctx)
    
    // Validazioni
    if (args.name.length < 2) {
      throw new ConvexError("Tag name must be at least 2 characters long")
    }
    
    // Genera slug
    const slug = generateSlug(args.name)
    
    // Verifica che la clinica esista
    const clinic = await ctx.db.get(args.clinicId)
    if (!clinic) {
      throw new ConvexError("Clinic not found")
    }
    
    // Verifica che la categoria esista se fornita
    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId)
      if (!category) {
        throw new ConvexError("Category not found")
      }
      
      // ❌ RIMOSSO check clinicId - le categorie non hanno più clinicId
      // La verifica dell'accesso avviene via società
    }
    
    // Verifica che non esista già un tag con lo stesso slug nella clinica
    const existingTag = await ctx.db
      .query("tags")
      .withIndex("by_slug", (q) => q.eq("clinicId", args.clinicId).eq("slug", slug))
      .unique()
      
    if (existingTag) {
      throw new ConvexError("A tag with this name already exists in this clinic")
    }
    
    // Crea il tag
    const tagId = await ctx.db.insert("tags", {
      name: args.name,
      slug,
      description: args.description,
      clinicId: args.clinicId,
      categoryId: args.categoryId,
      color: args.color || "#6b7280", // default gray
      isActive: true,
      usageCount: 0,
      synonyms: args.synonyms || [],
      aiGenerated: false,
    })
    
    return tagId
  }
})

// Mutation per aggiornare un tag
export const updateTag = mutation({
  args: {
    tagId: v.id("tags"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    color: v.optional(v.string()),
    synonyms: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { tagId, ...updates }) => {
    // Verifica autenticazione (commentata per test)
    // const currentUser = await getCurrentUser(ctx)
    
    // Verifica che il tag esista
    const tag = await ctx.db.get(tagId)
    if (!tag) {
      throw new ConvexError("Tag not found")
    }
    
    // Validazioni
    if (updates.name && updates.name.length < 2) {
      throw new ConvexError("Tag name must be at least 2 characters long")
    }
    
    // Verifica che la categoria esista se fornita
    if (updates.categoryId) {
      const category = await ctx.db.get(updates.categoryId)
      if (!category) {
        throw new ConvexError("Category not found")
      }
      
      // ❌ RIMOSSO check clinicId - le categorie non hanno più clinicId
    }
    
    // Aggiorna slug se il nome cambia
    let updateData: any = { ...updates }
    if (updates.name && updates.name !== tag.name) {
      const newSlug = generateSlug(updates.name)
      
      // Verifica unicità del nuovo slug
      const existingTag = await ctx.db
        .query("tags")
        .withIndex("by_slug", (q) => q.eq("clinicId", tag.clinicId).eq("slug", newSlug))
        .unique()
        
      if (existingTag && existingTag._id !== tagId) {
        throw new ConvexError("A tag with this name already exists in this clinic")
      }
      
      updateData.slug = newSlug
    }
    
    // Aggiorna il tag
    await ctx.db.patch(tagId, updateData)
    
    return tagId
  }
})

// Mutation per eliminare un tag
export const deleteTag = mutation({
  args: { tagId: v.id("tags") },
  handler: async (ctx, { tagId }) => {
    // Verifica autenticazione (commentata per test)
    // const currentUser = await getCurrentUser(ctx)
    
    // Verifica che il tag esista
    const tag = await ctx.db.get(tagId)
    if (!tag) {
      throw new ConvexError("Tag not found")
    }
    
    // Verifica che non ci siano ticket associati a questo tag
    const ticketTags = await ctx.db
      .query("ticketTags")
      .withIndex("by_tag", (q) => q.eq("tagId", tagId))
      .collect()
      
    if (ticketTags.length > 0) {
      throw new ConvexError("Cannot delete tag: there are tickets associated with it")
    }
    
    // Elimina il tag
    await ctx.db.delete(tagId)
    
    return tagId
  }
})

// Mutation per incrementare il contatore di utilizzo
export const incrementTagUsage = mutation({
  args: { tagId: v.id("tags") },
  handler: async (ctx, { tagId }) => {
    const tag = await ctx.db.get(tagId)
    if (!tag) {
      throw new ConvexError("Tag not found")
    }
    
    await ctx.db.patch(tagId, {
      usageCount: tag.usageCount + 1
    })
    
    return tag.usageCount + 1
  }
})

// ⚠️ DEPRECATED: Le categorie non sono più legate alle cliniche
// Query per ottenere statistiche tag per clinica e società dell'utente
export const getTagStatsByCategory = query({
  args: { 
    clinicId: v.id("clinics"),
    userId: v.id("users") // ← AGGIUNTO: necessario per filtrare categorie per società
  },
  handler: async (ctx, { clinicId, userId }) => {
    const tags = await ctx.db
      .query("tags")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .collect()
    
    // Ottieni categorie accessibili all'utente via società (importato in cima)
    const allCategories = await ctx.db.query("categories").collect()
    
    const categories = [];
    for (const cat of allCategories) {
      if (await userHasAccessToCategory(ctx, userId, cat._id)) {
        categories.push(cat);
      }
    }
    
    // Raggruppa tag per categoria
    const statsByCategory = categories.map(category => {
      const categoryTags = tags.filter(tag => tag.categoryId === category._id)
      const totalUsage = categoryTags.reduce((sum, tag) => sum + tag.usageCount, 0)
      const activeTags = categoryTags.filter(tag => tag.isActive).length
      const aiGeneratedTags = categoryTags.filter(tag => tag.aiGenerated).length
      
      return {
        category,
        totalTags: categoryTags.length,
        activeTags,
        aiGeneratedTags,
        totalUsage,
        topTags: categoryTags
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, 5)
      }
    })
    
    // Aggiungi tag senza categoria
    const unassignedTags = tags.filter(tag => !tag.categoryId)
    if (unassignedTags.length > 0) {
      statsByCategory.push({
        category: { _id: null, name: "Senza categoria", slug: "unassigned" } as any,
        totalTags: unassignedTags.length,
        activeTags: unassignedTags.filter(tag => tag.isActive).length,
        aiGeneratedTags: unassignedTags.filter(tag => tag.aiGenerated).length,
        totalUsage: unassignedTags.reduce((sum, tag) => sum + tag.usageCount, 0),
        topTags: unassignedTags
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, 5)
      })
    }
    
    return statsByCategory
  }
})
