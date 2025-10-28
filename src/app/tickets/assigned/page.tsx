'use client'

import React, { useState, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useAuth } from '@/hooks/useAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { PriorityLevel } from '@/components/tickets/PriorityLevel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/tickets/StatusBadge'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useToast } from '@/components/ui/use-toast'
import { Search, Clock, User, Filter, Calendar, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { Id } from '@/convex/_generated/dataModel'

interface AssignedTicket {
  _id: string
  ticketNumber?: number
  title: string
  description: string
  status: 'open' | 'in_progress' | 'closed'
  priority?: number // 1-5: 1=Molto Bassa, 2=Bassa, 3=Media, 4=Alta, 5=Urgente
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

const priorityOptions = [
  { value: 'all', label: 'Tutte' },
  { value: '1', label: '🔥 Molto Bassa' },
  { value: '2', label: '🔥🔥 Bassa' },
  { value: '3', label: '🔥🔥🔥 Media' },
  { value: '4', label: '🔥🔥🔥🔥 Alta' },
  { value: '5', label: '🔥🔥🔥🔥🔥 Urgente' },
];

export default function AssignedTicketsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'updated' | 'nudged'>('newest')
  const [assigningTicket, setAssigningTicket] = useState<string | null>(null)
  
  // Mutation per assegnare ticket a se stessi
  const assignToMe = useMutation(api.tickets.assignToMe)

  // Fetch "Ticket da gestire" - include ticket assegnati + ticket nelle competenze
  const convexTickets = useQuery(
    api.ticketsToManage.getTicketsToManage,
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

    // Filter by priority
    if (priorityFilter && priorityFilter !== 'all') {
      const targetPriority = parseInt(priorityFilter);
      filtered = filtered.filter(ticket => ticket.priority === targetPriority)
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
  }, [assignedTickets, searchTerm, statusFilter, priorityFilter, sortBy])

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
  // Rimossa getPriorityColor - ora usiamo il componente PriorityLevel

  // Handler per assegnare ticket a se stessi
  const handleAssignToMe = async (ticketId: string) => {
    if (!user?.email) {
      toast({
        title: 'Errore',
        description: 'Devi essere autenticato',
        variant: 'destructive'
      })
      return
    }

    setAssigningTicket(ticketId)
    
    try {
      const result = await assignToMe({ 
        ticketId: ticketId as Id<"tickets">, 
        userEmail: user.email 
      })

      if (result.alreadyAssigned) {
        toast({
          title: 'Già assegnato',
          description: 'Questo ticket è già assegnato a te',
          variant: 'default'
        })
      } else {
        toast({
          title: 'Ticket assegnato',
          description: 'Il ticket è stato assegnato con successo',
          variant: 'default'
        })
      }
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile assegnare il ticket',
        variant: 'destructive'
      })
    } finally {
      setAssigningTicket(null)
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
    return (
      <AppLayout>
        <LoadingState message="Caricamento ticket assegnati..." />
      </AppLayout>
    )
  }

  if (!user) {
    return (
      <AppLayout>
        <ErrorState message="Accesso non autorizzato" />
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Ticket da Gestire
        </h1>
        <p className="text-gray-600">
          Gestisci i ticket assegnati a te e quelli delle tue categorie di competenza
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

            {/* Priority Filter */}
            <Select
              value={priorityFilter}
              onChange={(value) => setPriorityFilter(value)}
              placeholder="Filtra per priorità"
              options={priorityOptions}
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
                setPriorityFilter('all')
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
                  setPriorityFilter('all')
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
                        <div className="flex items-center">
                          <PriorityLevel
                            value={ticket.priority}
                            readonly={true}
                            showLabel={true}
                          />
                        </div>
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
                        {/* Mostra "Assegna a me" solo se il ticket NON è assegnato all'utente corrente */}
                        {ticket.assignee?._id !== user?.id && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleAssignToMe(ticket._id)}
                            disabled={assigningTicket === ticket._id}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            {assigningTicket === ticket._id ? 'Assegnazione...' : 'Assegna a me'}
                          </Button>
                        )}
                        <Link href={`/tickets/${ticket._id}`}>
                          <Button size="sm">
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
    </AppLayout>
  )
}
