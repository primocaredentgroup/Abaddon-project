import { v } from "convex/values"
import { mutation, query, internalMutation } from "./_generated/server"
import { ConvexError } from "convex/values"

// 🔓 VERSIONE SIMPLE per sviluppo (senza autenticazione)
export const getByCategorySimple = query({
  args: {
    categoryId: v.id("categories"),
    showInCreation: v.optional(v.boolean()),
    showInList: v.optional(v.boolean()),
  },
  handler: async (ctx, { categoryId, showInCreation, showInList }) => {
    let query = ctx.db
      .query("categoryAttributes")
      .withIndex("by_category", (q) => q.eq("categoryId", categoryId))
      .filter((q) => q.eq(q.field("isActive"), true))

    // Apply filters if provided
    if (showInCreation !== undefined) {
      query = query.filter((q) => q.eq(q.field("showInCreation"), showInCreation))
    }

    if (showInList !== undefined) {
      query = query.filter((q) => q.eq(q.field("showInList"), showInList))
    }

    const attributes = await query.collect()

    // Sort by order
    return attributes.sort((a, b) => a.order - b.order)
  },
})

// Query to get attributes for a category
export const getByCategory = query({
  args: {
    categoryId: v.id("categories"),
    showInCreation: v.optional(v.boolean()),
    showInList: v.optional(v.boolean()),
  },
  handler: async (ctx, { categoryId, showInCreation, showInList }) => {
    // Check if user has access to this category
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    // Get user to check clinic access
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError("User not found")
    }

    // Get category to verify clinic access
    const category = await ctx.db.get(categoryId)
    if (!category || category.clinicId !== user.clinicId) {
      throw new ConvexError("Category not found or access denied")
    }

    let query = ctx.db
      .query("categoryAttributes")
      .withIndex("by_category", (q) => q.eq("categoryId", categoryId))
      .filter((q) => q.eq(q.field("isActive"), true))

    // Apply filters if provided
    if (showInCreation !== undefined) {
      query = query.filter((q) => q.eq(q.field("showInCreation"), showInCreation))
    }

    if (showInList !== undefined) {
      query = query.filter((q) => q.eq(q.field("showInList"), showInList))
    }

    const attributes = await query.collect()

    // Sort by order
    return attributes.sort((a, b) => a.order - b.order)
  },
})

// Query to get all attributes for a clinic (admin use)
export const getByClinic = query({
  args: {
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, { clinicId }) => {
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

    // Use provided clinicId or user's clinic
    const targetClinicId = clinicId || user.clinicId

    // Check if user has access to this clinic
    if (targetClinicId !== user.clinicId) {
      // TODO: Add role-based permission check for cross-clinic access
      throw new ConvexError("Access denied")
    }

    return await ctx.db
      .query("categoryAttributes")
      .withIndex("by_clinic", (q) => q.eq("clinicId", targetClinicId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()
  },
})

// Mutation to create a new category attribute
export const create = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
    slug: v.string(),
    type: v.union(
      v.literal("text"),
      v.literal("number"),
      v.literal("date"),
      v.literal("select"),
      v.literal("multiselect"),
      v.literal("boolean")
    ),
    required: v.boolean(),
    showInCreation: v.boolean(),
    showInList: v.boolean(),
    agentOnly: v.optional(v.boolean()),
    order: v.number(),
    config: v.object({
      placeholder: v.optional(v.string()),
      options: v.optional(v.array(v.string())),
      min: v.optional(v.number()),
      max: v.optional(v.number()),
      defaultValue: v.optional(v.any()),
    }),
    conditions: v.optional(v.object({
      field: v.string(),
      operator: v.string(),
      value: v.any(),
    })),
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

    // Get category to verify access
    const category = await ctx.db.get(args.categoryId)
    if (!category || category.clinicId !== user.clinicId) {
      throw new ConvexError("Category not found or access denied")
    }

    // Check if slug is unique within category
    const existingAttribute = await ctx.db
      .query("categoryAttributes")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .filter((q) => q.eq(q.field("slug"), args.slug))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first()

    if (existingAttribute) {
      throw new ConvexError("Attribute with this slug already exists in category")
    }

    // Validate configuration based on type
    const validationError = validateAttributeConfig(args.type, args.config)
    if (validationError) {
      throw new ConvexError(validationError)
    }

    // Create the attribute
    const attributeId = await ctx.db.insert("categoryAttributes", {
      ...args,
      clinicId: user.clinicId,
      isActive: true,
    })

    return attributeId
  },
})

