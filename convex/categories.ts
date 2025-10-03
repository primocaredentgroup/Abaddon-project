import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"
import { getCurrentUser, generateSlug } from "./lib/utils"

// Query per ottenere l'albero delle categorie di una clinica
export const getCategoryTree = query({
  args: { 
    clinicId: v.id("clinics"),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    isActive: v.optional(v.boolean())
  },
  handler: async (ctx, { clinicId, visibility, isActive }) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .collect()
    
    // Applica filtri
    let filteredCategories = categories
    
    if (visibility) {
      filteredCategories = filteredCategories.filter(cat => cat.visibility === visibility)
    }
    
    if (isActive !== undefined) {
      filteredCategories = filteredCategories.filter(cat => cat.isActive === isActive)
    }
    
    // Escludi categorie eliminate (soft delete) di default
    filteredCategories = filteredCategories.filter(cat => !cat.deletedAt)
    
    // Costruisci l'albero
    const byId = new Map(filteredCategories.map(n => [n._id, { ...n, children: [] as any[] }]))
    const roots: any[] = []
    
    for (const n of byId.values()) {
      if (n.parentId) {
        const parent = byId.get(n.parentId)
        if (parent) parent.children.push(n)
      } else {
        roots.push(n)
      }
    }
    
    // Ordina per order
    const sortRecursive = (arr: any[]) => {
      arr.sort((a, b) => a.order - b.order)
      arr.forEach(x => sortRecursive(x.children))
    }
    sortRecursive(roots)
    
    return roots
  }
})

// Query per ottenere tutte le categorie di una clinica (lista piatta)
export const getCategoriesByClinic = query({
  args: { 
    clinicId: v.id("clinics"),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    isActive: v.optional(v.boolean())
  },
  handler: async (ctx, { clinicId, visibility, isActive }) => {
    let query = ctx.db
      .query("categories")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
    
    const categories = await query.collect()
    
    // Applica filtri
    let filteredCategories = categories
    
    if (visibility) {
      filteredCategories = filteredCategories.filter(cat => cat.visibility === visibility)
    }
    
    if (isActive !== undefined) {
      filteredCategories = filteredCategories.filter(cat => cat.isActive === isActive)
    }
    
    // Escludi categorie eliminate (soft delete) di default
    filteredCategories = filteredCategories.filter(cat => !cat.deletedAt)
    
    // Ordina per depth e order
    filteredCategories.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth
      return a.order - b.order
    })
    
    // Popola i dati del dipartimento se presente
    const categoriesWithDepartments = await Promise.all(
      filteredCategories.map(async (category) => {
        const department = category.departmentId 
          ? await ctx.db.get(category.departmentId)
          : null
        return { ...category, department }
      })
    )
    
    return categoriesWithDepartments
  }
})

// Query per ottenere una categoria per ID
export const getCategoryById = query({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    const category = await ctx.db.get(categoryId)
    if (!category) {
      throw new ConvexError("Category not found")
    }
    
    // Popola i dati del dipartimento se presente
    const department = category.departmentId 
      ? await ctx.db.get(category.departmentId)
      : null
    
    return { ...category, department }
  }
})

// Query per ottenere tutte le categorie attive (per competenze agenti)
export const getAllCategories = query({
  args: {
    clinicId: v.optional(v.id("clinics"))
  },
  handler: async (ctx, { clinicId }) => {
    let categories
    
    // Se clinicId è fornito, filtra per clinica
    if (clinicId) {
      categories = await ctx.db
        .query("categories")
        .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
        .collect()
    } else {
      categories = await ctx.db.query("categories").collect()
    }
    
    // Filtra solo categorie attive e non eliminate
    const activeCategories = categories.filter(cat => 
      cat.isActive && !cat.deletedAt
    )
    
    // Ordina per nome
    activeCategories.sort((a, b) => a.name.localeCompare(b.name))
    
    return activeCategories
  }
})

