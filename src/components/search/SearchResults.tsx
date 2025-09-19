'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/tickets/StatusBadge'

interface SearchResultsProps {
  tickets: any[]
  total: number
  isLoading: boolean
  hasMore: boolean
  currentPage: number
  pageSize: number
  onTicketClick: (ticketId: string) => void
  onNextPage: () => void
  onPrevPage: () => void
  onGoToPage: (page: number) => void
  className?: string
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  tickets,
  total,
  isLoading,
  hasMore,
  currentPage,
  pageSize,
  onTicketClick,
  onNextPage,
  onPrevPage,
  onGoToPage,
  className = '',
}) => {
  const totalPages = Math.ceil(total / pageSize)
  const startIndex = currentPage * pageSize + 1
  const endIndex = Math.min((currentPage + 1) * pageSize, total)

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getTimeAgo = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days} giorni fa`
    if (hours > 0) return `${hours} ore fa`
    return 'Meno di un\'ora fa'
  }

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[...Array(5)].map((_, index) => (
          <Card key={index} className="p-6 animate-pulse">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              <div className="flex items-center space-x-4">
                <div className="h-3 bg-gray-200 rounded w-20"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <Card className={`p-8 text-center ${className}`}>
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nessun ticket trovato
        </h3>
        <p className="text-gray-600">
          Prova a modificare i filtri di ricerca o i termini utilizzati.
        </p>
      </Card>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Results header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Mostrando {startIndex}-{endIndex} di {total} ticket
        </div>
        <div className="text-sm text-gray-500">
          Pagina {currentPage + 1} di {totalPages}
        </div>
      </div>

      {/* Results list */}
      <div className="space-y-3">
        {tickets.map((ticket) => (
          <Card
            key={ticket._id}
            className="p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onTicketClick(ticket._id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Title and status */}
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {ticket.title}
                  </h3>
                  <StatusBadge status={ticket.status} size="sm" />
                  {ticket.visibility === 'public' && (
                    <Badge color="blue" size="sm">
                      Pubblico
                    </Badge>
                  )}
                </div>

                {/* Description preview */}
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                  {ticket.description}
                </p>

                {/* Metadata */}
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <span>📂</span>
                    <span>{ticket.category?.name || 'Senza categoria'}</span>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <span>👤</span>
                    <span>{ticket.creator?.name || 'Utente sconosciuto'}</span>
                  </div>

                  {ticket.assignee && (
                    <div className="flex items-center space-x-1">
                      <span>🎯</span>
                      <span>{ticket.assignee.name}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-1">
                    <span>📅</span>
                    <span>{formatDate(ticket._creationTime)}</span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <span>⏰</span>
                    <span>{getTimeAgo(ticket.lastActivityAt)}</span>
                  </div>
                </div>
              </div>

              {/* Ticket ID */}
              <div className="ml-4 text-xs text-gray-400 font-mono">
                #{ticket._id.slice(-8)}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onPrevPage}
                disabled={currentPage === 0}
              >
                ← Precedente
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onNextPage}
                disabled={!hasMore}
              >
                Successivo →
              </Button>
            </div>

            {/* Page numbers */}
            <div className="flex items-center space-x-1">
              {[...Array(Math.min(totalPages, 7))].map((_, index) => {
                let pageNumber: number
                
                if (totalPages <= 7) {
                  pageNumber = index
                } else if (currentPage < 3) {
                  pageNumber = index
                } else if (currentPage > totalPages - 4) {
                  pageNumber = totalPages - 7 + index
                } else {
                  pageNumber = currentPage - 3 + index
                }

                const isActive = pageNumber === currentPage

                return (
                  <Button
                    key={pageNumber}
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    onClick={() => onGoToPage(pageNumber)}
                    className="min-w-[32px]"
                  >
                    {pageNumber + 1}
                  </Button>
                )
              })}
            </div>

            <div className="text-sm text-gray-500">
              {total} risultati totali
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}


