import { v } from "convex/values"
import { mutation, query, QueryCtx } from "./_generated/server"
import { ConvexError } from "convex/values"
import { getCurrentUser, generateSlug } from "./lib/utils"
import { Id, Doc } from "./_generated/dataModel"

// 🛡️ Helper: Verifica se un utente ha accesso a una categoria (via società)
export async function userHasAccessToCategory(
  ctx: QueryCtx,
  userId: Id<"users">,
  categoryId: Id<"categories">
): Promise<boolean> {
  const category = await ctx.db.get(categoryId);
  if (!category) return false;
  
  // Se la categoria non ha societyIds → visibile a tutti
  if (!category.societyIds || category.societyIds.length === 0) {
    return true;
  }
  
  // Ottieni società dell'utente
  const userSocieties = await ctx.db
    .query("userSocieties")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();
  
  const userSocietyIds = userSocieties.map(us => us.societyId);
  
  // Verifica se l'utente ha almeno una società della categoria
  return category.societyIds.some(societyId => userSocietyIds.includes(societyId));
}

// ⚠️ DEPRECATED: Le categorie non hanno più clinicId, usa getCategoryTreeByUser
// Query per ottenere l'albero delle categorie filtrate per società dell'utente
export const getCategoryTree = query({
  args: { 
    userId: v.id("users"), // ← CAMBIATO: ora usa userId invece di clinicId
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    isActive: v.optional(v.boolean())
  },
  handler: async (ctx, { userId, visibility, isActive }) => {
    // Ottieni categorie filtrate per società dell'utente
    const allCategories = await ctx.db
      .query("categories")
      .collect()
    
    // Filtra per accesso utente (via società)
    const categoriesWithAccess = [];
    for (const category of allCategories) {
      const hasAccess = await userHasAccessToCategory(ctx, userId, category._id);
      if (hasAccess) {
        categoriesWithAccess.push(category);
      }
    }
    
    const categories = categoriesWithAccess;
    
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

// ⚠️ DEPRECATED: Le categorie non hanno più clinicId, usa getPublicCategoriesByUserSocieties o getCategoryTree
// Query per ottenere tutte le categorie filtrate per società (lista piatta)
export const getCategoriesByClinic = query({
  args: { 
    userId: v.optional(v.id("users")), // ← OPTIONAL: se presente filtra per società, altrimenti mostra TUTTO (admin)
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    isActive: v.optional(v.boolean())
  },
  handler: async (ctx, { userId, visibility, isActive }) => {
    // Ottieni tutte le categorie
    const allCategories = await ctx.db.query("categories").collect()
    
    let filteredCategories = allCategories;
    
    // 🔓 Se userId è presente → filtra per società dell'utente
    // 🔒 Se userId è assente → mostra TUTTO (logica admin/agent)
    if (userId) {
      // Ottieni società dell'utente
      const userSocieties = await ctx.db
        .query("userSocieties")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      
      const societyIds = userSocieties.map(us => us.societyId);
      
      // Filtra per accesso utente (via società)
      filteredCategories = allCategories.filter(cat => {
        if (!cat.societyIds || cat.societyIds.length === 0) return true;
        return cat.societyIds.some(sid => societyIds.includes(sid));
      });
    }
    
    // Applica filtri
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
    userId: v.optional(v.id("users")) // ← CAMBIATO: filtra per società utente se fornito
  },
  handler: async (ctx, { userId }) => {
    let categories = await ctx.db.query("categories").collect()
    
    // Se userId è fornito, filtra per società utente
    if (userId) {
      const userSocieties = await ctx.db
        .query("userSocieties")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      
      const societyIds = userSocieties.map(us => us.societyId);
      
      categories = categories.filter(cat => {
        if (!cat.societyIds || cat.societyIds.length === 0) return true;
        return cat.societyIds.some(sid => societyIds.includes(sid));
      });
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

// ⚠️ DEPRECATED: Usa getPublicCategoriesByUserSocieties invece
// Query per ottenere categorie pubbliche (per utenti)
export const getPublicCategories = query({
  args: { userId: v.id("users") }, // ← CAMBIATO: usa userId per filtrare società
  handler: async (ctx, { userId }) => {
    // Ottieni società dell'utente
    const userSocieties = await ctx.db
      .query("userSocieties")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const societyIds = userSocieties.map(us => us.societyId);
    
    // Ottieni tutte le categorie pubbliche
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .filter((q) => 
        q.and(
          q.eq(q.field("isActive"), true),
          q.eq(q.field("deletedAt"), undefined)
        )
      )
      .collect()
    
    // Filtra per società
    return categories.filter(cat => {
      if (!cat.societyIds || cat.societyIds.length === 0) return true;
      return cat.societyIds.some(sid => societyIds.includes(sid));
    });
  }
})

// ⚠️ DEPRECATED: Usa getPublicCategoriesByUserSocieties o getCategoryTree invece
// Query per ottenere categorie filtrate per società dell'utente
export const getCategoriesByUserSocieties = query({
  args: { 
    userId: v.id("users"),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    isActive: v.optional(v.boolean())
  },
  handler: async (ctx, { userId, visibility, isActive }) => {
    // Ottieni le società dell'utente
    const userSocieties = await ctx.db
      .query("userSocieties")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const societyIds = userSocieties.map(us => us.societyId);

    // Ottieni tutte le categorie (SENZA filtro clinica)
    let categories = await ctx.db.query("categories").collect();

    // Filtra per visibilità e stato attivo
    let filteredCategories = categories.filter(cat => !cat.deletedAt);
    
    if (visibility) {
      filteredCategories = filteredCategories.filter(cat => cat.visibility === visibility);
    }
    
    if (isActive !== undefined) {
      filteredCategories = filteredCategories.filter(cat => cat.isActive === isActive);
    }

    // Filtra per società: mostra categorie che sono per le società dell'utente 
    // o che non hanno restrizioni di società (societyIds = null)
    filteredCategories = filteredCategories.filter(cat => {
      // Se la categoria non ha societyIds, è visibile a tutti
      if (!cat.societyIds || cat.societyIds.length === 0) {
        return true;
      }
      
      // Altrimenti, controlla se l'utente ha accesso a almeno una delle società della categoria
      return cat.societyIds.some(societyId => societyIds.includes(societyId));
    });

    // Ordina per depth e order
    filteredCategories.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.order - b.order;
    });

    // Popola i dati del dipartimento se presente
    const categoriesWithDepartments = await Promise.all(
      filteredCategories.map(async (category) => {
        const department = category.departmentId 
          ? await ctx.db.get(category.departmentId)
          : null;
        return { ...category, department };
      })
    );

    return categoriesWithDepartments;
  }
});

// 🆕 Query per ottenere categorie pubbliche filtrate per società dell'utente (per creazione ticket)
export const getPublicCategoriesByUserSocieties = query({
  args: { 
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    // Ottieni le società dell'utente
    const userSocieties = await ctx.db
      .query("userSocieties")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const societyIds = userSocieties.map(us => us.societyId);

    // 🆕 Ottieni TUTTE le categorie pubbliche e attive (senza filtro clinica!)
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .filter((q) => 
        q.and(
          q.eq(q.field("isActive"), true),
          q.eq(q.field("deletedAt"), undefined)
        )
      )
      .collect();

    // Filtra per società: mostra categorie che sono per le società dell'utente 
    // o che non hanno restrizioni di società (societyIds = null/empty)
    const filteredCategories = categories.filter(cat => {
      // Se la categoria non ha societyIds, è visibile a TUTTI
      if (!cat.societyIds || cat.societyIds.length === 0) {
        return true;
      }
      
      // Altrimenti, controlla se l'utente ha accesso a almeno una delle società della categoria
      return cat.societyIds.some(societyId => societyIds.includes(societyId));
    });

    // Ordina per nome
    filteredCategories.sort((a, b) => a.name.localeCompare(b.name));

    return filteredCategories;
  }
});

// ⚠️ DEPRECATED: Le categorie non sono più filtrate per clinica
// Query per ottenere tutte le categorie incluse quelle eliminate (per admin)
export const getAllCategoriesByClinic = query({
  args: { 
    userId: v.optional(v.id("users")), // ← CAMBIATO: filtra per società utente se fornito
    includeDeleted: v.optional(v.boolean())
  },
  handler: async (ctx, { userId, includeDeleted = false }) => {
    let categories = await ctx.db.query("categories").collect()
    
    // Se userId è fornito, filtra per società utente
    if (userId) {
      const userSocieties = await ctx.db
        .query("userSocieties")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      
      const societyIds = userSocieties.map(us => us.societyId);
      
      categories = categories.filter(cat => {
        if (!cat.societyIds || cat.societyIds.length === 0) return true;
        return cat.societyIds.some(sid => societyIds.includes(sid));
      });
    }
    
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

// ⚠️ DEPRECATED: Le categorie non sono più filtrate per clinica
// Query per ottenere solo le categorie eliminate (cestino)
export const getDeletedCategories = query({
  args: { userId: v.optional(v.id("users")) }, // ← CAMBIATO: filtra per società utente se fornito
  handler: async (ctx, { userId }) => {
    let categories = await ctx.db
      .query("categories")
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect()
    
    // Se userId è fornito, filtra per società utente
    if (userId) {
      const userSocieties = await ctx.db
        .query("userSocieties")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      
      const societyIds = userSocieties.map(us => us.societyId);
      
      categories = categories.filter(cat => {
        if (!cat.societyIds || cat.societyIds.length === 0) return true;
        return cat.societyIds.some(sid => societyIds.includes(sid));
      });
    }
    
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
    departmentId: v.optional(v.id("departments")),
    visibility: v.union(v.literal("public"), v.literal("private")),
    defaultTicketVisibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    parentId: v.optional(v.id("categories")),
    synonyms: v.optional(v.array(v.string())),
    societyIds: v.optional(v.array(v.id("societies"))), // 🆕 Supporto società
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
    
    // Verifica che il dipartimento esista se fornito
    if (args.departmentId) {
      const department = await ctx.db.get(args.departmentId)
      if (!department) {
        throw new ConvexError("Department not found")
      }
    }
    
    // Verifica che non esista già una categoria con lo stesso slug globalmente
    const existingCategory = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique()
      
    if (existingCategory) {
      throw new ConvexError("A category with this name already exists")
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
        .collect()
      order = rootCategories.length
    }
    
    // Crea la categoria (senza approvazione)
    const categoryId = await ctx.db.insert("categories", {
      name: args.name,
      slug,
      description: args.description,
      departmentId: args.departmentId,
      visibility: args.visibility,
      defaultTicketVisibility: args.defaultTicketVisibility,
      parentId: args.parentId,
      path,
      depth,
      order,
      synonyms: args.synonyms || [],
      requiresApproval: false, // Categorie non richiedono più approvazione (no clinica)
      isActive: true,
      societyIds: args.societyIds || undefined, // 🆕 Supporto società
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
    defaultTicketVisibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    isActive: v.optional(v.boolean()),
    societyIds: v.optional(v.array(v.id("societies"))), // 🆕 Supporto società
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
    }
    
    // Verifica unicità del nome se viene cambiato (globalmente)
    if (updates.name && updates.name !== category.name) {
      const slug = generateSlug(updates.name);
      const existingCategory = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()
        
      if (existingCategory && existingCategory._id !== categoryId) {
        throw new ConvexError("A category with this name already exists")
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

// ⚠️ DEPRECATED: Le categorie non richiedono più approvazione (non sono legate a cliniche)
// Query per ottenere categorie in attesa di approvazione
export const getPendingCategories = query({
  args: { userId: v.optional(v.id("users")) }, // ← CAMBIATO: filtra per società utente se fornito
  handler: async (ctx, { userId }) => {
    let allCategories = await ctx.db
      .query("categories")
      .filter((q) => 
        q.and(
          q.eq(q.field("requiresApproval"), true),
          q.eq(q.field("isActive"), false)
        )
      )
      .collect()
    
    // Se userId è fornito, filtra per società utente
    if (userId) {
      const userSocieties = await ctx.db
        .query("userSocieties")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      
      const societyIds = userSocieties.map(us => us.societyId);
      
      allCategories = allCategories.filter(cat => {
        if (!cat.societyIds || cat.societyIds.length === 0) return true;
        return cat.societyIds.some(sid => societyIds.includes(sid));
      });
    }
    
    // Popola i dati del dipartimento
    const categoriesWithDetails = await Promise.all(
      allCategories.map(async (category) => {
        const department = category.departmentId 
          ? await ctx.db.get(category.departmentId)
          : null
        return { ...category, department }
      })
    )
    
    return categoriesWithDetails
  }
})

// 🔧 Mutation per fixare categorie esistenti senza defaultTicketVisibility
export const fixExistingCategoriesVisibility = mutation({
  handler: async (ctx) => {
    
    const allCategories = await ctx.db.query("categories").collect();
    
    let fixed = 0;
    let alreadyOk = 0;
    
    for (const category of allCategories) {
      // @ts-ignore - Ignoriamo il tipo perché stiamo fixando vecchi dati
      if (category.defaultTicketVisibility === undefined) {
        await ctx.db.patch(category._id, {
          defaultTicketVisibility: "public", // Default a public per categorie esistenti
        });
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

// ⚠️ DEPRECATED: Le categorie non sono più legate alle cliniche
// Mutation per inizializzare le categorie di base (globali per tutte le società)
export const initializeBaseCategories = mutation({
  args: { 
    societyIds: v.optional(v.array(v.id("societies"))) // ← OPZIONALE: se vuoto, categorie globali
  },
  handler: async (ctx, { societyIds }) => {
    // Verifica autenticazione (commentata per test)
    // const currentUser = await getCurrentUser(ctx)
    
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
      
      // Verifica se esiste già
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()
      
      if (existing) {
        console.log(`Categoria ${category.name} già esistente, skip.`);
        continue;
      }
      
      const categoryId = await ctx.db.insert("categories", {
        name: category.name,
        slug,
        description: category.description,
        visibility: "public",
        parentId: undefined, // Categorie root
        path: [],
        depth: 0,
        order: i,
        synonyms: category.synonyms,
        requiresApproval: false,
        isActive: true,
        societyIds: societyIds || undefined, // Se non specificato, categorie globali
      })
      
      categoryIds.push(categoryId)
    }
    
    return {
      message: `Created ${categoryIds.length} base categories`,
      categoryIds
    }
  }
})
