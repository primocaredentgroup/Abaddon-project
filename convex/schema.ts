import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  // Users table
  users: defineTable({
    email: v.string(),
    name: v.string(),
    clinicId: v.id("clinics"), // Clinica principale (backward compatibility)
    roleId: v.id("roles"),
    auth0Id: v.string(),
    isActive: v.boolean(),
    lastLoginAt: v.optional(v.number()),
    categoryCompetencies: v.optional(v.array(v.id("categories"))), // Categorie di competenza per agenti
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

  // User-Clinic relationships (many-to-many) - NUOVA TABELLA
  userClinics: defineTable({
    userId: v.id("users"),
    clinicId: v.id("clinics"),
    role: v.union(v.literal("user"), v.literal("agent"), v.literal("admin")), // Ruolo specifico per questa clinica
    isActive: v.boolean(),
    joinedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_clinic", ["clinicId"])
    .index("by_user_clinic", ["userId", "clinicId"])
    .index("by_clinic_role", ["clinicId", "role"]),

  // Clinics table
  clinics: defineTable({
    name: v.string(),
    code: v.string(),
    address: v.string(),
    phone: v.string(),
    email: v.string(),
    externalClinicId: v.optional(v.string()), // ID della clinica dal sistema esterno
    lastSyncAt: v.optional(v.number()), // Timestamp ultima sincronizzazione
    settings: v.object({
      allowPublicTickets: v.boolean(),
      requireApprovalForCategories: v.boolean(),
      defaultSlaHours: v.number(),
    }),
    isActive: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"])
    .index("by_external_id", ["externalClinicId"]),

  // Roles table
  roles: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    clinicId: v.optional(v.id("clinics")),
    permissions: v.array(v.string()), // Cambiato da v.id("permissions") a v.string() per semplicità
    isSystem: v.optional(v.boolean()),
    isActive: v.boolean(),
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
    
    // 🆕 Visibilità di default per i ticket creati in questa categoria
    defaultTicketVisibility: v.optional(v.union(v.literal("public"), v.literal("private"))), // Default: "public"

    // Albero gerarchico
    parentId: v.optional(v.id("categories")), // root = undefined
    path: v.array(v.id("categories")),        // antenati in ordine (per query veloci)
    depth: v.number(),                        // 0=root, 1=child...
    order: v.number(),                        // ordinamento tra siblings

    // AI / metadata per future funzionalità
    synonyms: v.array(v.string()),            // alias/termini simili per NLP
    
    // Soft delete
    deletedAt: v.optional(v.number()),        // timestamp per soft delete
    
    // 🆕 Società support - se null, la categoria è visibile a tutte le società
    societyIds: v.optional(v.array(v.id("societies"))), // Array di società per cui questa categoria è visibile
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

  // Ticket Statuses - Gestione dinamica degli stati dei ticket
  ticketStatuses: defineTable({
    name: v.string(), // Nome visualizzato (es. "Aperto", "In Corso")
    slug: v.string(), // Slug univoco (es. "open", "in_progress")
    description: v.optional(v.string()),
    color: v.string(), // Colore hex per UI (es. "#22c55e")
    icon: v.optional(v.string()), // Nome icona opzionale
    order: v.number(), // Ordine di visualizzazione
    isSystem: v.boolean(), // true per stati di default (non eliminabili)
    isActive: v.boolean(), // false per stati disabilitati
    isFinal: v.boolean(), // true per stati che indicano ticket chiusi/completati
  })
    .index("by_slug", ["slug"])
    .index("by_order", ["order"])
    .index("by_active", ["isActive"]),

  // Tickets table - Enhanced with simplified status and polymorphic support
  tickets: defineTable({
    title: v.string(),
    description: v.string(),
    // Status come string per supportare stati dinamici
    status: v.string(), // Ora usa slug da ticketStatuses
    ticketNumber: v.optional(v.number()), // Numero incrementale tipo #1234 - opzionale per compatibilità
    categoryId: v.id("categories"),
    clinicId: v.id("clinics"),
    departmentId: v.optional(v.id("departments")),
    creatorId: v.id("users"),
    assigneeId: v.optional(v.id("users")),
    visibility: v.union(v.literal("public"), v.literal("private")),
    
    // Sistema solleciti
    nudgeCount: v.optional(v.number()), // Quante volte è stato sollecitato
    lastNudgeAt: v.optional(v.number()), // Quando è stato sollecitato l'ultima volta
    lastNudgeBy: v.optional(v.id("users")), // Chi ha fatto l'ultimo sollecito
    
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
    .index("by_ticket_number", ["ticketNumber"]) // Per ricerca rapida per numero
    .index("by_clinic_ticket_number", ["clinicId", "ticketNumber"]) // Per ricerca in clinica specifica
    .index("by_clinic_status", ["clinicId", "status"])
    .index("by_last_nudge", ["lastNudgeAt"]) // Per trovare ticket sollecitati recentemente
    .index("by_assignee_status", ["assigneeId", "status"])
    .index("by_department", ["departmentId"])
    .index("by_activity", ["lastActivityAt"]),

  // Counters - Per gestire numeri incrementali (ticket numbers, etc.)
  counters: defineTable({
    name: v.string(), // "tickets", "invoices", ecc.
    clinicId: v.optional(v.id("clinics")), // undefined = contatore globale, altrimenti per clinica specifica
    currentValue: v.number(), // Numero corrente (ultimo usato)
  })
    .index("by_clinic_name", ["clinicId", "name"]) // Per trovare rapidamente il contatore
    .index("by_name", ["name"]), // Per contatori globali

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
    requiresApproval: v.optional(v.boolean()),
    isApproved: v.optional(v.boolean()),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    rejectedBy: v.optional(v.id("users")),
    rejectedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
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
    isApproved: v.optional(v.boolean()), // Se il trigger è stato approvato
    approvedBy: v.optional(v.id("users")), // Chi ha approvato
    approvedAt: v.optional(v.number()), // Quando è stato approvato
    rejectedBy: v.optional(v.id("users")), // Chi ha rifiutato
    rejectedAt: v.optional(v.number()), // Quando è stato rifiutato
    rejectionReason: v.optional(v.string()), // Motivo del rifiuto
    createdBy: v.id("users"),
    
    // 🆕 Società support - se null, il trigger si applica a tutte le società
    societyIds: v.optional(v.array(v.id("societies"))), // Array di società per cui questo trigger è applicabile
  })
    .index("by_clinic", ["clinicId"])
    .index("by_creator", ["createdBy"])
    .index("by_active", ["isActive"]),

  // Macros table
  macros: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    clinicId: v.id("clinics"),
    category: v.string(), // Slug della categoria (es. "prescrizioni", "password-dimenticata")
    actions: v.any(), // Array di azioni da eseguire
    isActive: v.boolean(),
    requiresApproval: v.boolean(),
    isApproved: v.optional(v.boolean()),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    rejectedBy: v.optional(v.id("users")),
    rejectedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_clinic", ["clinicId"])
    .index("by_creator", ["createdBy"])
    .index("by_active", ["isActive"])
    .index("by_clinic_category", ["clinicId", "category"]),

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

  // Agent threads table - Conversazioni con l'agent AI
  agentThreads: defineTable({
    userId: v.id("users"),
    clinicId: v.id("clinics"),
    title: v.optional(v.string()), // titolo generato automaticamente
    isActive: v.boolean(),
    lastMessageAt: v.number(),
    messageCount: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_clinic", ["clinicId"])
    .index("by_user_active", ["userId", "isActive"])
    .index("by_last_message", ["lastMessageAt"]),

  // Agent messages table - Messaggi nelle conversazioni
  agentMessages: defineTable({
    threadId: v.id("agentThreads"),
    role: v.union(v.literal("user"), v.literal("assistant")), 
    content: v.string(),
    metadata: v.optional(v.object({
      toolCalls: v.optional(v.array(v.any())),
      searchResults: v.optional(v.array(v.any())),
      suggestedCategory: v.optional(v.id("categories")),
      suggestedTicket: v.optional(v.any()),
      requiredAttributes: v.optional(v.array(v.any())), // 🆕 Attributi obbligatori per la categoria
      collectedAttributes: v.optional(v.any()), // 🆕 Attributi raccolti dall'utente
      createdTicketId: v.optional(v.string()), // 🆕 ID del ticket creato (Convex ID)
      awaitingAttributes: v.optional(v.boolean()), // 🆕 Se stiamo aspettando attributi dall'utente
    })),
  })
    .index("by_thread", ["threadId"]),

  // Agent configuration table - Configurazioni dell'agent per clinica
  agentConfig: defineTable({
    clinicId: v.id("clinics"),
    isEnabled: v.boolean(),
    settings: v.object({
      canSearchTickets: v.boolean(),
      canSuggestCategories: v.boolean(),
      canCreateTickets: v.boolean(),
      canAccessUserData: v.boolean(),
      canAccessClinicsData: v.boolean(),
      temperature: v.number(), // per l'AI
      maxTokens: v.number(),
      systemPrompt: v.string(),
    }),
    lastUpdatedBy: v.id("users"),
  })
    .index("by_clinic", ["clinicId"])
    .index("by_enabled", ["isEnabled"]),

  // 🆕 Agent Feedback table - Correzioni e feedback dell'utente sull'agent
  agentFeedback: defineTable({
    threadId: v.id("agentThreads"), // thread della conversazione
    userId: v.id("users"), // utente che ha dato il feedback
    clinicId: v.id("clinics"),
    
    // Cosa ha suggerito l'agent (SBAGLIATO)
    suggestedCategoryId: v.optional(v.id("categories")),
    suggestedCategoryName: v.optional(v.string()),
    
    // Cosa era corretto (secondo l'utente)
    correctCategoryId: v.optional(v.id("categories")),
    correctCategoryName: v.optional(v.string()),
    
    // Contesto della richiesta
    ticketTitle: v.string(),
    ticketDescription: v.string(),
    
    // Tipo di feedback
    feedbackType: v.union(
      v.literal("wrong_category"), // categoria sbagliata
      v.literal("general_error"), // errore generico
      v.literal("positive") // feedback positivo
    ),
    
    // Note aggiuntive dall'utente
    userComment: v.optional(v.string()),
    
    // Confidenza dell'agent quando ha sbagliato
    confidence: v.optional(v.number()),
    
    // È stato risolto?
    wasResolved: v.boolean(),
  })
    .index("by_thread", ["threadId"])
    .index("by_user", ["userId"])
    .index("by_clinic", ["clinicId"])
    .index("by_feedback_type", ["feedbackType"])
    .index("by_suggested_category", ["suggestedCategoryId"])
    .index("by_correct_category", ["correctCategoryId"])
    .index("by_clinic_type", ["clinicId", "feedbackType"]),

  // Comments on tickets (sistema chat)
  ticketComments: defineTable({
    ticketId: v.id("tickets"),
    authorId: v.id("users"),
    content: v.string(),
    isInternal: v.optional(v.boolean()), // true = solo per agenti/admin
    attachments: v.optional(v.array(v.object({
      name: v.string(),
      url: v.string(),
      type: v.string(),
      size: v.number(),
    }))),
  })
    .index("by_ticket", ["ticketId"]) // _creationTime viene aggiunto automaticamente
    .index("by_author", ["authorId"]),

  // Knowledge Base Articles
  kbArticles: defineTable({
    title: v.string(),
    content: v.string(), // Contenuto dell'articolo (può essere markdown/HTML)
    excerpt: v.string(), // Breve estratto/descrizione
    category: v.string(), // Account, Hardware, Software, Rete, Sicurezza, etc.
    difficulty: v.union(v.literal("Facile"), v.literal("Medio"), v.literal("Avanzato")),
    clinicId: v.id("clinics"), // Articolo specifico per clinica o globale
    authorId: v.id("users"), // Chi ha creato l'articolo
    views: v.number(), // Numero di visualizzazioni
    likes: v.number(), // Numero di "mi piace"
    featured: v.boolean(), // In evidenza?
    isActive: v.boolean(), // Articolo pubblicato o bozza
    publishedAt: v.optional(v.number()), // Data pubblicazione
    lastUpdatedAt: v.number(), // Ultimo aggiornamento
    tags: v.optional(v.array(v.string())), // Tag per ricerca
    attachments: v.optional(v.array(v.object({
      name: v.string(),
      url: v.string(),
      type: v.string(), // image/png, image/jpeg, application/pdf, etc.
      size: v.number(),
    }))),
  })
    .index("by_clinic", ["clinicId"])
    .index("by_category", ["category"])
    .index("by_author", ["authorId"])
    .index("by_active", ["isActive"])
    .index("by_featured", ["featured"]),

  // Article Suggestions (suggerimenti utenti)
  articleSuggestions: defineTable({
    title: v.string(),
    description: v.string(), // Descrizione del problema/argomento
    category: v.string(),
    priority: v.union(v.literal("Bassa"), v.literal("Media"), v.literal("Alta")),
    clinicId: v.id("clinics"),
    suggestedBy: v.id("users"), // Chi ha suggerito
    status: v.union(
      v.literal("pending"),    // In attesa di revisione
      v.literal("approved"),   // Approvato, articolo creato
      v.literal("rejected")    // Rifiutato
    ),
    reviewedBy: v.optional(v.id("users")), // Chi ha revisionato
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()), // Note della revisione
    relatedArticleId: v.optional(v.id("kbArticles")), // Se approvato, ID articolo creato
  })
    .index("by_clinic", ["clinicId"])
    .index("by_status", ["status"])
    .index("by_suggested", ["suggestedBy"])
    .index("by_reviewed", ["reviewedBy"]),

  // Article Comments (commenti articoli KB)
  kbArticleComments: defineTable({
    articleId: v.id("kbArticles"),
    authorId: v.id("users"),
    content: v.string(),
    parentCommentId: v.optional(v.id("kbArticleComments")), // Per risposte annidate
    isEdited: v.optional(v.boolean()),
    editedAt: v.optional(v.number()),
  })
    .index("by_article", ["articleId"])
    .index("by_author", ["authorId"])
    .index("by_parent", ["parentCommentId"]),

  // Notifications (notifiche sistema)
  notifications: defineTable({
    userId: v.id("users"), // A chi è destinata
    type: v.string(), // 'kb_suggestion', 'kb_comment', 'ticket_assigned', etc.
    title: v.string(),
    message: v.string(),
    relatedId: v.optional(v.string()), // ID dell'entità correlata (articleId, ticketId, etc.)
    relatedUrl: v.optional(v.string()), // URL per navigare
    isRead: v.boolean(),
    readAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "isRead"])
    .index("by_type", ["type"]),

  // Ticket Views (viste personalizzate dei ticket)
  ticketViews: defineTable({
    name: v.string(),
    description: v.string(),
    createdBy: v.id("users"),
    clinicId: v.id("clinics"),
    isPublic: v.boolean(), // Se true, visibile a tutti
    isPersonal: v.boolean(), // Se true, è una vista personale (solo per il creatore)
    filters: v.object({
      status: v.optional(v.array(v.string())), // Array di stati (es. ["open", "in_progress"])
      categoryId: v.optional(v.id("categories")),
      assignedTo: v.optional(v.id("users")),
      clinicId: v.optional(v.id("clinics")),
      areaManager: v.optional(v.id("users")),
      dateRange: v.optional(v.object({
        type: v.string(), // "last_days", "last_month", "custom"
        days: v.optional(v.number()), // Per "last_days"
        startDate: v.optional(v.number()), // Per "custom"
        endDate: v.optional(v.number()), // Per "custom"
      })),
    }),
    assignedTo: v.optional(v.array(v.id("users"))), // Array di utenti/agenti a cui è assegnata
    assignedToRoles: v.optional(v.array(v.string())), // Array di ruoli (es. ["agent", "user"])
    isActive: v.boolean(),
  })
    .index("by_creator", ["createdBy"])
    .index("by_clinic", ["clinicId"])
    .index("by_public", ["isPublic"])
    .index("by_personal", ["isPersonal"])
    .index("by_active", ["isActive"]),

  // Societies table - Nuova tabella per gestire le società
  societies: defineTable({
    name: v.string(),
    code: v.string(), // Codice univoco società
    description: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.optional(v.id("users")), // Optional per supportare creazione senza auth
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"])
    .index("by_creator", ["createdBy"]),

  // User-Society relationships (many-to-many) - Tabella di collegamento
  userSocieties: defineTable({
    userId: v.id("users"),
    societyId: v.id("societies"),
    assignedBy: v.id("users"), // Chi ha assegnato la società all'utente
    assignedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_society", ["societyId"])
    .index("by_user_society", ["userId", "societyId"])
    .index("by_active", ["isActive"]),
})
