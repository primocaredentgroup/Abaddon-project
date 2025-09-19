import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useDebounce } from './useDebounce'
import { useOptimizedQuery } from './useOptimizedQuery'

interface FilterState {
  [key: string]: any
}

interface FilterConfig<T = any> {
  key: string
  type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'boolean' | 'number'
  label: string
  options?: { value: T; label: string }[]
  placeholder?: string
  defaultValue?: T
  debounceMs?: number
  validation?: (value: T) => boolean
  transform?: (value: T) => any
}

interface UseOptimizedFiltersOptions {
  initialFilters?: FilterState
  debounceMs?: number
  persistKey?: string // localStorage key for persistence
  onFiltersChange?: (filters: FilterState) => void
  maxCachedQueries?: number
}

interface UseOptimizedFiltersReturn {
  filters: FilterState
  debouncedFilters: FilterState
  activeFiltersCount: number
  setFilter: (key: string, value: any) => void
  removeFilter: (key: string) => void
  clearFilters: () => void
  resetFilters: () => void
  isFilterActive: (key: string) => boolean
  getFilterValue: <T = any>(key: string, defaultValue?: T) => T
  applyFilters: <T>(data: T[], filterConfigs: FilterConfig[]) => T[]
  exportFilters: () => string
  importFilters: (filtersString: string) => void
  filterHistory: FilterState[]
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

// Cache per i risultati filtrati
const filterCache = new Map<string, { result: any[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minuti

export function useOptimizedFilters({
  initialFilters = {},
  debounceMs = 300,
  persistKey,
  onFiltersChange,
  maxCachedQueries = 10,
}: UseOptimizedFiltersOptions = {}): UseOptimizedFiltersReturn {
  // Load persisted filters
  const loadPersistedFilters = useCallback(() => {
    if (!persistKey || typeof window === 'undefined') return initialFilters
    
    try {
      const persisted = localStorage.getItem(`filters_${persistKey}`)
      return persisted ? { ...initialFilters, ...JSON.parse(persisted) } : initialFilters
    } catch {
      return initialFilters
    }
  }, [initialFilters, persistKey])

  const [filters, setFilters] = useState<FilterState>(loadPersistedFilters)
  const [filterHistory, setFilterHistory] = useState<FilterState[]>([initialFilters])
  const [historyIndex, setHistoryIndex] = useState(0)
  
  const debouncedFilters = useDebounce(filters, debounceMs)
  const previousFiltersRef = useRef<FilterState>(filters)

  // Persist filters to localStorage
  useEffect(() => {
    if (!persistKey || typeof window === 'undefined') return

    try {
      localStorage.setItem(`filters_${persistKey}`, JSON.stringify(filters))
    } catch (error) {
      console.warn('Failed to persist filters:', error)
    }
  }, [filters, persistKey])

  // Call onChange when debounced filters change
  useEffect(() => {
    if (onFiltersChange && debouncedFilters !== previousFiltersRef.current) {
      onFiltersChange(debouncedFilters)
      previousFiltersRef.current = debouncedFilters
    }
  }, [debouncedFilters, onFiltersChange])

  // Add to history when filters change significantly
  useEffect(() => {
    const hasSignificantChange = Object.keys(filters).some(
      key => filters[key] !== filterHistory[historyIndex]?.[key]
    )

    if (hasSignificantChange && JSON.stringify(filters) !== JSON.stringify(filterHistory[historyIndex])) {
      const newHistory = filterHistory.slice(0, historyIndex + 1)
      newHistory.push(filters)
      
      // Limit history size
      if (newHistory.length > 20) {
        newHistory.shift()
      } else {
        setHistoryIndex(prev => prev + 1)
      }
      
      setFilterHistory(newHistory)
    }
  }, [filters, filterHistory, historyIndex])

  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(value => {
      if (value === null || value === undefined || value === '') return false
      if (Array.isArray(value)) return value.length > 0
      return true
    }).length
  }, [filters])

  const setFilter = useCallback((key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const removeFilter = useCallback((key: string) => {
    setFilters(prev => {
      const { [key]: removed, ...rest } = prev
      return rest
    })
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(initialFilters)
  }, [initialFilters])

  const isFilterActive = useCallback((key: string) => {
    const value = filters[key]
    if (value === null || value === undefined || value === '') return false
    if (Array.isArray(value)) return value.length > 0
    return true
  }, [filters])

  const getFilterValue = useCallback(<T = any>(key: string, defaultValue?: T): T => {
    return filters[key] ?? defaultValue
  }, [filters])

  // Advanced filtering with caching
  const applyFilters = useCallback(<T extends Record<string, any>>(
    data: T[],
    filterConfigs: FilterConfig[]
  ): T[] => {
    if (!data || data.length === 0) return data

    // Generate cache key
    const cacheKey = JSON.stringify({ filters: debouncedFilters, dataLength: data.length })
    
    // Check cache
    const cached = filterCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result
    }

    // Apply filters
    let result = data

    filterConfigs.forEach(config => {
      const filterValue = debouncedFilters[config.key]
      if (!filterValue && filterValue !== 0 && filterValue !== false) return

      result = result.filter(item => {
        const itemValue = item[config.key]

        switch (config.type) {
          case 'text':
            return String(itemValue || '').toLowerCase().includes(String(filterValue).toLowerCase())

          case 'select':
            return itemValue === filterValue

          case 'multiselect':
            if (!Array.isArray(filterValue)) return true
            return filterValue.length === 0 || filterValue.includes(itemValue)

          case 'boolean':
            return itemValue === filterValue

          case 'number':
            const numValue = Number(itemValue)
            const filterNum = Number(filterValue)
            return !isNaN(numValue) && !isNaN(filterNum) && numValue === filterNum

          case 'date':
            const itemDate = new Date(itemValue).toDateString()
            const filterDate = new Date(filterValue).toDateString()
            return itemDate === filterDate

          case 'daterange':
            if (!filterValue.start && !filterValue.end) return true
            const itemTime = new Date(itemValue).getTime()
            const startTime = filterValue.start ? new Date(filterValue.start).getTime() : -Infinity
            const endTime = filterValue.end ? new Date(filterValue.end).getTime() : Infinity
            return itemTime >= startTime && itemTime <= endTime

          default:
            return true
        }
      })
    })

    // Cache result
    filterCache.set(cacheKey, { result, timestamp: Date.now() })

    // Cleanup old cache entries
    if (filterCache.size > maxCachedQueries) {
      const oldestKey = Array.from(filterCache.keys())[0]
      filterCache.delete(oldestKey)
    }

    return result
  }, [debouncedFilters, maxCachedQueries])

  const exportFilters = useCallback(() => {
    return JSON.stringify(filters)
  }, [filters])

  const importFilters = useCallback((filtersString: string) => {
    try {
      const importedFilters = JSON.parse(filtersString)
      setFilters(importedFilters)
    } catch (error) {
      console.error('Failed to import filters:', error)
    }
  }, [])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < filterHistory.length - 1

  const undo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(prev => prev - 1)
      setFilters(filterHistory[historyIndex - 1])
    }
  }, [canUndo, filterHistory, historyIndex])

  const redo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(prev => prev + 1)
      setFilters(filterHistory[historyIndex + 1])
    }
  }, [canRedo, filterHistory, historyIndex])

  return {
    filters,
    debouncedFilters,
    activeFiltersCount,
    setFilter,
    removeFilter,
    clearFilters,
    resetFilters,
    isFilterActive,
    getFilterValue,
    applyFilters,
    exportFilters,
    importFilters,
    filterHistory,
    canUndo,
    canRedo,
    undo,
    redo,
  }
}

