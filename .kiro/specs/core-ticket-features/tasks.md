# Implementation Plan

## ✅ COMPLETED TASKS - Technical Documentation

### Task 1: Estendere schema Convex per attributi polimorfi ✅
**Files:** `convex/schema.ts`, `src/types/index.ts`

#### Schema Extensions:
- **categoryAttributes table**: Polymorphic attribute definitions with type system (`text|number|date|select|multiselect|boolean`)
- **ticketAttributes table**: Dynamic attribute values storage with `v.any()` for polymorphic data
- **presence table**: Real-time user presence tracking with session management
- **tickets table**: Simplified status enum (`open|in_progress|closed`), added `lastActivityAt`, `attributeCount` fields
- **Indexes**: Optimized query performance with `by_category`, `by_ticket`, `by_activity`, `by_creation` indexes

#### Type System:
```typescript
interface CategoryAttribute {
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean'
  config: { placeholder?, options?, min?, max?, defaultValue? }
  conditions?: { field: string, operator: string, value: any }
}
```

---

### Task 2: Implementare Convex functions per gestione attributi categoria ✅
**Files:** `convex/categoryAttributes.ts`, `convex/ticketAttributes.ts`

#### Core Functions:
- **`createCategoryAttribute`**: CRUD with validation pipeline and type-specific config validation
- **`getCategoryAttributes`**: Filtered queries with `showInCreation`/`showInList` flags
- **`validateAttributeType`**: Runtime type validation with custom error messages
- **`evaluateCondition`**: Dynamic visibility condition evaluation engine
- **`validateTicketAttributes`**: Cross-attribute validation with dependency checking

#### Validation Pipeline:
```typescript
// Type-specific validation with config constraints
const validateAttributeType = (value: any, type: AttributeType, config: AttributeConfig) => {
  switch(type) {
    case 'number': return validateNumberRange(value, config.min, config.max)
    case 'select': return validateSelectOptions(value, config.options)
    // ... other types
  }
}
```

---

### Task 3: Creare componenti base per attributi dinamici ✅
**Files:** `src/components/tickets/DynamicAttributeField.tsx`, `src/components/admin/AttributeTypeSelector.tsx`, `src/components/admin/ConditionBuilder.tsx`, `src/hooks/useAttributeValidation.ts`

#### Component Architecture:
- **DynamicAttributeField**: Polymorphic input renderer with type-specific validation
- **AttributeTypeSelector**: Visual type picker with preview and constraints UI
- **ConditionBuilder**: Drag-drop condition editor with operator selection
- **useAttributeValidation**: Client-side validation hook with debounced validation

#### Polymorphic Rendering:
```tsx
const DynamicAttributeField = ({ attribute, value, onChange }) => {
  const renderField = () => {
    switch(attribute.type) {
      case 'select': return <Select options={attribute.config.options} />
      case 'multiselect': return <MultiSelect options={attribute.config.options} />
      // ... type-specific renderers
    }
  }
}
```

---

### Task 4: Implementare Admin Attribute Builder con drag-and-drop ✅
**Files:** `src/components/admin/AttributeBuilder.tsx`, `src/components/admin/AttributeCard.tsx`, `src/components/admin/TicketFormPreview.tsx`

#### Drag-and-Drop System:
- **@dnd-kit/core**: Drag-drop with collision detection and accessibility
- **AttributeBuilder**: Sortable list with real-time order persistence
- **Live Preview**: Real-time form rendering with attribute changes
- **Validation Feedback**: Visual indicators for configuration errors

#### State Management:
```typescript
const AttributeBuilder = () => {
  const [attributes, setAttributes] = useState<CategoryAttribute[]>([])
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  
  const handleDragEnd = (event) => {
    // Reorder logic with optimistic updates
    const newOrder = arrayMove(attributes, oldIndex, newIndex)
    updateAttributeOrder.mutate(newOrder)
  }
}
```

---

### Task 5: Sviluppare form dinamico di creazione ticket ✅
**Files:** `src/components/tickets/DynamicTicketForm.tsx`, `src/components/tickets/CategorySelect.tsx`, `src/components/tickets/VisibilityToggle.tsx`

