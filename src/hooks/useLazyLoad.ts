import { useState, useEffect, useRef, useCallback } from 'react'

interface UseLazyLoadOptions {
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
  enabled?: boolean
}

interface UseLazyLoadReturn {
  ref: React.RefObject<HTMLElement>
  isVisible: boolean
  hasBeenVisible: boolean
}

export function useLazyLoad({
  threshold = 0.1,
  rootMargin = '50px',
  triggerOnce = true,
  enabled = true,
}: UseLazyLoadOptions = {}): UseLazyLoadReturn {
  const [isVisible, setIsVisible] = useState(false)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true)
      setHasBeenVisible(true)
      return
    }

    const element = ref.current
    if (!element) return

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        const isElementVisible = entry.isIntersecting

        if (isElementVisible) {
          setIsVisible(true)
          setHasBeenVisible(true)

          if (triggerOnce && observerRef.current) {
            observerRef.current.unobserve(element)
          }
        } else {
          if (!triggerOnce) {
            setIsVisible(false)
          }
        }
      },
      {
        threshold,
        rootMargin,
      }
    )

    observerRef.current.observe(element)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [threshold, rootMargin, triggerOnce, enabled])

  return {
    ref,
    isVisible,
    hasBeenVisible,
  }
}

// Hook per il lazy loading di immagini
export function useLazyImage(src: string, options: UseLazyLoadOptions = {}) {
  const { ref, isVisible, hasBeenVisible } = useLazyLoad(options)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shouldLoad = isVisible || hasBeenVisible

  useEffect(() => {
    if (!shouldLoad || !src) return

    const img = new Image()
    
    img.onload = () => {
      setIsLoaded(true)
      setError(null)
    }
    
    img.onerror = () => {
      setError('Failed to load image')
      setIsLoaded(false)
    }
    
    img.src = src

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [shouldLoad, src])

  return {
    ref,
    isVisible,
    hasBeenVisible,
    isLoaded,
    error,
    src: shouldLoad ? src : undefined,
  }
}

// Hook per il lazy loading di componenti
export function useLazyComponent<T = any>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>,
  options: UseLazyLoadOptions = {}
) {
  const { ref, isVisible, hasBeenVisible } = useLazyLoad(options)
  const [Component, setComponent] = useState<React.ComponentType<T> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const shouldLoad = isVisible || hasBeenVisible

  useEffect(() => {
    if (!shouldLoad || Component) return

    setIsLoading(true)
    setError(null)

    importFn()
      .then((module) => {
        setComponent(() => module.default)
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error('Failed to load component'))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [shouldLoad, Component, importFn])

  return {
    ref,
    Component,
    isLoading,
    error,
    isVisible,
    hasBeenVisible,
  }
}

// Hook per il lazy loading di dati
export function useLazyData<T>(
  fetcher: () => Promise<T>,
  options: UseLazyLoadOptions & {
    deps?: React.DependencyList
  } = {}
) {
  const { deps = [], ...lazyOptions } = options
  const { ref, isVisible, hasBeenVisible } = useLazyLoad(lazyOptions)
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const fetcherRef = useRef(fetcher)
  const abortControllerRef = useRef<AbortController>()

  // Update fetcher ref
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const shouldLoad = isVisible || hasBeenVisible

  useEffect(() => {
    if (!shouldLoad) return

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const currentController = abortControllerRef.current

    setIsLoading(true)
    setError(null)

    fetcherRef.current()
      .then((result) => {
        if (!currentController.signal.aborted) {
          setData(result)
        }
      })
      .catch((err) => {
        if (!currentController.signal.aborted) {
          setError(err instanceof Error ? err : new Error('Failed to load data'))
        }
      })
      .finally(() => {
        if (!currentController.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => {
      currentController.abort()
    }
  }, [shouldLoad, ...deps])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    ref,
    data,
    isLoading,
    error,
    isVisible,
    hasBeenVisible,
  }
}

// Hook per il lazy loading con intersezione multipla
export function useMultipleLazyLoad(
  count: number,
  options: UseLazyLoadOptions = {}
) {
  const [visibilityStates, setVisibilityStates] = useState<boolean[]>(
    new Array(count).fill(false)
  )
  const refs = useRef<(HTMLElement | null)[]>(new Array(count).fill(null))
  const observersRef = useRef<IntersectionObserver[]>([])

  useEffect(() => {
    if (!options.enabled || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setVisibilityStates(new Array(count).fill(true))
      return
    }

    // Clean up existing observers
    observersRef.current.forEach(observer => observer.disconnect())
    observersRef.current = []

    refs.current.forEach((element, index) => {
      if (!element) return

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisibilityStates(prev => {
              const newStates = [...prev]
              newStates[index] = true
              return newStates
            })

            if (options.triggerOnce) {
              observer.unobserve(element)
            }
          } else if (!options.triggerOnce) {
            setVisibilityStates(prev => {
              const newStates = [...prev]
              newStates[index] = false
              return newStates
            })
          }
        },
        {
          threshold: options.threshold || 0.1,
          rootMargin: options.rootMargin || '50px',
        }
      )

      observer.observe(element)
      observersRef.current.push(observer)
    })

    return () => {
      observersRef.current.forEach(observer => observer.disconnect())
    }
  }, [count, options])

  const getRef = useCallback((index: number) => {
    return (element: HTMLElement | null) => {
      refs.current[index] = element
    }
  }, [])

  return {
    visibilityStates,
    getRef,
  }
}

// Componente wrapper per il lazy loading
interface LazyWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  options?: UseLazyLoadOptions
  className?: string
}

export const LazyWrapper: React.FC<LazyWrapperProps> = ({
  children,
  fallback = null,
  options = {},
  className = '',
}) => {
  const { ref, isVisible, hasBeenVisible } = useLazyLoad(options)

  return (
    <div ref={ref} className={className}>
      {(isVisible || hasBeenVisible) ? children : fallback}
    </div>
  )
}

// Componente per lazy loading di immagini
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  fallback?: React.ReactNode
  options?: UseLazyLoadOptions
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt = '',
  fallback = null,
  options = {},
  className = '',
  ...props
}) => {
  const { ref, isLoaded, error, src: loadedSrc } = useLazyImage(src, options)

  if (error) {
    return (
      <div ref={ref} className={`${className} flex items-center justify-center bg-gray-200`}>
        <span className="text-gray-500 text-sm">Errore caricamento immagine</span>
      </div>
    )
  }

  if (!isLoaded && loadedSrc) {
    return (
      <div ref={ref} className={`${className} flex items-center justify-center bg-gray-200 animate-pulse`}>
        {fallback || <span className="text-gray-500 text-sm">Caricamento...</span>}
      </div>
    )
  }

  return (
    <img
      ref={ref}
      src={loadedSrc}
      alt={alt}
      className={className}
      {...props}
    />
  )
}