// Mutation to update a category attribute
export const update = mutation({
  args: {
    attributeId: v.id("categoryAttributes"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("text"),
      v.literal("number"),
      v.literal("date"),
      v.literal("select"),
      v.literal("multiselect"),
      v.literal("boolean")
    )),
    required: v.optional(v.boolean()),
    showInCreation: v.optional(v.boolean()),
    showInList: v.optional(v.boolean()),
    agentOnly: v.optional(v.boolean()),
    order: v.optional(v.number()),
    config: v.optional(v.object({
      placeholder: v.optional(v.string()),
      options: v.optional(v.array(v.string())),
      min: v.optional(v.number()),
      max: v.optional(v.number()),
      defaultValue: v.optional(v.any()),
    })),
    conditions: v.optional(v.object({
      field: v.string(),
      operator: v.string(),
      value: v.any(),
    })),
  },
  handler: async (ctx, { attributeId, ...updates }) => {
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

    // Get attribute to verify access
    const attribute = await ctx.db.get(attributeId)
    if (!attribute || attribute.clinicId !== user.clinicId) {
      throw new ConvexError("Attribute not found or access denied")
    }

    // If slug is being updated, check uniqueness
    if (updates.slug && updates.slug !== attribute.slug) {
      const existingAttribute = await ctx.db
        .query("categoryAttributes")
        .withIndex("by_category", (q) => q.eq("categoryId", attribute.categoryId))
        .filter((q) => q.eq(q.field("slug"), updates.slug))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first()

      if (existingAttribute && existingAttribute._id !== attributeId) {
        throw new ConvexError("Attribute with this slug already exists in category")
      }
    }

    // Validate configuration if type or config is being updated
    const newType = updates.type || attribute.type
    const newConfig = updates.config || attribute.config
    const validationError = validateAttributeConfig(newType, newConfig)
    if (validationError) {
      throw new ConvexError(validationError)
    }

    // Update the attribute
    await ctx.db.patch(attributeId, updates)

    return attributeId
  },
})

// Mutation to delete (deactivate) a category attribute
export const remove = mutation({
  args: {
    attributeId: v.id("categoryAttributes"),
  },
  handler: async (ctx, { attributeId }) => {
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

    // Get attribute to verify access
    const attribute = await ctx.db.get(attributeId)
    if (!attribute || attribute.clinicId !== user.clinicId) {
      throw new ConvexError("Attribute not found or access denied")
    }

    // Soft delete by setting isActive to false
    await ctx.db.patch(attributeId, { isActive: false })

    return attributeId
  },
})

// Internal mutation for dynamic validation
export const validateTicketAttributes = internalMutation({
  args: {
    categoryId: v.id("categories"),
    attributes: v.any(),
  },
  handler: async (ctx, { categoryId, attributes }) => {
    const categoryAttributes = await ctx.db
      .query("categoryAttributes")
      .withIndex("by_category", (q) => q.eq("categoryId", categoryId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

    const errors: { field: string; message: string }[] = []

    for (const attr of categoryAttributes) {
      const value = attributes[attr.slug]

      // Check required fields
      if (attr.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: attr.slug,
          message: `${attr.name} è obbligatorio`,
        })
        continue
      }

      // Type-specific validation
      if (value !== undefined && value !== null) {
        const typeError = validateAttributeType(attr, value)
        if (typeError) {
          errors.push({
            field: attr.slug,
            message: typeError,
          })
        }
      }
    }

    return errors
  },
})