// Query per ottenere categorie pubbliche di una clinica (per utenti)
export const getPublicCategories = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .filter((q) => 
        q.and(
          q.eq(q.field("visibility"), "public"),
          q.eq(q.field("isActive"), true),
          q.eq(q.field("deletedAt"), undefined) // escludi eliminate
        )
      )
      .collect()
  }
})

// Query per ottenere tutte le categorie incluse quelle eliminate (per admin)
export const getAllCategoriesByClinic = query({
  args: { 
    clinicId: v.id("clinics"),
    includeDeleted: v.optional(v.boolean())
  },
  handler: async (ctx, { clinicId, includeDeleted = false }) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .collect()
    
    // Filtra o include categorie eliminate
    const filteredCategories = includeDeleted 
      ? categories 
      : categories.filter(cat => !cat.deletedAt)
    
    // Ordina per depth e order
    filteredCategories.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth
      return a.order - b.order
    })
    
    // Popola i dati del dipartimento se presente
    const categoriesWithDepartments = await Promise.all(
      filteredCategories.map(async (category) => {
        const department = category.departmentId 
          ? await ctx.db.get(category.departmentId)
          : null
        return { ...category, department }
      })
    )
    
    return categoriesWithDepartments
  }
})

// Query per ottenere solo le categorie eliminate (cestino)
export const getDeletedCategories = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect()
    
    // Ordina per data di eliminazione (più recenti prima)
    categories.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
    
    // Popola i dati del dipartimento se presente
    const categoriesWithDepartments = await Promise.all(
      categories.map(async (category) => {
        const department = category.departmentId 
          ? await ctx.db.get(category.departmentId)
          : null
        return { ...category, department }
      })
    )
    
    return categoriesWithDepartments
  }
})

// Mutation per creare una nuova categoria
export const createCategory = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    clinicId: v.id("clinics"),
    departmentId: v.optional(v.id("departments")),
    visibility: v.union(v.literal("public"), v.literal("private")),
    parentId: v.optional(v.id("categories")),
    synonyms: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Validazioni
    if (args.name.length < 2) {
      throw new ConvexError("Category name must be at least 2 characters long")
    }
    
    // Genera slug
    const slug = generateSlug(args.name)
    
    // Verifica che la clinica esista
    const clinic = await ctx.db.get(args.clinicId)
    if (!clinic) {
      throw new ConvexError("Clinic not found")
    }
    
    // Verifica che il dipartimento esista se fornito
    if (args.departmentId) {
      const department = await ctx.db.get(args.departmentId)
      if (!department) {
        throw new ConvexError("Department not found")
      }
      
      // Verifica che il dipartimento appartenga alla stessa clinica
      if (department.clinicId !== args.clinicId) {
        throw new ConvexError("Department does not belong to the specified clinic")
      }
    }
    
    // Verifica che non esista già una categoria con lo stesso slug nella clinica
    const existingCategory = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("clinicId", args.clinicId).eq("slug", slug))
      .unique()
      
    if (existingCategory) {
      throw new ConvexError("A category with this name already exists in this clinic")
    }
    
    // Gestisci gerarchia
    let depth = 0
    let path: any[] = []
    let order = 0
    
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId)
      if (!parent) {
        throw new ConvexError("Parent category not found")
      }
      
      if (parent.clinicId !== args.clinicId) {
        throw new ConvexError("Parent category must belong to the same clinic")
      }
      
      depth = parent.depth + 1
      path = [...parent.path, parent._id]
      
      // Calcola order tra siblings
      const siblings = await ctx.db
        .query("categories")
        .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
        .collect()
      order = siblings.length
    } else {
      // Categoria root
      const rootCategories = await ctx.db
        .query("categories")
        .withIndex("by_parent", (q) => q.eq("parentId", undefined))
        .filter((q) => q.eq(q.field("clinicId"), args.clinicId))
        .collect()
      order = rootCategories.length
    }
    
    // Determina se richiede approvazione
    const requiresApproval = clinic.settings.requireApprovalForCategories
    
    // Crea la categoria
    const categoryId = await ctx.db.insert("categories", {
      name: args.name,
      slug,
      description: args.description,
      clinicId: args.clinicId,
      departmentId: args.departmentId,
      visibility: args.visibility,
      parentId: args.parentId,
      path,
      depth,
      order,
      synonyms: args.synonyms || [],
      requiresApproval,
      isActive: !requiresApproval, // Se richiede approvazione, inizia come inattiva
    })
    
    return categoryId
  }
})

