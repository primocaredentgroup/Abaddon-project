import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  // Users table
  users: defineTable({
    email: v.string(),
    name: v.string(),
    clinicId: v.id("clinics"),
    roleId: v.id("roles"),
    auth0Id: v.string(),
    isActive: v.boolean(),
    lastLoginAt: v.optional(v.number()),
    preferences: v.object({
      notifications: v.object({
        email: v.boolean(),
        push: v.boolean(),
      }),
      dashboard: v.object({
        defaultView: v.string(),
        itemsPerPage: v.number(),
      }),
    }),
  })
    .index("by_clinic", ["clinicId"])
    .index("by_auth0", ["auth0Id"])
    .index("by_email", ["email"])
    .index("by_role", ["roleId"]),

  // Clinics table
  clinics: defineTable({
    name: v.string(),
    code: v.string(),
    address: v.string(),
    phone: v.string(),
    email: v.string(),
    settings: v.object({
      allowPublicTickets: v.boolean(),
      requireApprovalForCategories: v.boolean(),
      defaultSlaHours: v.number(),
    }),
    isActive: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"]),

  // Roles table
  roles: defineTable({
    name: v.string(),
    description: v.string(),
    clinicId: v.optional(v.id("clinics")),
    permissions: v.array(v.id("permissions")),
    isSystem: v.boolean(),
  })
    .index("by_clinic", ["clinicId"])
    .index("by_system", ["isSystem"]),

  // Permissions table
  permissions: defineTable({
    resource: v.string(),
    action: v.string(),
    scope: v.union(v.literal("own"), v.literal("clinic"), v.literal("global")),
  })
    .index("by_resource", ["resource"])
    .index("by_resource_action", ["resource", "action"]),

  // Departments table
  departments: defineTable({
    name: v.string(),
    clinicId: v.id("clinics"),
    managerId: v.optional(v.id("users")),
    isActive: v.boolean(),
  })
    .index("by_clinic", ["clinicId"])
    .index("by_manager", ["managerId"]),

  // Categories table
  categories: defineTable({
    name: v.string(),
    slug: v.string(),                  // univoco per ricerca/URL
    description: v.optional(v.string()),
    clinicId: v.id("clinics"),
    departmentId: v.optional(v.id("departments")),
    visibility: v.union(v.literal("public"), v.literal("private")),
    requiresApproval: v.boolean(),
    isActive: v.boolean(),

    // Albero gerarchico
    parentId: v.optional(v.id("categories")), // root = undefined
    path: v.array(v.id("categories")),        // antenati in ordine (per query veloci)
    depth: v.number(),                        // 0=root, 1=child...
    order: v.number(),                        // ordinamento tra siblings

    // AI / metadata per future funzionalità
    synonyms: v.array(v.string()),            // alias/termini simili per NLP
    
    // Soft delete
    deletedAt: v.optional(v.number()),        // timestamp per soft delete
  })
    .index("by_clinic", ["clinicId"])
    .index("by_department", ["departmentId"])
    .index("by_visibility", ["visibility"])
    .index("by_clinic_visibility", ["clinicId", "visibility"])
    .index("by_parent", ["parentId"])
    .index("by_slug", ["clinicId", "slug"])
    .index("by_active", ["isActive"]),

  // Tags table
  tags: defineTable({
    name: v.string(),
    slug: v.string(),                  // univoco per ricerca/URL
    description: v.optional(v.string()),
    clinicId: v.id("clinics"),
    categoryId: v.optional(v.id("categories")), // tag specifico per categoria
    color: v.optional(v.string()),     // colore hex per UI
    isActive: v.boolean(),
    usageCount: v.number(),            // contatore utilizzo
    
    // AI / metadata
    synonyms: v.array(v.string()),     // termini simili per NLP
    aiGenerated: v.boolean(),          // creato da AI o manualmente
  })
    .index("by_clinic", ["clinicId"])
    .index("by_category", ["categoryId"])
    .index("by_slug", ["clinicId", "slug"])
    .index("by_active", ["isActive"])
    .index("by_usage", ["usageCount"]),

  // Ticket-Tag relationships (many-to-many)
  ticketTags: defineTable({
    ticketId: v.id("tickets"),
    tagId: v.id("tags"),
  })
    .index("by_ticket", ["ticketId"])
    .index("by_tag", ["tagId"])
    .index("by_ticket_tag", ["ticketId", "tagId"]),

  // Tickets table - Enhanced with simplified status and polymorphic support
  tickets: defineTable({
    title: v.string(),
    description: v.string(),
    // Simplified status: only 3 states as per requirements
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"), 
      v.literal("closed")
    ),
    categoryId: v.id("categories"),
    clinicId: v.id("clinics"),
    creatorId: v.id("users"),
    assigneeId: v.optional(v.id("users")),
    visibility: v.union(v.literal("public"), v.literal("private")),
    
    // Performance metadata
    lastActivityAt: v.number(),
    attributeCount: v.number(), // for query optimizations
    
    // Legacy fields for backward compatibility
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    )),
    customFields: v.optional(v.any()),
    slaDeadline: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_clinic", ["clinicId"])
    .index("by_creator", ["creatorId"])
    .index("by_assignee", ["assigneeId"])
    .index("by_status", ["status"])
    .index("by_category", ["categoryId"])
    .index("by_clinic_status", ["clinicId", "status"])
    .index("by_assignee_status", ["assigneeId", "status"])
    .index("by_activity", ["lastActivityAt"]),

  // Category Attributes - Dynamic attributes configuration for categories
  categoryAttributes: defineTable({
    categoryId: v.id("categories"),
    name: v.string(),
    slug: v.string(), // for unique identification
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
    order: v.number(),
    
    // Type-specific configuration
    config: v.object({
      placeholder: v.optional(v.string()),
      options: v.optional(v.array(v.string())), // for select/multiselect
      min: v.optional(v.number()), // for number/text length
      max: v.optional(v.number()),
      defaultValue: v.optional(v.any()),
    }),
    
    // Conditions for dynamic visibility
    conditions: v.optional(v.object({
      field: v.string(),
      operator: v.string(),
      value: v.any(),
    })),
    
    clinicId: v.id("clinics"),
    isActive: v.boolean(),
  })
    .index("by_category", ["categoryId"])
    .index("by_clinic", ["clinicId"])
    .index("by_creation", ["categoryId", "showInCreation"])
    .index("by_order", ["categoryId", "order"]),

  // Ticket Attributes - Values for dynamic attributes
  ticketAttributes: defineTable({
    ticketId: v.id("tickets"),
    attributeId: v.id("categoryAttributes"),
    value: v.any(), // Polymorphic value based on attribute type
  })
    .index("by_ticket", ["ticketId"])
    .index("by_attribute", ["attributeId"])
    .index("by_ticket_attribute", ["ticketId", "attributeId"]),

  // Comments table
  comments: defineTable({
    ticketId: v.id("tickets"),
    authorId: v.id("users"),
    content: v.string(),
    isInternal: v.boolean(),
    attachments: v.array(v.string()),
  })
    .index("by_ticket", ["ticketId"])
    .index("by_author", ["authorId"]),

  // Attachments table
  attachments: defineTable({
    ticketId: v.optional(v.id("tickets")),
    commentId: v.optional(v.id("comments")),
    uploaderId: v.id("users"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    storageId: v.string(),
  })
    .index("by_ticket", ["ticketId"])
    .index("by_comment", ["commentId"])
    .index("by_uploader", ["uploaderId"]),

  // Audit logs table
  auditLogs: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
    userId: v.id("users"),
    changes: v.any(),
    metadata: v.optional(v.any()),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_user", ["userId"])
    .index("by_action", ["action"]),

  // SLA rules table
  slaRules: defineTable({
    name: v.string(),
    clinicId: v.id("clinics"),
    conditions: v.any(),
    targetHours: v.number(),
    isActive: v.boolean(),
  })
    .index("by_clinic", ["clinicId"])
    .index("by_active", ["isActive"]),

  // Triggers table
  triggers: defineTable({
    name: v.string(),
    clinicId: v.id("clinics"),
    conditions: v.any(),
    actions: v.any(),
    isActive: v.boolean(),
    requiresApproval: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_clinic", ["clinicId"])
    .index("by_creator", ["createdBy"])
    .index("by_active", ["isActive"]),

  // Macros table
  macros: defineTable({
    name: v.string(),
    clinicId: v.id("clinics"),
    actions: v.any(),
    isActive: v.boolean(),
    requiresApproval: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_clinic", ["clinicId"])
    .index("by_creator", ["createdBy"])
    .index("by_active", ["isActive"]),

  // Presence table - Real-time user presence tracking
  presence: defineTable({
    userId: v.id("users"),
    ticketId: v.optional(v.id("tickets")),
    lastSeen: v.number(),
    isActive: v.boolean(),
    sessionId: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_ticket", ["ticketId"])
    .index("by_user_ticket", ["userId", "ticketId"])
    .index("by_active", ["isActive"])
    .index("by_last_seen", ["lastSeen"]),
})