#### Dynamic Form Engine:
- **Category-driven rendering**: Attributes loaded based on selected category
- **Conditional visibility**: Real-time field show/hide based on conditions
- **Validation cascade**: Client + server validation with error aggregation
- **Auto-save**: Draft persistence with recovery on page reload

#### Form State Management:
```typescript
const DynamicTicketForm = () => {
  const [category, setCategory] = useState<string>()
  const [attributes, setAttributes] = useState<Record<string, any>>({})
  const [visibleFields, setVisibleFields] = useState<string[]>([])
  
  useEffect(() => {
    // Evaluate visibility conditions when attributes change
    const newVisibleFields = categoryAttributes.filter(attr => 
      evaluateCondition(attr.conditions, attributes)
    )
    setVisibleFields(newVisibleFields.map(f => f.slug))
  }, [attributes, categoryAttributes])
}
```

---

### Task 6: Aggiornare Convex functions per gestione ticket semplificata ✅
**Files:** `convex/tickets.ts`, `convex/auditLogs.ts`

#### Enhanced Ticket Functions:
- **`createTicket`**: Polymorphic attribute handling with validation pipeline
- **`updateTicket`**: Simplified status transitions with business logic validation
- **`getTicketsByClinic`**: Optimized queries with attribute enrichment
- **Audit logging**: Comprehensive change tracking with user context

#### Status Transition Logic:
```typescript
const updateTicket = mutation({
  handler: async (ctx, { ticketId, updates }) => {
    // Validate status transitions
    if (updates.status && !isValidTransition(currentStatus, updates.status)) {
      throw new ConvexError("Invalid status transition")
    }
    
    // Log changes for audit
    await ctx.db.insert("auditLogs", {
      action: "ticket_updated",
      changes: diffObject(currentTicket, updates),
      userId: user._id
    })
  }
})
```

---

### Task 7: Creare interfaccia chat-like per visualizzazione ticket ✅
**Files:** `src/components/tickets/TicketChatView.tsx`, `src/components/tickets/ChatMessage.tsx`, `src/components/tickets/EditableTitle.tsx`, `src/components/tickets/EditableDescription.tsx`, `src/components/tickets/CommentInput.tsx`, `src/components/tickets/TicketAttributes.tsx`

#### Chat Interface Architecture:
- **TicketChatView**: Main container with header controls and message stream
- **ChatMessage**: Message bubbles with timestamp and user info
- **Inline Editing**: Title/description editing for ticket creators
- **Real-time Comments**: Live comment stream with optimistic updates

#### Component Composition:
```tsx
const TicketChatView = ({ ticketId }) => {
  const { ticket, comments } = useRealtimeTicket({ ticketId })
  
  return (
    <div className="chat-container">
      <TicketHeader ticket={ticket} />
      <MessageStream comments={comments} />
      <CommentInput onSubmit={handleNewComment} />
    </div>
  )
}
```

---

### Task 8: Implementare sistema real-time per aggiornamenti ticket ✅
**Files:** `src/hooks/useRealtimeTicket.ts`, `src/hooks/useNotifications.ts`, `src/components/notifications/NotificationDropdown.tsx`, `src/hooks/usePresence.ts`, `convex/presence.ts`, `src/components/presence/ActiveUsers.tsx`

#### Real-time System:
- **Convex Subscriptions**: Live data synchronization with automatic reconnection
- **Presence Tracking**: User activity monitoring with session management
- **Push Notifications**: Status/assignment change notifications with batching
- **Optimistic Updates**: Immediate UI feedback with rollback on failure

#### Presence Implementation:
```typescript
const usePresence = (ticketId: string) => {
  const updatePresence = useMutation(api.presence.updatePresence)
  
  useEffect(() => {
    const interval = setInterval(() => {
      updatePresence({ ticketId, isActive: true, lastSeen: Date.now() })
    }, 30000) // Heartbeat every 30s
    
    return () => clearInterval(interval)
  }, [ticketId])
}
```