// Mutation per aggiornare una categoria
export const updateCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { categoryId, ...updates }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che la categoria esista
    const category = await ctx.db.get(categoryId)
    if (!category) {
      throw new ConvexError("Category not found")
    }
    
    // Validazioni
    if (updates.name && updates.name.length < 2) {
      throw new ConvexError("Category name must be at least 2 characters long")
    }
    
    // Verifica che il dipartimento esista se fornito
    if (updates.departmentId) {
      const department = await ctx.db.get(updates.departmentId)
      if (!department) {
        throw new ConvexError("Department not found")
      }
      
      // Verifica che il dipartimento appartenga alla stessa clinica
      if (department.clinicId !== category.clinicId) {
        throw new ConvexError("Department does not belong to the same clinic")
      }
    }
    
    // Verifica unicità del nome se viene cambiato
    if (updates.name && updates.name !== category.name) {
      const existingCategory = await ctx.db
        .query("categories")
        .withIndex("by_clinic", (q) => q.eq("clinicId", category.clinicId))
        .filter((q) => q.eq(q.field("name"), updates.name))
        .unique()
        
      if (existingCategory) {
        throw new ConvexError("A category with this name already exists in this clinic")
      }
    }
    
    // Aggiorna la categoria
    await ctx.db.patch(categoryId, updates)
    
    return categoryId
  }
})

// Mutation per approvare una categoria
export const approveCategory = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che la categoria esista
    const category = await ctx.db.get(categoryId)
    if (!category) {
      throw new ConvexError("Category not found")
    }
    
    // Attiva la categoria
    await ctx.db.patch(categoryId, { 
      isActive: true,
      requiresApproval: false 
    })
    
    return categoryId
  }
})

// Mutation per rifiutare una categoria
export const rejectCategory = mutation({
  args: { 
    categoryId: v.id("categories"),
    reason: v.optional(v.string())
  },
  handler: async (ctx, { categoryId, reason }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che la categoria esista
    const category = await ctx.db.get(categoryId)
    if (!category) {
      throw new ConvexError("Category not found")
    }
    
    // Elimina la categoria rifiutata
    await ctx.db.delete(categoryId)
    
    // TODO: Inviare notifica al creatore con il motivo del rifiuto
    
    return categoryId
  }
})

// Mutation per soft delete di una categoria
export const softDeleteCategory = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che la categoria esista
    const category = await ctx.db.get(categoryId)
    if (!category) {
      throw new ConvexError("Category not found")
    }
    
    // Verifica che non sia già eliminata
    if (category.deletedAt) {
      throw new ConvexError("Category is already deleted")
    }
    
    // Soft delete: imposta deletedAt al timestamp corrente
    await ctx.db.patch(categoryId, { 
      deletedAt: Date.now(),
      isActive: false // disattiva anche la categoria
    })
    
    return categoryId
  }
})

// Mutation per ripristinare una categoria eliminata (restore)
export const restoreCategory = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che la categoria esista
    const category = await ctx.db.get(categoryId)
    if (!category) {
      throw new ConvexError("Category not found")
    }
    
    // Verifica che sia eliminata
    if (!category.deletedAt) {
      throw new ConvexError("Category is not deleted")
    }
    
    // Ripristina: rimuovi deletedAt e riattiva
    await ctx.db.patch(categoryId, { 
      deletedAt: undefined,
      isActive: true
    })
    
    return categoryId
  }
})

// Mutation per eliminazione permanente (hard delete)
export const deleteCategory = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che la categoria esista
    const category = await ctx.db.get(categoryId)
    if (!category) {
      throw new ConvexError("Category not found")
    }
    
    // Verifica che non ci siano ticket associati a questa categoria
    const ticketsWithCategory = await ctx.db
      .query("tickets")
      .withIndex("by_category", (q) => q.eq("categoryId", categoryId))
      .collect()
      
    if (ticketsWithCategory.length > 0) {
      throw new ConvexError("Cannot delete category: there are tickets associated with it")
    }
    
    // Elimina definitivamente la categoria
    await ctx.db.delete(categoryId)
    
    return categoryId
  }
})

