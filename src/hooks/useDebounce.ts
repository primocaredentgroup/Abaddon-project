import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook per il debouncing di valori
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook per il debouncing di callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  const timeoutRef = useRef<NodeJS.Timeout>()
  const callbackRef = useRef<T>(callback)

  // Update callback ref when dependencies change
  useEffect(() => {
    callbackRef.current = callback
  }, [callback, ...deps])

  const debouncedCallback = useCallback(
    ((...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    }) as T,
    [delay]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

/**
 * Hook per il debouncing con controllo di cancellazione
 */
export function useControllableDebounce<T>(
  value: T,
  delay: number,
  immediate = false
) {
  const [debouncedValue, setDebouncedValue] = useState<T>(immediate ? value : undefined as any)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
  }, [])

  const flush = useCallback(() => {
    cancel()
    setDebouncedValue(value)
  }, [cancel, value])

  const isPending = useCallback(() => {
    return timeoutRef.current !== undefined
  }, [])

  useEffect(() => {
    if (immediate && debouncedValue === undefined) {
      setDebouncedValue(value)
      return
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value)
      timeoutRef.current = undefined
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
      }
    }
  }, [value, delay, immediate, debouncedValue])

  return {
    debouncedValue,
    cancel,
    flush,
    isPending,
  }
}

/**
 * Hook per il throttling di valori
 */
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastRanRef = useRef<number>(Date.now())

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRanRef.current >= limit) {
        setThrottledValue(value)
        lastRanRef.current = Date.now()
      }
    }, limit - (Date.now() - lastRanRef.current))

    return () => {
      clearTimeout(handler)
    }
  }, [value, limit])

  return throttledValue
}

/**
 * Hook per il throttling di callback
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number,
  deps: React.DependencyList = []
): T {
  const lastRanRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout>()
  const callbackRef = useRef<T>(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback, ...deps])

  const throttledCallback = useCallback(
    ((...args: any[]) => {
      const now = Date.now()
      
      if (now - lastRanRef.current >= limit) {
        callbackRef.current(...args)
        lastRanRef.current = now
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        
        timeoutRef.current = setTimeout(() => {
          callbackRef.current(...args)
          lastRanRef.current = Date.now()
        }, limit - (now - lastRanRef.current))
      }
    }) as T,
    [limit]
  )

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return throttledCallback
}

/**
 * Hook combinato per debounce e throttle
 */
export function useDebounceThrottle<T>(
  value: T,
  debounceDelay: number,
  throttleLimit: number
) {
  const throttledValue = useThrottle(value, throttleLimit)
  const debouncedValue = useDebounce(throttledValue, debounceDelay)
  
  return debouncedValue
}

/**
 * Hook per il debouncing di ricerche con gestione dello stato di loading
 */
export function useDebouncedSearch<T>(
  searchFunction: (query: string) => Promise<T>,
  delay: number = 300
) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const debouncedQuery = useDebounce(query, delay)
  const searchRef = useRef<AbortController>()

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(null)
      setIsLoading(false)
      setError(null)
      return
    }

    // Cancel previous search
    if (searchRef.current) {
      searchRef.current.abort()
    }

    searchRef.current = new AbortController()
    const currentSearch = searchRef.current

    const performSearch = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const searchResults = await searchFunction(debouncedQuery)
        
        // Only update if this search hasn't been cancelled
        if (!currentSearch.signal.aborted) {
          setResults(searchResults)
        }
      } catch (err) {
        if (!currentSearch.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Errore di ricerca')
          setResults(null)
        }
      } finally {
        if (!currentSearch.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    performSearch()

    return () => {
      currentSearch.abort()
    }
  }, [debouncedQuery, searchFunction])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchRef.current) {
        searchRef.current.abort()
      }
    }
  }, [])

  const clearResults = useCallback(() => {
    setQuery('')
    setResults(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clearResults,
  }
}