// Helper function to validate attribute configuration
function validateAttributeConfig(type: string, config: any): string | null {
  switch (type) {
    case 'select':
    case 'multiselect':
      if (!config.options || !Array.isArray(config.options) || config.options.length === 0) {
        return 'Options are required for select/multiselect fields'
      }
      break
    case 'number':
      if (config.min !== undefined && config.max !== undefined && config.min > config.max) {
        return 'Min value cannot be greater than max value'
      }
      break
    case 'text':
      if (config.min !== undefined && config.max !== undefined && config.min > config.max) {
        return 'Min length cannot be greater than max length'
      }
      break
  }
  return null
}

// Helper function to validate attribute value based on type
function validateAttributeType(attribute: any, value: any): string | null {
  switch (attribute.type) {
    case 'text':
      if (typeof value !== 'string') return 'Deve essere un testo'
      if (attribute.config.min && value.length < attribute.config.min) {
        return `Minimo ${attribute.config.min} caratteri`
      }
      if (attribute.config.max && value.length > attribute.config.max) {
        return `Massimo ${attribute.config.max} caratteri`
      }
      break

    case 'number':
      const num = Number(value)
      if (isNaN(num)) return 'Deve essere un numero'
      if (attribute.config.min !== undefined && num < attribute.config.min) {
        return `Valore minimo: ${attribute.config.min}`
      }
      if (attribute.config.max !== undefined && num > attribute.config.max) {
        return `Valore massimo: ${attribute.config.max}`
      }
      break

    case 'date':
      if (typeof value !== 'string' && typeof value !== 'number') {
        return 'Deve essere una data valida'
      }
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        return 'Deve essere una data valida'
      }
      break

    case 'select':
      if (!attribute.config.options?.includes(value)) {
        return 'Valore non valido'
      }
      break

    case 'multiselect':
      if (!Array.isArray(value)) return 'Deve essere una lista'
      const invalidOptions = value.filter(v => !attribute.config.options?.includes(v))
      if (invalidOptions.length > 0) {
        return 'Contiene valori non validi'
      }
      if (attribute.config.minSelections && value.length < attribute.config.minSelections) {
        return `Seleziona almeno ${attribute.config.minSelections} opzioni`
      }
      if (attribute.config.maxSelections && value.length > attribute.config.maxSelections) {
        return `Seleziona al massimo ${attribute.config.maxSelections} opzioni`
      }
      break

    case 'boolean':
      if (typeof value !== 'boolean') return 'Deve essere vero o falso'
      break
  }

  return null
}

// Query to evaluate conditions for dynamic visibility
export const evaluateConditions = query({
  args: {
    categoryId: v.id("categories"),
    formData: v.any(),
  },
  handler: async (ctx, { categoryId, formData }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    const attributes = await ctx.db
      .query("categoryAttributes")
      .withIndex("by_category", (q) => q.eq("categoryId", categoryId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

    const visibleAttributes = attributes.filter(attr => {
      if (!attr.conditions) return true
      
      const fieldValue = formData[attr.conditions.field]
      return evaluateCondition(fieldValue, attr.conditions)
    })

    return visibleAttributes.sort((a, b) => a.order - b.order)
  },
})

// Helper function to evaluate a single condition
function evaluateCondition(fieldValue: any, condition: any): boolean {
  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value
    case 'not_equals':
      return fieldValue !== condition.value
    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(condition.value)
    case 'greater_than':
      return Number(fieldValue) > Number(condition.value)
    case 'less_than':
      return Number(fieldValue) < Number(condition.value)
    default:
      return true
  }
}
// =================== VERSIONI SIMPLE (senza autenticazione) per sviluppo ===================

// 🔓 VERSIONE SIMPLE di create (senza autenticazione)
export const createSimple = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
    slug: v.string(),
    type: v.union(
      v.literal("text"),
      v.literal("number"),
      v.literal("date"),
      v.literal("select"),
      v.literal("multiselect"),
      v.literal("boolean")
    ),
    required: v.boolean(),
    showInCreation: v.boolean(),
    showInList: v.boolean(),
    agentOnly: v.optional(v.boolean()),
    order: v.number(),
    config: v.object({
      placeholder: v.optional(v.string()),
      options: v.optional(v.array(v.string())),
      min: v.optional(v.number()),
      max: v.optional(v.number()),
      defaultValue: v.optional(v.any()),
    }),
    conditions: v.optional(v.object({
      field: v.string(),
      operator: v.string(),
      value: v.any(),
    })),
  },
  handler: async (ctx, args) => {
    console.log('🆕 [createSimple] Creating attribute:', args.name, 'for category:', args.categoryId)

    // Get category to get clinicId
    const category = await ctx.db.get(args.categoryId)
    if (!category) {
      throw new ConvexError("Category not found")
    }

    // Check if slug is unique within category
    const existingAttribute = await ctx.db
      .query("categoryAttributes")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .filter((q) => q.eq(q.field("slug"), args.slug))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first()

    if (existingAttribute) {
      throw new ConvexError("Attribute with this slug already exists in category")
    }

    // Validate configuration based on type
    const validationError = validateAttributeConfig(args.type, args.config)
    if (validationError) {
      throw new ConvexError(validationError)
    }

    // Create the attribute
    const attributeId = await ctx.db.insert("categoryAttributes", {
      ...args,
      clinicId: category.clinicId,
      isActive: true,
    })

    console.log('✅ [createSimple] Attribute created:', attributeId)
    return attributeId
  },
})

