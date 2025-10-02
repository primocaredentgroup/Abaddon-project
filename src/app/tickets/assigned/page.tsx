'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/tickets/StatusBadge'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Search, Clock, User, Filter, Calendar } from 'lucide-react'
import Link from 'next/link'

interface AssignedTicket {
  _id: string
  ticketNumber?: number
  title: string
  description: string
  status: 'open' | 'in_progress' | 'closed'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  visibility: 'public' | 'private'
  _creationTime: number
  lastActivityAt: number
  category?: {
    _id: string
    name: string
    color?: string
  }
  clinic?: {
    _id: string
    name: string
  }
  creator?: {
    _id: string
    name: string
    email: string
  }
  assignee?: {
    _id: string
    name: string
    email: string
  }
  nudgeCount?: number
  lastNudgeAt?: number
}

export default function AssignedTicketsPage() {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'updated' | 'nudged'>('newest')

  // Fetch assigned tickets (skip se user non è ancora caricato)
  const convexTickets = useQuery(
    api.tickets.getMyAssignedTicketsWithAuth,
    user?.email ? { userEmail: user.email } : "skip"
  )

  // Transform Convex data to expected format
  const assignedTickets: AssignedTicket[] = useMemo(() => {
    if (!convexTickets) return []
    
    return convexTickets.map((ticket, index) => ({
      _id: ticket._id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      visibility: ticket.visibility,
      _creationTime: ticket._creationTime,
      lastActivityAt: ticket.lastActivityAt,
      category: ticket.category ? {
        _id: ticket.category._id,
        name: ticket.category.name,
        color: ticket.category.color
      } : undefined,
      clinic: ticket.clinic ? {
        _id: ticket.clinic._id,
        name: ticket.clinic.name
      } : undefined,
      creator: ticket.creator ? {
        _id: ticket.creator._id,
        name: ticket.creator.name,
        email: ticket.creator.email
      } : undefined,
      assignee: ticket.assignee ? {
        _id: ticket.assignee._id,
        name: ticket.assignee.name,
        email: ticket.assignee.email
      } : undefined,
      nudgeCount: ticket.nudgeCount,
      lastNudgeAt: ticket.lastNudgeAt
    }))
  }, [convexTickets])

  // Filtering and sorting
  const filteredAndSortedTickets = useMemo(() => {
    let filtered = assignedTickets

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(ticket =>
        ticket.title.toLowerCase().includes(term) ||
        ticket.description.toLowerCase().includes(term) ||
        ticket.category?.name.toLowerCase().includes(term) ||
        ticket.clinic?.name.toLowerCase().includes(term) ||
        ticket.creator?.name.toLowerCase().includes(term) ||
        (ticket.ticketNumber && ticket.ticketNumber.toString().includes(term))
      )
    }

    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter(ticket => ticket.status === statusFilter)
    }

    // Sort tickets
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return a._creationTime - b._creationTime
        case 'updated':
          return b.lastActivityAt - a.lastActivityAt
        case 'nudged':
          // Prima i ticket sollecitati più di recente
          if (a.lastNudgeAt && b.lastNudgeAt) {
            return b.lastNudgeAt - a.lastNudgeAt
          }
          if (a.lastNudgeAt && !b.lastNudgeAt) return -1
          if (!a.lastNudgeAt && b.lastNudgeAt) return 1
          return b._creationTime - a._creationTime
        case 'newest':
        default:
          return b._creationTime - a._creationTime
      }
    })

    return filtered
  }, [assignedTickets, searchTerm, statusFilter, sortBy])

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return '📋'
      case 'in_progress': return '⚠️'
      case 'closed': return '✅'
      default: return '📋'
    }
  }

  // Get priority color
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate time ago
  const getTimeAgo = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m fa`
    if (hours < 24) return `${hours}h fa`
    return `${days}g fa`
  }

  if (convexTickets === undefined) {
    return <LoadingState message="Caricamento ticket assegnati..." />
  }

  if (!user) {
    return <ErrorState message="Accesso non autorizzato" />
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Ticket Assegnati a Me
        </h1>
        <p className="text-gray-600">
          Gestisci tutti i ticket che ti sono stati assegnati
        </p>
      </div>

      {/* Filters and Controls */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca per titolo, descrizione, numero..."
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              placeholder="Filtra per stato"
              options={[
                { value: '', label: 'Tutti gli stati' },
                { value: 'open', label: 'Aperti' },
                { value: 'in_progress', label: 'In Lavorazione' },
                { value: 'closed', label: 'Chiusi' }
              ]}
            />

            {/* Sort By */}
            <Select
              value={sortBy}
              onChange={(value) => setSortBy(value as any)}
              placeholder="Ordina per"
              options={[
                { value: 'newest', label: 'Più recenti' },
                { value: 'oldest', label: 'Più vecchi' },
                { value: 'updated', label: 'Ultima attività' },
                { value: 'nudged', label: 'Sollecitati' }
              ]}
            />

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('')
                setSortBy('newest')
              }}
              className="w-full"
            >
              <Filter className="h-4 w-4 mr-2" />
              Pulisci Filtri
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Totali</p>
                <p className="text-2xl font-bold text-gray-900">{assignedTickets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Lavorazione</p>
                <p className="text-2xl font-bold text-gray-900">
                  {assignedTickets.filter(t => t.status === 'in_progress').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <Calendar className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Sollecitati</p>
                <p className="text-2xl font-bold text-gray-900">
                  {assignedTickets.filter(t => t.nudgeCount && t.nudgeCount > 0).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Aperti</p>
                <p className="text-2xl font-bold text-gray-900">
                  {assignedTickets.filter(t => t.status === 'open').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets List */}
      {filteredAndSortedTickets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {assignedTickets.length === 0 
                ? 'Nessun ticket assegnato' 
                : 'Nessun ticket trovato con i filtri selezionati'
              }
            </h3>
            <p className="text-gray-500 mb-4">
              {assignedTickets.length === 0 
                ? 'Al momento non hai ticket assegnati. I nuovi ticket appariranno qui quando ti verranno assegnati.'
                : 'Prova a modificare i filtri di ricerca per vedere più risultati.'
              }
            </p>
            {assignedTickets.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('')
                  setSortBy('newest')
                }}
              >
                Mostra tutti i ticket
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedTickets.map((ticket) => (
            <Card key={ticket._id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center space-x-3 mb-3">
                      <Link
                        href={`/tickets/${ticket._id}`}
                        className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        #{ticket.ticketNumber || 'N/A'} - {ticket.title}
                      </Link>
                      
                      {/* Nudge indicator */}
                      {ticket.nudgeCount && ticket.nudgeCount > 0 && (
                        <Badge className="bg-red-100 text-red-800 text-xs">
                          🔔 {ticket.nudgeCount} sollecito{ticket.nudgeCount > 1 ? 'i' : ''}
                        </Badge>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                      <StatusBadge status={ticket.status} showIcon />
                      
                      {ticket.category && (
                        <div className="flex items-center">
                          <span className="w-2 h-2 rounded-full mr-2" 
                                style={{ backgroundColor: ticket.category.color || '#6B7280' }} />
                          {ticket.category.name}
                        </div>
                      )}
                      
                      {ticket.clinic && (
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          {ticket.clinic.name}
                        </div>
                      )}

                      {ticket.priority && (
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority.toUpperCase()}
                        </Badge>
                      )}
                    </div>

                    {/* Description preview */}
                    <p className="text-gray-700 mb-3 line-clamp-2">
                      {ticket.description}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center space-x-4">
                        <span>
                          Creato da {ticket.creator?.name || 'Sconosciuto'}
                        </span>
                        <span>
                          <Calendar className="h-4 w-4 inline mr-1" />
                          {formatDate(ticket._creationTime)}
                        </span>
                        {ticket.lastActivityAt !== ticket._creationTime && (
                          <span>
                            <Clock className="h-4 w-4 inline mr-1" />
                            Aggiornato {getTimeAgo(ticket.lastActivityAt)}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex space-x-2">
                        <Link href={`/tickets/${ticket._id}`}>
                          <Button size="sm" variant="outline">
                            Apri Ticket
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Footer Info */}
      {filteredAndSortedTickets.length > 0 && (
        <div className="mt-6 text-center text-sm text-gray-500">
          Mostrando {filteredAndSortedTickets.length} di {assignedTickets.length} ticket assegnati
        </div>
      )}
    </div>
  )
}
