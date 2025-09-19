'use client'

import React, { useMemo, useCallback, useState } from 'react'
import { useVirtualPagination } from '@/hooks/useVirtualPagination'
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery'
import { Ticket } from '@/types'
import { StatusBadge } from './StatusBadge'
import { Card } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Badge } from '@/components/ui/Badge'

interface VirtualizedTicketListProps {
  clinicId: string
  filters?: {
    status?: string
    assigneeId?: string
    categoryId?: string
    search?: string
  }
  onTicketClick?: (ticket: Ticket) => void
  itemHeight?: number
  containerHeight?: number
  className?: string
}

interface TicketListItemProps {
  ticket: Ticket
  onClick?: (ticket: Ticket) => void
  style: React.CSSProperties
  isLoading?: boolean
}

const TicketListItem: React.FC<TicketListItemProps> = ({
  ticket,
  onClick,
  style,
  isLoading = false,
}) => {
  const handleClick = useCallback(() => {
    if (onClick && !isLoading) {
      onClick(ticket)
    }
  }, [onClick, ticket, isLoading])

  if (isLoading) {
    return (
      <div style={style} className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    )
  }

  return (
    <div style={style} className="px-4 py-2">
      <Card
        className={`cursor-pointer hover:shadow-md transition-shadow ${
          onClick ? 'hover:bg-gray-50' : ''
        }`}
        onClick={handleClick}
      >
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-medium text-gray-900 line-clamp-1">
              {ticket.title}
            </h3>
            <StatusBadge status={ticket.status} size="sm" />
          </div>
          
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {ticket.description}
          </p>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-2">
              {ticket.category && (
                <Badge variant="secondary" size="sm">
                  {ticket.category.name}
                </Badge>
              )}
              {ticket.assignee && (
                <span>Assegnato a: {ticket.assignee.name}</span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {ticket.priority && (
                <Badge
                  variant={
                    ticket.priority === 'high'
                      ? 'destructive'
                      : ticket.priority === 'medium'
                      ? 'default'
                      : 'secondary'
                  }
                  size="sm"
                >
                  {ticket.priority}
                </Badge>
              )}
              <span>
                {new Date(ticket.createdAt).toLocaleDateString('it-IT')}
              </span>
            </div>
          </div>
          
          {ticket.attributeCount > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                {ticket.attributeCount} attributi personalizzati
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export const VirtualizedTicketList: React.FC<VirtualizedTicketListProps> = ({
  clinicId,
  filters = {},
  onTicketClick,
  itemHeight = 160,
  containerHeight = 600,
  className = '',
}) => {
  const [loadedTickets, setLoadedTickets] = useState<Ticket[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // TODO: Uncomment when Convex API is available
  // const { data: tickets, isLoading, error } = useOptimizedQuery(
  //   api.tickets.getTicketsByClinic,
  //   {
  //     clinicId,
  //     ...filters,
  //     limit: 50, // Load in chunks
  //   },
  //   {
  //     cacheKey: `tickets_${clinicId}_${JSON.stringify(filters)}`,
  //     staleTime: 30000, // 30 seconds
  //   }
  // )

  // Temporary mock data for development
  const { data: tickets, isLoading, error } = {
    data: loadedTickets,
    isLoading: false,
    error: null,
  }

  // Load more tickets when scrolling
  const loadMoreTickets = useCallback(async () => {
    if (isLoadingMore || !hasMore) return

    setIsLoadingMore(true)
    try {
      // TODO: Implement actual pagination logic
      // const moreTickets = await convex.query(api.tickets.getTicketsByClinic, {
      //   clinicId,
      //   ...filters,
      //   offset: loadedTickets.length,
      //   limit: 20,
      // })
      
      // Mock loading delay
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Mock: stop loading more after 100 items
      if (loadedTickets.length >= 100) {
        setHasMore(false)
      } else {
        // Add mock tickets
        const mockTickets: Ticket[] = Array.from({ length: 10 }, (_, i) => ({
          _id: `ticket_${loadedTickets.length + i}` as any,
          title: `Ticket ${loadedTickets.length + i + 1}`,
          description: `Descrizione del ticket ${loadedTickets.length + i + 1}`,
          status: ['open', 'in_progress', 'closed'][Math.floor(Math.random() * 3)] as any,
          priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
          createdAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
          updatedAt: Date.now(),
          lastActivityAt: Date.now(),
          attributeCount: Math.floor(Math.random() * 5),
          clinicId: clinicId as any,
          createdBy: 'user1' as any,
          isPublic: Math.random() > 0.5,
        }))
        
        setLoadedTickets(prev => [...prev, ...mockTickets])
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [clinicId, filters, loadedTickets.length, isLoadingMore, hasMore])

  // Initialize with some mock data
  React.useEffect(() => {
    if (loadedTickets.length === 0) {
      const initialTickets: Ticket[] = Array.from({ length: 20 }, (_, i) => ({
        _id: `ticket_${i}` as any,
        title: `Ticket ${i + 1}`,
        description: `Descrizione del ticket ${i + 1}`,
        status: ['open', 'in_progress', 'closed'][Math.floor(Math.random() * 3)] as any,
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
        createdAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now(),
        lastActivityAt: Date.now(),
        attributeCount: Math.floor(Math.random() * 5),
        clinicId: clinicId as any,
        createdBy: 'user1' as any,
        isPublic: Math.random() > 0.5,
      }))
      setLoadedTickets(initialTickets)
    }
  }, [clinicId, loadedTickets.length])

  const {
    visibleItems,
    totalHeight,
    handleScroll,
    containerRef,
    isScrolling,
  } = useVirtualPagination({
    itemHeight,
    containerHeight,
    totalItems: tickets?.length || 0,
    onLoadMore: loadMoreTickets,
    loadMoreThreshold: 5,
  })

  // Memoize visible tickets to avoid unnecessary re-renders
  const visibleTickets = useMemo(() => {
    return visibleItems.map(item => {
      const ticket = tickets?.[item.index]
      return {
        ...item,
        ticket,
      }
    })
  }, [visibleItems, tickets])

  if (error) {
    return (
      <ErrorState
        message="Errore nel caricamento dei ticket"
        onRetry={() => window.location.reload()}
      />
    )
  }

  if (isLoading && loadedTickets.length === 0) {
    return <LoadingState message="Caricamento ticket..." />
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleTickets.map(({ index, style, ticket }) => (
            <TicketListItem
              key={ticket?._id || `loading-${index}`}
              ticket={ticket}
              onClick={onTicketClick}
              style={style}
              isLoading={!ticket}
            />
          ))}
          
          {/* Loading indicator for infinite scroll */}
          {isLoadingMore && (
            <div
              className="flex items-center justify-center p-4"
              style={{
                position: 'absolute',
                top: totalHeight,
                width: '100%',
                height: itemHeight,
              }}
            >
              <LoadingState message="Caricamento altri ticket..." size="sm" />
            </div>
          )}
          
          {/* End of list indicator */}
          {!hasMore && tickets && tickets.length > 0 && (
            <div
              className="flex items-center justify-center p-4 text-gray-500 text-sm"
              style={{
                position: 'absolute',
                top: totalHeight,
                width: '100%',
                height: itemHeight / 2,
              }}
            >
              Tutti i ticket sono stati caricati
            </div>
          )}
        </div>
      </div>
      
      {/* Scroll indicator */}
      {isScrolling && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          Scorrimento...
        </div>
      )}
      
      {/* Performance stats in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          {tickets?.length || 0} ticket • {visibleItems.length} visibili
        </div>
      )}
    </div>
  )
}