---

### Task 9: Sviluppare componenti per gestione stati e assegnazioni ✅
**Files:** `src/components/tickets/StatusBadge.tsx`, `src/components/tickets/StatusSelect.tsx`, `src/components/tickets/AssigneeSelect.tsx`, `src/components/tickets/TicketActions.tsx`

#### State Management Components:
- **StatusBadge**: Visual status indicators with color coding and icons
- **StatusSelect**: Dropdown with transition validation and confirmation dialogs
- **AssigneeSelect**: User picker with search, filtering, and role validation
- **TicketActions**: Combined action panel with bulk operations

#### Status Transition UI:
```tsx
const StatusSelect = ({ currentStatus, onStatusChange }) => {
  const validTransitions = getValidTransitions(currentStatus)
  
  const handleChange = async (newStatus) => {
    if (requiresConfirmation(currentStatus, newStatus)) {
      const confirmed = await showConfirmDialog()
      if (!confirmed) return
    }
    
    onStatusChange(newStatus)
  }
}
```

---

### Task 10: Implementare sistema di configurazione visibilità ticket ✅
**Files:** `src/components/admin/VisibilitySettings.tsx`, `src/hooks/useVisibilitySettings.ts`, `src/components/tickets/VisibilityRules.tsx`, `convex/clinics.ts`

#### Visibility System:
- **Clinic-level settings**: Global public/private ticket configuration
- **Per-ticket visibility**: Individual ticket visibility with inheritance
- **Access control**: Rule-based visibility with role checking
- **Audit logging**: Visibility change tracking for compliance

#### Visibility Logic:
```typescript
const checkTicketVisibility = (ticket: Ticket, user: User, clinicSettings: VisibilitySettings) => {
  if (ticket.visibility === 'private') return ticket.createdBy === user._id || ticket.assigneeId === user._id
  if (ticket.visibility === 'public') return clinicSettings.allowPublicTickets
  return hasPermission(user, 'view_tickets', ticket.clinicId)
}
```

---

### Task 11: Creare sistema di ricerca e filtri performante ✅
**Files:** `src/hooks/useTicketSearch.ts`, `src/components/search/SearchInput.tsx`, `src/components/search/AdvancedFilters.tsx`, `src/components/search/SearchResults.tsx`, `src/hooks/useOptimizedFilters.ts`

#### Search Architecture:
- **Full-text search**: Multi-field search with ranking and highlighting
- **Advanced filters**: Combinable filters with saved presets
- **Debounced queries**: Performance optimization with request deduplication
- **Faceted search**: Category/status/assignee facets with counts

#### Search Implementation:
```typescript
const useTicketSearch = () => {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<FilterState>({})
  const debouncedQuery = useDebounce(query, 300)
  
  const searchResults = useOptimizedQuery(
    api.tickets.search,
    { query: debouncedQuery, filters },
    { cacheKey: `search_${debouncedQuery}_${JSON.stringify(filters)}` }
  )
}
```

---

### Task 12: Sviluppare sistema audit logging e storico modifiche ✅
**Files:** `src/components/audit/AuditLogViewer.tsx`, `src/components/audit/AuditStats.tsx`, `src/components/audit/AuditExport.tsx`, `convex/auditLogs.ts`

#### Audit System:
- **Comprehensive logging**: All ticket/attribute changes with diff tracking
- **User context**: Actor identification with IP and session tracking
- **Filterable history**: Date/user/action filtering with pagination
- **Export functionality**: CSV/JSON export for compliance reporting

#### Audit Implementation:
```typescript
const logAuditEvent = async (ctx, action: string, resourceId: string, changes: any) => {
  await ctx.db.insert("auditLogs", {
    action,
    resourceId,
    resourceType: "ticket",
    changes: diffObject(oldData, newData),
    userId: user._id,
    timestamp: Date.now(),
    metadata: { userAgent, ip }
  })
}
```

---