// Hook specializzato per filtri di ticket
export function useTicketFilters(clinicId: string) {
  const filterConfigs: FilterConfig[] = [
    {
      key: 'search',
      type: 'text',
      label: 'Cerca',
      placeholder: 'Cerca ticket...',
      debounceMs: 300,
    },
    {
      key: 'status',
      type: 'select',
      label: 'Stato',
      options: [
        { value: 'open', label: 'Aperto' },
        { value: 'in_progress', label: 'In Lavorazione' },
        { value: 'closed', label: 'Chiuso' },
      ],
    },
    {
      key: 'priority',
      type: 'select',
      label: 'Priorità',
      options: [
        { value: 'low', label: 'Bassa' },
        { value: 'medium', label: 'Media' },
        { value: 'high', label: 'Alta' },
      ],
    },
    {
      key: 'assigneeId',
      type: 'select',
      label: 'Assegnatario',
      // Options would be loaded from users query
    },
    {
      key: 'categoryId',
      type: 'select',
      label: 'Categoria',
      // Options would be loaded from categories query
    },
    {
      key: 'isPublic',
      type: 'boolean',
      label: 'Pubblico',
    },
    {
      key: 'dateRange',
      type: 'daterange',
      label: 'Periodo',
    },
  ]

  const optimizedFilters = useOptimizedFilters({
    persistKey: `tickets_${clinicId}`,
    debounceMs: 300,
  })

  // TODO: Uncomment when Convex API is available
  // const { data: filteredTickets, isLoading } = useOptimizedQuery(
  //   api.tickets.getTicketsByClinic,
  //   {
  //     clinicId,
  //     ...optimizedFilters.debouncedFilters,
  //   },
  //   {
  //     cacheKey: `filtered_tickets_${clinicId}_${JSON.stringify(optimizedFilters.debouncedFilters)}`,
  //     staleTime: 30000,
  //   }
  // )

  return {
    ...optimizedFilters,
    filterConfigs,
    // filteredTickets,
    // isLoading,
  }
}

// Cleanup cache periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    const keysToDelete: string[] = []

    filterCache.forEach((value, key) => {
      if (now - value.timestamp > CACHE_TTL) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => filterCache.delete(key))
  }, CACHE_TTL)
}


