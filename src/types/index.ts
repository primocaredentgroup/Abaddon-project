// Core entity types
export interface User {
  _id: string
  email: string
  name: string
  clinicId: string
  roleId: string
  auth0Id: string
  isActive: boolean
  lastLoginAt?: number
  preferences: UserPreferences
  _creationTime: number
}

export interface UserPreferences {
  notifications: {
    email: boolean
    push: boolean
  }
  dashboard: {
    defaultView: string
    itemsPerPage: number
  }
}

export interface Clinic {
  _id: string
  name: string
  code: string
  address: string
  phone: string
  email: string
  settings: ClinicSettings
  isActive: boolean
  _creationTime: number
}

export interface ClinicSettings {
  allowPublicTickets: boolean
  requireApprovalForCategories: boolean
  defaultSlaHours: number
}

export interface Ticket {
  _id: string
  title: string
  description: string
  status: TicketStatus
  categoryId: string
  clinicId: string
  creatorId: string
  assigneeId?: string
  visibility: 'public' | 'private'
  lastActivityAt: number
  attributeCount: number
  
  // Legacy fields for backward compatibility
  priority?: Priority
  customFields?: Record<string, unknown>
  slaDeadline?: number
  tags?: string[]
  _creationTime: number
}

// Simplified status: only 3 states as per requirements
export type TicketStatus = 'open' | 'in_progress' | 'closed'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Role {
  _id: string
  name: string
  description: string
  clinicId?: string
  permissions: Permission[]
  isSystem: boolean
  _creationTime: number
}

export interface Permission {
  _id: string
  resource: string
  action: string
  scope: 'own' | 'clinic' | 'global'
}

export interface Category {
  _id: string
  name: string
  description?: string
  clinicId: string
  departmentId?: string
  visibility: 'public' | 'private'
  requiresApproval: boolean
  isActive: boolean
  _creationTime: number
}

// Polymorphic Attribute System Types
export type AttributeType = 
  | 'text'
  | 'number' 
  | 'date'
  | 'select'
  | 'multiselect'
  | 'boolean'

export interface CategoryAttribute {
  _id: string
  categoryId: string
  name: string
  slug: string
  type: AttributeType
  required: boolean
  showInCreation: boolean
  showInList: boolean
  order: number
  config: AttributeConfig
  conditions?: AttributeCondition
  clinicId: string
  isActive: boolean
  _creationTime: number
}

export interface AttributeConfig {
  placeholder?: string
  options?: string[] // for select/multiselect
  min?: number // for number/text length
  max?: number
  defaultValue?: any
}

export interface AttributeCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than'
  value: any
}

export interface TicketAttribute {
  _id: string
  ticketId: string
  attributeId: string
  value: any // Polymorphic value based on attribute type
  _creationTime: number
}

export interface ValidationError {
  field: string
  message: string
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}

// Form types
export interface CreateTicketData {
  title: string
  description: string
  categoryId: string
  attributes: Record<string, any> // Dynamic attributes
  visibility?: 'public' | 'private'
  
  // Legacy fields for backward compatibility
  priority?: Priority
  customFields?: Record<string, unknown>
}

export interface UpdateTicketData {
  title?: string
  description?: string
  status?: TicketStatus
  categoryId?: string
  assigneeId?: string
  attributes?: Record<string, any>
  
  // Legacy fields for backward compatibility
  priority?: Priority
  customFields?: Record<string, unknown>
}

// Filter and search types
export interface TicketFilters {
  status?: TicketStatus[]
  priority?: Priority[]
  assigneeId?: string
  creatorId?: string
  categoryId?: string
  clinicId?: string
  search?: string
  dateFrom?: number
  dateTo?: number
}

export interface SortOption {
  field: string
  direction: 'asc' | 'desc'
}