// 🔓 VERSIONE SIMPLE di update (senza autenticazione)
export const updateSimple = mutation({
  args: {
    attributeId: v.id("categoryAttributes"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("text"),
      v.literal("number"),
      v.literal("date"),
      v.literal("select"),
      v.literal("multiselect"),
      v.literal("boolean")
    )),
    required: v.optional(v.boolean()),
    showInCreation: v.optional(v.boolean()),
    showInList: v.optional(v.boolean()),
    agentOnly: v.optional(v.boolean()),
    order: v.optional(v.number()),
    config: v.optional(v.object({
      placeholder: v.optional(v.string()),
      options: v.optional(v.array(v.string())),
      min: v.optional(v.number()),
      max: v.optional(v.number()),
      defaultValue: v.optional(v.any()),
    })),
    conditions: v.optional(v.object({
      field: v.string(),
      operator: v.string(),
      value: v.any(),
    })),
  },
  handler: async (ctx, { attributeId, ...updates }) => {
    console.log('📝 [updateSimple] Updating attribute:', attributeId)

    // Get attribute
    const attribute = await ctx.db.get(attributeId)
    if (!attribute) {
      throw new ConvexError("Attribute not found")
    }

    // If slug is being updated, check uniqueness
    if (updates.slug && updates.slug !== attribute.slug) {
      const existingAttribute = await ctx.db
        .query("categoryAttributes")
        .withIndex("by_category", (q) => q.eq("categoryId", attribute.categoryId))
        .filter((q) => q.eq(q.field("slug"), updates.slug))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first()

      if (existingAttribute && existingAttribute._id !== attributeId) {
        throw new ConvexError("Attribute with this slug already exists in category")
      }
    }

    // Validate configuration if type or config is being updated
    const newType = updates.type || attribute.type
    const newConfig = updates.config || attribute.config
    const validationError = validateAttributeConfig(newType, newConfig)
    if (validationError) {
      throw new ConvexError(validationError)
    }

    // Update the attribute
    await ctx.db.patch(attributeId, updates)

    console.log('✅ [updateSimple] Attribute updated:', attributeId)
    return attributeId
  },
})

// 🔓 VERSIONE SIMPLE di remove (senza autenticazione)
export const removeSimple = mutation({
  args: {
    attributeId: v.id("categoryAttributes"),
  },
  handler: async (ctx, { attributeId }) => {
    console.log('🗑️ [removeSimple] Removing attribute:', attributeId)

    // Get attribute
    const attribute = await ctx.db.get(attributeId)
    if (!attribute) {
      throw new ConvexError("Attribute not found")
    }

    // Soft delete by setting isActive to false
    await ctx.db.patch(attributeId, { isActive: false })

    console.log('✅ [removeSimple] Attribute removed:', attributeId)
    return attributeId
  },
})

