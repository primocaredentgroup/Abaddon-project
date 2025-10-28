import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { ConvexError } from "convex/values"
import { getCurrentUser } from "./lib/utils"

// Query per ottenere tutti i dipartimenti di una clinica
export const getDepartmentsByClinic = query({
  args: { 
    clinicId: v.id("clinics"),
    isActive: v.optional(v.boolean())
  },
  handler: async (ctx, { clinicId, isActive }) => {
    let query = ctx.db
      .query("departments")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
    
    const departments = await query.collect()
    
    // Filtra per stato attivo se specificato
    const filteredDepartments = isActive !== undefined 
      ? departments.filter(dept => dept.isActive === isActive)
      : departments
    
    // Popola i dati del manager se presente
    const departmentsWithManagers = await Promise.all(
      filteredDepartments.map(async (department) => {
        const manager = department.managerId 
          ? await ctx.db.get(department.managerId)
          : null
        return { ...department, manager }
      })
    )
    
    return departmentsWithManagers
  }
})

// Query per ottenere tutti i dipartimenti
export const list = query({
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

    if (!user.clinicId) {
      throw new ConvexError("User has no clinic assigned")
    }

    // Get all departments for the user's clinic
    const departments = await ctx.db
      .query("departments")
      .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId!))
      .collect()

    // Filter only active departments
    const activeDepartments = departments.filter(dept => dept.isActive)

    // Enrich with manager data
    const departmentsWithManagers = await Promise.all(
      activeDepartments.map(async (department) => {
        const manager = department.managerId 
          ? await ctx.db.get(department.managerId)
          : null
        return { ...department, manager }
      })
    )

    return departmentsWithManagers
  }
})

// Query per ottenere un dipartimento per ID
export const getDepartmentById = query({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, { departmentId }) => {
    const department = await ctx.db.get(departmentId)
    if (!department) {
      throw new ConvexError("Department not found")
    }
    
    // Popola i dati del manager e della clinica
    const [manager, clinic] = await Promise.all([
      department.managerId ? ctx.db.get(department.managerId) : null,
      ctx.db.get(department.clinicId)
    ])
    
    return { ...department, manager, clinic }
  }
})

// Mutation per creare un nuovo dipartimento
export const createDepartment = mutation({
  args: {
    name: v.string(),
    clinicId: v.id("clinics"),
    managerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Validazioni
    if (args.name.length < 2) {
      throw new ConvexError("Department name must be at least 2 characters long")
    }
    
    // Verifica che la clinica esista
    const clinic = await ctx.db.get(args.clinicId)
    if (!clinic) {
      throw new ConvexError("Clinic not found")
    }
    
    // Verifica che il manager esista e appartenga alla stessa clinica se fornito
    if (args.managerId) {
      const manager = await ctx.db.get(args.managerId)
      if (!manager) {
        throw new ConvexError("Manager not found")
      }
      
      if (manager.clinicId !== args.clinicId) {
        throw new ConvexError("Manager does not belong to the specified clinic")
      }
    }
    
    // Verifica che non esista già un dipartimento con lo stesso nome nella clinica
    const existingDepartment = await ctx.db
      .query("departments")
      .withIndex("by_clinic", (q) => q.eq("clinicId", args.clinicId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .unique()
      
    if (existingDepartment) {
      throw new ConvexError("A department with this name already exists in this clinic")
    }
    
    // Crea il dipartimento
    const departmentId = await ctx.db.insert("departments", {
      name: args.name,
      clinicId: args.clinicId,
      managerId: args.managerId,
      isActive: true,
    })
    
    return departmentId
  }
})

// Mutation per aggiornare un dipartimento
export const updateDepartment = mutation({
  args: {
    departmentId: v.id("departments"),
    name: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { departmentId, ...updates }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che il dipartimento esista
    const department = await ctx.db.get(departmentId)
    if (!department) {
      throw new ConvexError("Department not found")
    }
    
    // Validazioni
    if (updates.name && updates.name.length < 2) {
      throw new ConvexError("Department name must be at least 2 characters long")
    }
    
    // Verifica che il manager esista e appartenga alla stessa clinica se fornito
    if (updates.managerId) {
      const manager = await ctx.db.get(updates.managerId)
      if (!manager) {
        throw new ConvexError("Manager not found")
      }
      
      if (manager.clinicId !== department.clinicId) {
        throw new ConvexError("Manager does not belong to the same clinic")
      }
    }
    
    // Verifica unicità del nome se viene cambiato
    if (updates.name && updates.name !== department.name) {
      const existingDepartment = await ctx.db
        .query("departments")
        .withIndex("by_clinic", (q) => q.eq("clinicId", department.clinicId))
        .filter((q) => q.eq(q.field("name"), updates.name))
        .unique()
        
      if (existingDepartment) {
        throw new ConvexError("A department with this name already exists in this clinic")
      }
    }
    
    // Aggiorna il dipartimento
    await ctx.db.patch(departmentId, updates)
    
    return departmentId
  }
})

// Mutation per eliminare un dipartimento
export const deleteDepartment = mutation({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, { departmentId }) => {
    // Verifica autenticazione
    const currentUser = await getCurrentUser(ctx)
    
    // Verifica che il dipartimento esista
    const department = await ctx.db.get(departmentId)
    if (!department) {
      throw new ConvexError("Department not found")
    }
    
    // Verifica che non ci siano categorie associate a questo dipartimento
    const categoriesWithDepartment = await ctx.db
      .query("categories")
      .withIndex("by_department", (q) => q.eq("departmentId", departmentId))
      .collect()
      
    if (categoriesWithDepartment.length > 0) {
      throw new ConvexError("Cannot delete department: there are categories associated with it")
    }
    
    // Elimina il dipartimento
    await ctx.db.delete(departmentId)
    
    return departmentId
  }
})

// Query per ottenere statistiche di un dipartimento
export const getDepartmentStats = query({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, { departmentId }) => {
    // Verifica che il dipartimento esista
    const department = await ctx.db.get(departmentId)
    if (!department) {
      throw new ConvexError("Department not found")
    }
    
    // Conta categorie del dipartimento
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_department", (q) => q.eq("departmentId", departmentId))
      .collect()
    
    const activeCategories = categories.filter(cat => cat.isActive)
    
    // Conta ticket delle categorie del dipartimento
    let totalTickets = 0
    for (const category of categories) {
      const tickets = await ctx.db
        .query("tickets")
        .withIndex("by_category", (q) => q.eq("categoryId", category._id))
        .collect()
      totalTickets += tickets.length
    }
    
    return {
      totalCategories: categories.length,
      activeCategories: activeCategories.length,
      totalTickets,
    }
  }
})