### Task 13: Implementare error handling e user feedback ✅
**Files:** `src/components/ui/Toast.tsx`, `src/components/ui/LoadingState.tsx`, `src/components/ui/ErrorState.tsx`, `src/hooks/useAsyncOperation.ts`, `src/components/ui/ActionFeedback.tsx`

#### Error Handling System:
- **Error boundaries**: Component-level error isolation with fallback UI
- **Toast notifications**: Success/error feedback with auto-dismiss
- **Loading states**: Skeleton screens and progress indicators
- **Retry mechanisms**: Exponential backoff with manual retry options

#### Error Handling Pattern:
```typescript
const useAsyncOperation = () => {
  const [state, setState] = useState({ loading: false, error: null, data: null })
  
  const execute = async (operation) => {
    setState({ loading: true, error: null, data: null })
    try {
      const result = await operation()
      setState({ loading: false, error: null, data: result })
    } catch (error) {
      setState({ loading: false, error, data: null })
      showToast({ type: 'error', message: error.message })
    }
  }
}
```

---

### Task 14: Ottimizzare performance e scalabilità ✅
**Files:** `src/hooks/useVirtualPagination.ts`, `src/hooks/useOptimizedQuery.ts`, `src/components/tickets/VirtualizedTicketList.tsx`, `src/hooks/useDebounce.ts`, `src/components/performance/PerformanceMonitor.tsx`, `src/hooks/useOptimizedFilters.ts`, `src/components/performance/ClientCache.tsx`, `src/hooks/useLazyLoad.ts`, `convex/tickets.ts` (optimized queries)

#### Performance Optimizations:
- **Virtual scrolling**: Efficient rendering of large ticket lists (1000+ items)
- **Query caching**: Intelligent caching with stale-while-revalidate pattern
- **Lazy loading**: Component and data lazy loading with intersection observer
- **Debouncing**: Input optimization for search and filters
- **Performance monitoring**: Real-time performance metrics and budgets

#### Virtual Pagination:
```typescript
const useVirtualPagination = ({ itemHeight, containerHeight, totalItems }) => {
  const [scrollTop, setScrollTop] = useState(0)
  const startIndex = Math.floor(scrollTop / itemHeight)
  const endIndex = Math.min(startIndex + Math.ceil(containerHeight / itemHeight), totalItems)
  
  const visibleItems = useMemo(() => 
    Array.from({ length: endIndex - startIndex }, (_, i) => ({
      index: startIndex + i,
      style: { position: 'absolute', top: (startIndex + i) * itemHeight }
    }))
  , [startIndex, endIndex, itemHeight])
}
```

#### Caching Strategy:
```typescript
const useOptimizedQuery = (func, args, options) => {
  const cacheKey = generateCacheKey(func, args)
  const cachedData = cache.get(cacheKey)
  
  if (cachedData && !isStale(cachedData)) {
    return { data: cachedData.data, isLoading: false }
  }
  
  const freshData = useQuery(func, args)
  if (freshData) cache.set(cacheKey, { data: freshData, timestamp: Date.now() })
}
```

---

## 🔄 PENDING TASKS

**⚠️ Note**: Tasks 1-14 are all COMPLETED ✅. Only testing and integration remain.

- [ ] 15. Creare test completi per sistema ticket
  - Scrivere test unitari per tutti i componenti di attributi dinamici
  - Implementare test integrazione per flusso completo creazione-gestione ticket
  - Sviluppare test performance per caricamento e rendering con grandi dataset
  - Creare test end-to-end per user journey completi (creazione, modifica, chiusura)
  - Aggiungere test per validazione attributi e gestione errori
  - _Requirements: 8.1, 8.2, 8.4_

- [ ] 16. Integrare sistema con funzionalità esistenti
  - Collegare nuovo sistema ticket con categorie e tag esistenti
  - Aggiornare dashboard esistenti per mostrare nuovi stati e attributi
  - Migrare dati ticket esistenti al nuovo schema con attributi
  - Creare script di migrazione per preservare dati storici
  - Testare compatibilità con sistema di permessi e ruoli esistente
  - _Requirements: 1.4, 1.5, 1.6, 8.3_