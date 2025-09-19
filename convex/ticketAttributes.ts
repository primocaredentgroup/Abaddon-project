import { v } from "convex/values"
import { mutation, query, internalMutation } from "./_generated/server"
import { ConvexError } from "convex/values"

// Query to get all attributes for a ticket
export const getByTicket = query({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, { ticketId }) => {
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

    // Get ticket to verify access
    const ticket = await ctx.db.get(ticketId)
    if (!ticket) {
      throw new ConvexError("Ticket not found")
    }

    // Check access permissions
    const hasAccess = 
      ticket.clinicId === user.clinicId && (
        ticket.visibility === 'public' ||
        ticket.creatorId === user._id ||
        ticket.assigneeId === user._id ||
        // TODO: Add role-based access check for agents/admins
        user.roleId // Placeholder for role check
      )

    if (!hasAccess) {
      throw new ConvexError("Access denied")
    }

    // Get ticket attributes with their definitions
    const ticketAttributes = await ctx.db
      .query("ticketAttributes")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .collect()

    // Enrich with attribute definitions
    const enrichedAttributes = await Promise.all(
      ticketAttributes.map(async (ticketAttr) => {
        const attributeDef = await ctx.db.get(ticketAttr.attributeId)
        return {
          ...ticketAttr,
          attribute: attributeDef,
        }
      })
    )

    return enrichedAttributes.filter(attr => attr.attribute?.isActive)
  },
})

// Query to get formatted attributes for display
export const getFormattedByTicket = query({
  args: {
    ticketId: v.id("tickets"),
    showInList: v.optional(v.boolean()),
  },
  handler: async (ctx, { ticketId, showInList }) => {
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

    // Get ticket to verify access
    const ticket = await ctx.db.get(ticketId)
    if (!ticket || ticket.clinicId !== user.clinicId) {
      throw new ConvexError("Ticket not found or access denied")
    }

    // Get ticket attributes
    const ticketAttributes = await ctx.db
      .query("ticketAttributes")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .collect()

    // Get attribute definitions and format values
    const formattedAttributes = await Promise.all(
      ticketAttributes.map(async (ticketAttr) => {
        const attributeDef = await ctx.db.get(ticketAttr.attributeId)
        
        if (!attributeDef?.isActive) return null
        
        // Filter by showInList if specified
        if (showInList !== undefined && attributeDef.showInList !== showInList) {
          return null
        }

        const formattedValue = formatAttributeValue(attributeDef, ticketAttr.value)

        return {
          id: ticketAttr._id,
          attributeId: attributeDef._id,
          name: attributeDef.name,
          type: attributeDef.type,
          value: ticketAttr.value,
          formattedValue,
          order: attributeDef.order,
        }
      })
    )

    // Filter out null values and sort by order
    return formattedAttributes
      .filter(attr => attr !== null)
      .sort((a, b) => a!.order - b!.order)
  },
})