// Query per ottenere categorie in attesa di approvazione
export const getPendingCategories = query({
  args: { clinicId: v.optional(v.id("clinics")) },
  handler: async (ctx, { clinicId }) => {
    let categories
    
    if (clinicId) {
      categories = await ctx.db
        .query("categories")
        .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
    } else {
      categories = await ctx.db.query("categories")
    }
    
    const allCategories = await categories
      .filter((q) => 
        q.and(
          q.eq(q.field("requiresApproval"), true),
          q.eq(q.field("isActive"), false)
        )
      )
      .collect()
    
    // Popola i dati della clinica e del dipartimento
    const categoriesWithDetails = await Promise.all(
      allCategories.map(async (category) => {
        const [clinic, department] = await Promise.all([
          ctx.db.get(category.clinicId),
          category.departmentId ? ctx.db.get(category.departmentId) : null
        ])
        return { ...category, clinic, department }
      })
    )
    
    return categoriesWithDetails
  }
})

// Mutations semplici senza autenticazione per lo sviluppo
export const createCategorySimple = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    clinicId: v.id("clinics"),
    visibility: v.union(v.literal("public"), v.literal("private")),
    defaultTicketVisibility: v.optional(v.union(v.literal("public"), v.literal("private"))), // 🆕
    synonyms: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Genera slug
    const slug = generateSlug(args.name)
    
    // Verifica che la clinica esista
    const clinic = await ctx.db.get(args.clinicId)
    if (!clinic) {
      throw new ConvexError("Clinic not found")
    }
    
    // Crea la categoria
    const categoryId = await ctx.db.insert("categories", {
      name: args.name,
      slug,
      description: args.description,
      clinicId: args.clinicId,
      visibility: args.visibility,
      defaultTicketVisibility: args.defaultTicketVisibility || "public", // 🆕 Default a public
      parentId: undefined, // Solo categorie root per ora
      path: [],
      depth: 0,
      order: 0,
      synonyms: args.synonyms || [],
      requiresApproval: false,
      isActive: true,
    })
    
    return categoryId
  }
})

export const updateCategorySimple = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    defaultTicketVisibility: v.optional(v.union(v.literal("public"), v.literal("private"))), // 🆕
  },
  handler: async (ctx, { categoryId, ...updates }) => {
    // Verifica che la categoria esista
    const category = await ctx.db.get(categoryId)
    if (!category) {
      throw new ConvexError("Category not found")
    }
    
    // Aggiorna la categoria
    await ctx.db.patch(categoryId, updates)
    
    return categoryId
  }
})

export const softDeleteCategorySimple = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    // Verifica che la categoria esista
    const category = await ctx.db.get(categoryId)
    if (!category) {
      throw new ConvexError("Category not found")
    }
    
    if (category.deletedAt) {
      throw new ConvexError("Category is already deleted")
    }
    
    // Soft delete
    await ctx.db.patch(categoryId, { 
      deletedAt: Date.now(),
      isActive: false
    })
    
    return categoryId
  }
})

export const restoreCategorySimple = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    // Verifica che la categoria esista
    const category = await ctx.db.get(categoryId)
    if (!category) {
      throw new ConvexError("Category not found")
    }
    
    if (!category.deletedAt) {
      throw new ConvexError("Category is not deleted")
    }
    
    // Ripristina
    await ctx.db.patch(categoryId, { 
      deletedAt: undefined,
      isActive: true
    })
    
    return categoryId
  }
})

export const hardDeleteCategorySimple = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    // Verifica che la categoria esista
    const category = await ctx.db.get(categoryId)
    if (!category) {
      throw new ConvexError("Category not found")
    }
    
    // Elimina definitivamente
    await ctx.db.delete(categoryId)
    
    return categoryId
  }
})

