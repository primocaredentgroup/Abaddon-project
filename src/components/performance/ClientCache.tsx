'use client'

import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react'

interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
  stale: boolean
}

interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum number of entries
  staleWhileRevalidate?: boolean // Return stale data while fetching fresh
}

interface CacheContextValue {
  get: <T>(key: string) => T | null
  set: <T>(key: string, data: T, options?: CacheOptions) => void
  invalidate: (key: string | RegExp) => void
  clear: () => void
  getStats: () => {
    size: number
    hitRate: number
    totalRequests: number
    totalHits: number
  }
  preload: <T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions) => Promise<void>
}

const CacheContext = createContext<CacheContextValue | null>(null)

interface ClientCacheProviderProps {
  defaultTtl?: number
  maxSize?: number
  children: React.ReactNode
}

export const ClientCacheProvider: React.FC<ClientCacheProviderProps> = ({
  defaultTtl = 5 * 60 * 1000, // 5 minutes
  maxSize = 1000,
  children,
}) => {
  const cacheRef = useRef(new Map<string, CacheEntry>())
  const statsRef = useRef({
    totalRequests: 0,
    totalHits: 0,
  })

  // Cleanup expired entries periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now()
      const cache = cacheRef.current
      const keysToDelete: string[] = []

      cache.forEach((entry, key) => {
        if (now - entry.timestamp > entry.ttl) {
          keysToDelete.push(key)
        }
      })

      keysToDelete.forEach(key => cache.delete(key))
    }, 60000) // Cleanup every minute

    return () => clearInterval(cleanupInterval)
  }, [])

  const get = useCallback(<T>(key: string): T | null => {
    statsRef.current.totalRequests++
    
    const entry = cacheRef.current.get(key)
    if (!entry) return null

    const now = Date.now()
    const isExpired = now - entry.timestamp > entry.ttl

    if (isExpired) {
      cacheRef.current.delete(key)
      return null
    }

    // Mark as stale if more than half the TTL has passed
    const isStale = now - entry.timestamp > entry.ttl / 2
    if (isStale && !entry.stale) {
      entry.stale = true
    }

    statsRef.current.totalHits++
    return entry.data as T
  }, [])

  const set = useCallback(<T>(key: string, data: T, options: CacheOptions = {}): void => {
    const cache = cacheRef.current
    const ttl = options.ttl || defaultTtl

    // Remove oldest entries if cache is full
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value
      if (oldestKey) {
        cache.delete(oldestKey)
      }
    }

    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      stale: false,
    })
  }, [defaultTtl, maxSize])

  const invalidate = useCallback((pattern: string | RegExp): void => {
    const cache = cacheRef.current
    const keysToDelete: string[] = []

    if (typeof pattern === 'string') {
      // Exact match or prefix match with wildcard
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1)
        cache.forEach((_, key) => {
          if (key.startsWith(prefix)) {
            keysToDelete.push(key)
          }
        })
      } else {
        if (cache.has(pattern)) {
          keysToDelete.push(pattern)
        }
      }
    } else {
      // RegExp pattern
      cache.forEach((_, key) => {
        if (pattern.test(key)) {
          keysToDelete.push(key)
        }
      })
    }

    keysToDelete.forEach(key => cache.delete(key))
  }, [])

  const clear = useCallback((): void => {
    cacheRef.current.clear()
    statsRef.current = {
      totalRequests: 0,
      totalHits: 0,
    }
  }, [])

  const getStats = useCallback(() => {
    const { totalRequests, totalHits } = statsRef.current
    return {
      size: cacheRef.current.size,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      totalRequests,
      totalHits,
    }
  }, [])

  const preload = useCallback(async <T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<void> => {
    // Don't preload if already cached and not stale
    const existing = get<T>(key)
    if (existing && !cacheRef.current.get(key)?.stale) {
      return
    }

    try {
      const data = await fetcher()
      set(key, data, options)
    } catch (error) {
      console.warn(`Failed to preload cache key: ${key}`, error)
    }
  }, [get, set])

  const contextValue: CacheContextValue = {
    get,
    set,
    invalidate,
    clear,
    getStats,
    preload,
  }

  return (
    <CacheContext.Provider value={contextValue}>
      {children}
    </CacheContext.Provider>
  )
}

export const useClientCache = (): CacheContextValue => {
  const context = useContext(CacheContext)
  if (!context) {
    throw new Error('useClientCache must be used within a ClientCacheProvider')
  }
  return context
}

// Hook for cached data fetching
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions & {
    enabled?: boolean
    refetchOnStale?: boolean
  } = {}
) {
  const cache = useClientCache()
  const [data, setData] = React.useState<T | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)
  const fetcherRef = useRef(fetcher)
  const abortControllerRef = useRef<AbortController>()

  const { enabled = true, refetchOnStale = true, ...cacheOptions } = options

  // Update fetcher ref
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Check cache first
    const cachedData = cache.get<T>(key)
    const cacheEntry = (cache as any).cacheRef?.current?.get(key)
    const isStale = cacheEntry?.stale

    if (cachedData && !force && (!isStale || !refetchOnStale)) {
      setData(cachedData)
      setError(null)
      return
    }

    // Set cached data immediately if available (stale-while-revalidate)
    if (cachedData && isStale && refetchOnStale) {
      setData(cachedData)
    } else if (!cachedData) {
      setIsLoading(true)
    }

    abortControllerRef.current = new AbortController()
    const currentController = abortControllerRef.current

    try {
      const freshData = await fetcherRef.current()
      
      if (!currentController.signal.aborted) {
        cache.set(key, freshData, cacheOptions)
        setData(freshData)
        setError(null)
      }
    } catch (err) {
      if (!currentController.signal.aborted) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        
        // Keep stale data if available
        if (!cachedData) {
          setData(null)
        }
      }
    } finally {
      if (!currentController.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [key, enabled, refetchOnStale, cache, cacheOptions])

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const refetch = useCallback(() => {
    return fetchData(true)
  }, [fetchData])

  const isStale = React.useMemo(() => {
    const cacheEntry = (cache as any).cacheRef?.current?.get(key)
    return cacheEntry?.stale || false
  }, [cache, key, data]) // Re-evaluate when data changes

  return {
    data,
    isLoading,
    error,
    refetch,
    isStale,
  }
}

// Component to display cache stats (development only)
export const CacheStats: React.FC<{ className?: string }> = ({ className = '' }) => {
  const cache = useClientCache()
  const [stats, setStats] = React.useState(cache.getStats())

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(cache.getStats())
    }, 1000)

    return () => clearInterval(interval)
  }, [cache])

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className={`bg-gray-900 text-white p-2 text-xs font-mono ${className}`}>
      <div className="font-semibold mb-1">Cache Stats</div>
      <div>Size: {stats.size} entries</div>
      <div>Hit Rate: {(stats.hitRate * 100).toFixed(1)}%</div>
      <div>Requests: {stats.totalRequests}</div>
      <div>Hits: {stats.totalHits}</div>
    </div>
  )
}

// Utility to create a cache-aware query hook
export function createCachedQuery<TArgs, TResult>(
  queryKey: string,
  queryFn: (args: TArgs) => Promise<TResult>,
  defaultOptions: CacheOptions = {}
) {
  return function useCachedQuery(args: TArgs, options: CacheOptions = {}) {
    const cacheKey = `${queryKey}_${JSON.stringify(args)}`
    const fetcher = useCallback(() => queryFn(args), [args])
    
    return useCachedData(cacheKey, fetcher, { ...defaultOptions, ...options })
  }
}


