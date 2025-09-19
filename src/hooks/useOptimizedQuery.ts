import { useQuery, usePaginatedQuery } from 'convex/react'
import { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import { FunctionReference, PaginatedQueryReference } from 'convex/server'

// Cache for query results
const queryCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface UseOptimizedQueryOptions {
  enabled?: boolean
  cacheKey?: string
  cacheTtl?: number
  refetchOnWindowFocus?: boolean
  staleTime?: number
}

// Generate cache key from function and args
function generateCacheKey(func: any, args: any): string {
  return `${func._name || 'unknown'}_${JSON.stringify(args)}`
}

// Check if cached data is still valid
function isCacheValid(cacheKey: string, ttl: number): boolean {
  const cached = queryCache.get(cacheKey)
  if (!cached) return false
  return Date.now() - cached.timestamp < ttl
}

// Custom hook for optimized queries with caching
export function useOptimizedQuery<T>(
  func: FunctionReference<'query', 'public', any, T>,
  args: any,
  options: UseOptimizedQueryOptions = {}
) {
  const {
    enabled = true,
    cacheKey: customCacheKey,
    cacheTtl = CACHE_TTL,
    refetchOnWindowFocus = true,
    staleTime = 0,
  } = options

  const cacheKey = customCacheKey || generateCacheKey(func, args)
  const lastFetchRef = useRef<number>(0)
  const [isStale, setIsStale] = useState(false)

  // Check cache first
  const cachedData = useMemo(() => {
    if (!enabled) return undefined
    
    if (isCacheValid(cacheKey, cacheTtl)) {
      return queryCache.get(cacheKey)?.data
    }
    return undefined
  }, [cacheKey, cacheTtl, enabled])

  // Use Convex query only if cache miss or disabled
  const shouldFetch = enabled && !cachedData
  const queryResult = useQuery(func, shouldFetch ? args : 'skip' as any)

  // Update cache when new data arrives
  useEffect(() => {
    if (queryResult !== undefined && enabled) {
      queryCache.set(cacheKey, {
        data: queryResult,
        timestamp: Date.now(),
      })
      lastFetchRef.current = Date.now()
      setIsStale(false)
    }
  }, [queryResult, cacheKey, enabled])

  // Handle stale time
  useEffect(() => {
    if (staleTime > 0 && lastFetchRef.current > 0) {
      const timer = setTimeout(() => {
        setIsStale(true)
      }, staleTime)
      return () => clearTimeout(timer)
    }
  }, [staleTime, lastFetchRef.current])

  // Handle refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus) return

    const handleFocus = () => {
      // Invalidate cache on focus to trigger refetch
      if (queryCache.has(cacheKey)) {
        queryCache.delete(cacheKey)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [cacheKey, refetchOnWindowFocus])

  // Manual refetch function
  const refetch = useCallback(() => {
    queryCache.delete(cacheKey)
    setIsStale(false)
  }, [cacheKey])

  // Return cached data if available, otherwise query result
  const data = cachedData !== undefined ? cachedData : queryResult
  const isLoading = enabled && data === undefined

  return {
    data,
    isLoading,
    isStale,
    refetch,
    error: null, // Convex doesn't expose errors in the same way
  }
}

// Hook for paginated queries with optimization
export function useOptimizedPaginatedQuery<T>(
  func: PaginatedQueryReference<'public', any, T>,
  args: any,
  options: UseOptimizedQueryOptions & { initialNumItems?: number } = {}
) {
  const { initialNumItems = 20, ...queryOptions } = options
  const paginatedResult = usePaginatedQuery(func, args, { initialNumItems })

  // Cache pages separately
  const cacheKey = generateCacheKey(func, args)
  const pagesCacheKey = `${cacheKey}_pages`

  useEffect(() => {
    if (paginatedResult.results.length > 0) {
      queryCache.set(pagesCacheKey, {
        data: paginatedResult.results,
        timestamp: Date.now(),
      })
    }
  }, [paginatedResult.results, pagesCacheKey])

  return {
    ...paginatedResult,
    refetch: () => {
      queryCache.delete(pagesCacheKey)
    },
  }
}

// Utility to clear specific cache entries
export function clearQueryCache(pattern?: string) {
  if (!pattern) {
    queryCache.clear()
    return
  }

  const keysToDelete = Array.from(queryCache.keys()).filter(key =>
    key.includes(pattern)
  )
  
  keysToDelete.forEach(key => queryCache.delete(key))
}

// Utility to preload data
export function preloadQuery<T>(
  func: FunctionReference<'query', 'public', any, T>,
  args: any,
  ttl: number = CACHE_TTL
) {
  const cacheKey = generateCacheKey(func, args)
  
  // Only preload if not already cached
  if (!isCacheValid(cacheKey, ttl)) {
    // This would need to be implemented with Convex's preloading mechanism
    // For now, we just mark it as a placeholder
    console.log(`Preloading query: ${cacheKey}`)
  }
}

// Hook for batch queries optimization
export function useBatchQueries<T extends Record<string, any>>(
  queries: T,
  options: UseOptimizedQueryOptions = {}
): { [K in keyof T]: { data: any; isLoading: boolean; error: any } } {
  const results = {} as any

  // Execute all queries
  Object.entries(queries).forEach(([key, { func, args }]) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const result = useOptimizedQuery(func, args, {
      ...options,
      cacheKey: `batch_${key}_${generateCacheKey(func, args)}`,
    })
    results[key] = result
  })

  return results
}

// Memory management - clean old cache entries
setInterval(() => {
  const now = Date.now()
  const keysToDelete: string[] = []

  queryCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL * 2) {
      keysToDelete.push(key)
    }
  })

  keysToDelete.forEach(key => queryCache.delete(key))
}, CACHE_TTL) // Clean every cache TTL interval