// 🔧 Mutation per fixare categorie esistenti senza defaultTicketVisibility
export const fixExistingCategoriesVisibility = mutation({
  handler: async (ctx) => {
    console.log("🔧 [fixExistingCategoriesVisibility] Starting fix for existing categories...");
    
    const allCategories = await ctx.db.query("categories").collect();
    
    let fixed = 0;
    let alreadyOk = 0;
    
    for (const category of allCategories) {
      // @ts-ignore - Ignoriamo il tipo perché stiamo fixando vecchi dati
      if (category.defaultTicketVisibility === undefined) {
        await ctx.db.patch(category._id, {
          defaultTicketVisibility: "public", // Default a public per categorie esistenti
        });
        console.log(`✅ Fixed category: ${category.name} -> defaultTicketVisibility: public`);
        fixed++;
      } else {
        alreadyOk++;
      }
    }
    
    return {
      total: allCategories.length,
      fixed,
      alreadyOk,
      message: `✅ Fixed ${fixed} categories, ${alreadyOk} were already ok`
    };
  },
})

// Mutation per inizializzare le categorie di base per una clinica
export const initializeBaseCategories = mutation({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    // Verifica autenticazione (commentata per test)
    // const currentUser = await getCurrentUser(ctx)
    
    // Verifica che la clinica esista
    const clinic = await ctx.db.get(clinicId)
    if (!clinic) {
      throw new ConvexError("Clinic not found")
    }
    
    // Elimina categorie esistenti per questa clinica
    const existingCategories = await ctx.db
      .query("categories")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .collect()
    
    for (const category of existingCategories) {
      await ctx.db.delete(category._id)
    }
    
    // Definisci le 9 categorie di base
    const baseCategories = [
      {
        name: "Manutenzioni",
        description: "Richieste di manutenzione strutture e impianti",
        synonyms: ["manutenzione", "riparazione", "guasto", "impianti"]
      },
      {
        name: "Elettromedicali",
        description: "Assistenza e manutenzione apparecchiature elettromedicali",
        synonyms: ["elettromedicale", "apparecchiature", "calibrazione", "biomed"]
      },
      {
        name: "Hardware Computer",
        description: "Supporto hardware per computer e dispositivi IT",
        synonyms: ["hardware", "computer", "pc", "stampante", "rete"]
      },
      {
        name: "Eseguti Medici",
        description: "Gestione esami e procedure mediche",
        synonyms: ["esami", "procedure", "medico", "diagnostica"]
      },
      {
        name: "Prescrizioni",
        description: "Gestione prescrizioni mediche e farmaci",
        synonyms: ["prescrizione", "farmaci", "ricette", "terapie"]
      },
      {
        name: "Agendazione",
        description: "Prenotazioni e gestione appuntamenti",
        synonyms: ["appuntamenti", "prenotazioni", "agenda", "visite"]
      },
      {
        name: "Fatturazione",
        description: "Gestione fatture e aspetti amministrativi",
        synonyms: ["fatture", "amministrazione", "pagamenti", "contabilità"]
      },
      {
        name: "HR/Risorse Umane",
        description: "Gestione personale e risorse umane",
        synonyms: ["hr", "personale", "risorse umane", "dipendenti"]
      },
      {
        name: "Travel",
        description: "Gestione viaggi e trasferte",
        synonyms: ["viaggi", "trasferte", "spostamenti", "travel"]
      }
    ]
    
    // Crea le categorie
    const categoryIds = []
    
    for (let i = 0; i < baseCategories.length; i++) {
      const category = baseCategories[i]
      const slug = generateSlug(category.name)
      
      const categoryId = await ctx.db.insert("categories", {
        name: category.name,
        slug,
        description: category.description,
        clinicId,
        visibility: "public",
        parentId: undefined, // Categorie root
        path: [],
        depth: 0,
        order: i,
        synonyms: category.synonyms,
        requiresApproval: false,
        isActive: true,
      })
      
      categoryIds.push(categoryId)
    }
    
    return {
      message: `Created ${categoryIds.length} base categories`,
      categoryIds
    }
  }
})