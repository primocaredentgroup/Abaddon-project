import { useState, useEffect, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { TicketStatus } from '@/types'

interface SearchFilters {
  searchTerm?: string
  status?: TicketStatus[]
  categoryId?: string
  assigneeId?: string
  creatorId?: string
  visibility?: 'public' | 'private'
  dateFrom?: number
  dateTo?: number
  attributes?: Record<string, any>
}

interface SortOptions {
  sortBy: 'created' | 'updated' | 'title' | 'status'
  sortOrder: 'asc' | 'desc'
}

interface UseTicketSearchOptions {
  initialFilters?: SearchFilters
  initialSort?: SortOptions
  pageSize?: number
  debounceMs?: number
}

interface UseTicketSearchReturn {
  // Data
  tickets: any[]
  total: number
  hasMore: boolean
  isLoading: boolean
  error: string | null
  
  // Search state
  filters: SearchFilters
  sorting: SortOptions
  currentPage: number
  
  // Actions
  setSearchTerm: (term: string) => void
  setFilters: (filters: Partial<SearchFilters>) => void
  setSorting: (sorting: Partial<SortOptions>) => void
  clearFilters: () => void
  nextPage: () => void
  prevPage: () => void
  goToPage: (page: number) => void
  refresh: () => void
  
  // Suggestions
  suggestions: any[]
  getSuggestions: (term: string) => void
}

export function useTicketSearch(options: UseTicketSearchOptions = {}): UseTicketSearchReturn {
  const {
    initialFilters = {},
    initialSort = { sortBy: 'updated', sortOrder: 'desc' },
    pageSize = 20,
    debounceMs = 300,
  } = options

  // State
  const [filters, setFiltersState] = useState<SearchFilters>(initialFilters)
  const [sorting, setSortingState] = useState<SortOptions>(initialSort)
  const [currentPage, setCurrentPage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(filters.searchTerm || '')

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(filters.searchTerm || '')
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [filters.searchTerm, debounceMs])

  // Build query arguments
  const queryArgs = useMemo(() => ({
    searchTerm: debouncedSearchTerm || undefined,
    status: filters.status,
    categoryId: filters.categoryId as any,
    assigneeId: filters.assigneeId as any,
    creatorId: filters.creatorId as any,
    visibility: filters.visibility,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    attributes: filters.attributes,
    sortBy: sorting.sortBy,
    sortOrder: sorting.sortOrder,
    limit: pageSize,
    offset: currentPage * pageSize,
  }), [
    debouncedSearchTerm,
    filters,
    sorting,
    currentPage,
    pageSize,
  ])

  // Main search query
  const searchResult = useQuery(
    api.tickets?.search,
    queryArgs
  )

  // Suggestions query
  const [suggestionTerm, setSuggestionTerm] = useState('')
  const suggestions = useQuery(
    api.tickets?.getSearchSuggestions,
    suggestionTerm.length >= 2 ? { searchTerm: suggestionTerm } : "skip"
  )

  const isLoading = searchResult === undefined

  // Actions
  const setSearchTerm = (term: string) => {
    setFiltersState(prev => ({ ...prev, searchTerm: term }))
    setCurrentPage(0) // Reset to first page on search
  }

  const setFilters = (newFilters: Partial<SearchFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
    setCurrentPage(0) // Reset to first page on filter change
    setError(null)
  }

  const setSorting = (newSorting: Partial<SortOptions>) => {
    setSortingState(prev => ({ ...prev, ...newSorting }))
    setCurrentPage(0) // Reset to first page on sort change
  }

  const clearFilters = () => {
    setFiltersState({})
    setSortingState(initialSort)
    setCurrentPage(0)
    setError(null)
  }

  const nextPage = () => {
    if (searchResult?.hasMore) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1)
    }
  }

  const goToPage = (page: number) => {
    const maxPage = Math.ceil((searchResult?.total || 0) / pageSize) - 1
    const targetPage = Math.max(0, Math.min(page, maxPage))
    setCurrentPage(targetPage)
  }

  const refresh = () => {
    // Convex automatically refreshes, but we can reset error state
    setError(null)
  }

  const getSuggestions = (term: string) => {
    setSuggestionTerm(term)
  }

  // Handle errors
  useEffect(() => {
    if (searchResult === null) {
      setError('Errore durante la ricerca')
    } else {
      setError(null)
    }
  }, [searchResult])

  return {
    // Data
    tickets: searchResult?.tickets || [],
    total: searchResult?.total || 0,
    hasMore: searchResult?.hasMore || false,
    isLoading,
    error,
    
    // Search state
    filters,
    sorting,
    currentPage,
    
    // Actions
    setSearchTerm,
    setFilters,
    setSorting,
    clearFilters,
    nextPage,
    prevPage,
    goToPage,
    refresh,
    
    // Suggestions
    suggestions: suggestions || [],
    getSuggestions,
  }
}


