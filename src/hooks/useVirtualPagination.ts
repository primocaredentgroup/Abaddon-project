import { useState, useMemo, useCallback, useEffect, useRef } from 'react'

interface UseVirtualPaginationOptions {
  itemHeight: number
  containerHeight: number
  overscan?: number
  totalItems: number
  onLoadMore?: (startIndex: number, endIndex: number) => void
  loadMoreThreshold?: number
}

interface UseVirtualPaginationReturn {
  visibleItems: Array<{
    index: number
    style: React.CSSProperties
  }>
  scrollToIndex: (index: number) => void
  scrollToTop: () => void
  totalHeight: number
  handleScroll: (event: React.UIEvent<HTMLDivElement>) => void
  isScrolling: boolean
  containerRef: React.RefObject<HTMLDivElement>
}

export function useVirtualPagination({
  itemHeight,
  containerHeight,
  overscan = 5,
  totalItems,
  onLoadMore,
  loadMoreThreshold = 10,
}: UseVirtualPaginationOptions): UseVirtualPaginationReturn {
  const [scrollTop, setScrollTop] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      totalItems - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    return { startIndex, endIndex }
  }, [scrollTop, itemHeight, containerHeight, overscan, totalItems])

  // Generate visible items with positioning
  const visibleItems = useMemo(() => {
    const items = []
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      items.push({
        index: i,
        style: {
          position: 'absolute' as const,
          top: i * itemHeight,
          height: itemHeight,
          width: '100%',
        },
      })
    }
    return items
  }, [visibleRange, itemHeight])

  // Total container height
  const totalHeight = totalItems * itemHeight

  // Handle scroll events
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = event.currentTarget.scrollTop
    setScrollTop(newScrollTop)
    setIsScrolling(true)

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    // Set scrolling to false after scroll ends
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false)
    }, 150)

    // Trigger load more if near the end
    if (onLoadMore) {
      const scrollPercentage = newScrollTop / (totalHeight - containerHeight)
      const remainingItems = totalItems - visibleRange.endIndex
      
      if (scrollPercentage > 0.8 || remainingItems <= loadMoreThreshold) {
        onLoadMore(visibleRange.startIndex, visibleRange.endIndex)
      }
    }
  }, [totalHeight, containerHeight, visibleRange, onLoadMore, loadMoreThreshold])

  // Scroll to specific index
  const scrollToIndex = useCallback((index: number) => {
    if (containerRef.current) {
      const scrollTop = Math.max(0, Math.min(index * itemHeight, totalHeight - containerHeight))
      containerRef.current.scrollTop = scrollTop
    }
  }, [itemHeight, totalHeight, containerHeight])

  // Scroll to top
  const scrollToTop = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  return {
    visibleItems,
    scrollToIndex,
    scrollToTop,
    totalHeight,
    handleScroll,
    isScrolling,
    containerRef,
  }
}

// Hook for infinite scrolling with virtual pagination
export function useInfiniteVirtualScroll<T>({
  itemHeight,
  containerHeight,
  loadMore,
  hasMore,
  isLoading,
}: {
  itemHeight: number
  containerHeight: number
  loadMore: () => Promise<void>
  hasMore: boolean
  isLoading: boolean
}) {
  const [items, setItems] = useState<T[]>([])
  const [loadingMore, setLoadingMore] = useState(false)

  const handleLoadMore = useCallback(async (startIndex: number, endIndex: number) => {
    if (loadingMore || !hasMore || isLoading) return

    // Only load more if we're near the end
    const nearEnd = endIndex >= items.length - 10
    if (!nearEnd) return

    setLoadingMore(true)
    try {
      await loadMore()
    } finally {
      setLoadingMore(false)
    }
  }, [loadMore, hasMore, isLoading, loadingMore, items.length])

  const virtualPagination = useVirtualPagination({
    itemHeight,
    containerHeight,
    totalItems: items.length + (hasMore ? 1 : 0), // +1 for loading indicator
    onLoadMore: handleLoadMore,
  })

  const addItems = useCallback((newItems: T[]) => {
    setItems(prev => [...prev, ...newItems])
  }, [])

  const resetItems = useCallback(() => {
    setItems([])
    virtualPagination.scrollToTop()
  }, [virtualPagination])

  return {
    ...virtualPagination,
    items,
    addItems,
    resetItems,
    loadingMore,
  }
}