// Mutation to set ticket attributes (bulk operation)
export const setTicketAttributes = mutation({
  args: {
    ticketId: v.id("tickets"),
    attributes: v.any(), // Record<string, any> - slug to value mapping
  },
  handler: async (ctx, { ticketId, attributes }) => {
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

    // Get ticket to verify access
    const ticket = await ctx.db.get(ticketId)
    if (!ticket || ticket.clinicId !== user.clinicId) {
      throw new ConvexError("Ticket not found or access denied")
    }

    // Get category attributes to validate and map slugs to IDs
    const categoryAttributes = await ctx.db
      .query("categoryAttributes")
      .withIndex("by_category", (q) => q.eq("categoryId", ticket.categoryId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

    const attributeMap = new Map(categoryAttributes.map(attr => [attr.slug, attr]))

    // Validate attributes using the validation function
    const validationErrors = await ctx.runMutation("categoryAttributes:validateTicketAttributes", {
      categoryId: ticket.categoryId,
      attributes,
    })

    if (validationErrors.length > 0) {
      throw new ConvexError(`Validation errors: ${validationErrors.map(e => e.message).join(', ')}`)
    }

    // Get existing ticket attributes
    const existingAttributes = await ctx.db
      .query("ticketAttributes")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .collect()

    const existingAttributeMap = new Map(
      existingAttributes.map(attr => [attr.attributeId, attr])
    )

    let updatedCount = 0

    // Process each attribute
    for (const [slug, value] of Object.entries(attributes)) {
      const attributeDef = attributeMap.get(slug)
      if (!attributeDef) continue // Skip unknown attributes

      const existingAttribute = existingAttributeMap.get(attributeDef._id)

      if (value === undefined || value === null || value === '') {
        // Delete existing attribute if value is empty
        if (existingAttribute) {
          await ctx.db.delete(existingAttribute._id)
          updatedCount++
        }
      } else {
        // Update or create attribute
        if (existingAttribute) {
          await ctx.db.patch(existingAttribute._id, { value })
        } else {
          await ctx.db.insert("ticketAttributes", {
            ticketId,
            attributeId: attributeDef._id,
            value,
          })
        }
        updatedCount++
      }
    }

    // Update ticket's attribute count and last activity
    await ctx.db.patch(ticketId, {
      attributeCount: await getTicketAttributeCount(ctx, ticketId),
      lastActivityAt: Date.now(),
    })

    return { updatedCount }
  },
})

// Mutation to update a single ticket attribute
export const updateAttribute = mutation({
  args: {
    ticketId: v.id("tickets"),
    attributeSlug: v.string(),
    value: v.any(),
  },
  handler: async (ctx, { ticketId, attributeSlug, value }) => {
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

    // Get ticket to verify access
    const ticket = await ctx.db.get(ticketId)
    if (!ticket || ticket.clinicId !== user.clinicId) {
      throw new ConvexError("Ticket not found or access denied")
    }

    // Find the attribute definition
    const attributeDef = await ctx.db
      .query("categoryAttributes")
      .withIndex("by_category", (q) => q.eq("categoryId", ticket.categoryId))
      .filter((q) => q.eq(q.field("slug"), attributeSlug))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first()

    if (!attributeDef) {
      throw new ConvexError("Attribute not found")
    }

    // Validate single attribute
    const validationErrors = await ctx.runMutation("categoryAttributes:validateTicketAttributes", {
      categoryId: ticket.categoryId,
      attributes: { [attributeSlug]: value },
    })

    if (validationErrors.length > 0) {
      throw new ConvexError(validationErrors[0].message)
    }

    // Find existing ticket attribute
    const existingAttribute = await ctx.db
      .query("ticketAttributes")
      .withIndex("by_ticket_attribute", (q) => 
        q.eq("ticketId", ticketId).eq("attributeId", attributeDef._id)
      )
      .first()

    if (value === undefined || value === null || value === '') {
      // Delete if exists and value is empty
      if (existingAttribute) {
        await ctx.db.delete(existingAttribute._id)
      }
    } else {
      // Update or create
      if (existingAttribute) {
        await ctx.db.patch(existingAttribute._id, { value })
      } else {
        await ctx.db.insert("ticketAttributes", {
          ticketId,
          attributeId: attributeDef._id,
          value,
        })
      }
    }

    // Update ticket metadata
    await ctx.db.patch(ticketId, {
      attributeCount: await getTicketAttributeCount(ctx, ticketId),
      lastActivityAt: Date.now(),
    })

    return { success: true }
  },
})

// Internal mutation to bulk delete attributes for a ticket
export const deleteByTicket = internalMutation({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, { ticketId }) => {
    const attributes = await ctx.db
      .query("ticketAttributes")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
      .collect()

    for (const attribute of attributes) {
      await ctx.db.delete(attribute._id)
    }

    return { deletedCount: attributes.length }
  },
})

// Helper function to get ticket attribute count
async function getTicketAttributeCount(ctx: any, ticketId: string): Promise<number> {
  const attributes = await ctx.db
    .query("ticketAttributes")
    .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
    .collect()

  return attributes.length
}

// Helper function to format attribute value for display
function formatAttributeValue(attributeDef: any, value: any): string {
  if (value === undefined || value === null) return ''

  switch (attributeDef.type) {
    case 'text':
      return String(value)
    
    case 'number':
      const unit = attributeDef.config.unit || ''
      return `${value}${unit ? ' ' + unit : ''}`
    
    case 'date':
      const date = new Date(value)
      return date.toLocaleDateString('it-IT')
    
    case 'select':
      return String(value)
    
    case 'multiselect':
      return Array.isArray(value) ? value.join(', ') : String(value)
    
    case 'boolean':
      const trueLabel = attributeDef.config.trueLabel || 'Sì'
      const falseLabel = attributeDef.config.falseLabel || 'No'
      return value ? trueLabel : falseLabel
    
    default:
      return String(value)
  }
}


