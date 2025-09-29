'use client'

import React, { useState, useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { AppLayout } from '@/components/layout/AppLayout'
import { useRole } from '@/providers/RoleProvider'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ChangeUserRoleFixed } from '@/components/admin/ChangeUserRoleFixed'
import { 
  Plus, 
  Ticket, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  Filter,
  Search,
  Eye,
  MessageSquare,
  Calendar,
  Users,
  Activity
} from 'lucide-react'
import Link from 'next/link'

const statusLabels = {
  new: 'Nuovo',
  open: 'Aperto',
  in_progress: 'In lavorazione',
  resolved: 'Risolto',
  closed: 'Chiuso'
}

const priorityLabels = {
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente'
}

export default function DashboardPage() {
  const { role, user } = useRole()
  const { user: authUser, isLoading } = useAuth()
  const router = useRouter()
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Fetch dei ticket reali da Convex
  const myTicketsData = useQuery(api.tickets.getMyCreatedWithAuth, { userEmail: user?.email })

  // Controllo autenticazione: reindirizza al login se non autenticato
  useEffect(() => {
    if (!isLoading && !authUser) {
      console.log('🚫 Accesso negato alla dashboard: utente non autenticato')
      router.push('/')
      return
    }
  }, [authUser, isLoading, router])

  // Redirect agenti alla dashboard specializzata
  useEffect(() => {
    if (role === 'agent') {
      router.push('/dashboard/agent')
    }
  }, [role, router])

  // Mostra loading se sta controllando autenticazione
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando autenticazione...</p>
        </div>
      </div>
    )
  }

  // Se non autenticato, non mostrare nulla (il redirect è in corso)
  if (!authUser) {
    return null
  }

  // Elabora i dati reali (NO MOCK!)
  const myTickets = (myTicketsData || []).map((ticket: any) => ({
    id: `#${ticket.ticketNumber || 'N/A'}`,
    title: ticket.title,
    status: ticket.status,
    priority: 'medium', // Default
    assignee: ticket.assignee?.name || 'Non assegnato',
    created: new Date(ticket._creationTime).toLocaleDateString(),
    category: ticket.category?.name || 'N/A',
    description: ticket.description,
    _id: ticket._id
  }))

  const stats = {
    total: myTickets.length,
    open: myTickets.filter(t => t.status === 'open').length,
    inProgress: myTickets.filter(t => t.status === 'in_progress').length,
    resolved: myTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
  }

  const recentTickets = myTickets
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
    .slice(0, 5)

  const filteredTickets = myTickets.filter(ticket => {
    const matchesSearch = searchTerm === '' ||
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = selectedFilter === 'all' || ticket.status === selectedFilter
    
    return matchesSearch && matchesFilter
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <AlertCircle className="h-4 w-4 text-blue-600" />
      case 'open':
        return <Clock className="h-4 w-4 text-orange-600" />
      case 'in_progress':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'resolved':
      case 'closed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800'
      case 'open':
        return 'bg-orange-100 text-orange-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'resolved':
      case 'closed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Benvenuto, {user?.name || 'Utente'}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/tickets/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Ticket
              </Button>
            </Link>
          </div>
        </div>

        {/* Statistiche principali */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Totali</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                I tuoi ticket
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aperti</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.open}</div>
              <p className="text-xs text-muted-foreground">
                Da completare
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Lavorazione</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground">
                In corso
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Risolti</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
              <p className="text-xs text-muted-foreground">
                Completati
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Tools - Solo per amministratori */}
        {role === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Strumenti Amministrazione
              </CardTitle>
              <CardDescription>
                Gestione utenti e configurazione sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangeUserRoleFixed />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ticket Recenti */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Ticket Recenti
                </span>
                <Link href="/tickets/my">
                  <Button variant="ghost" size="sm">
                    Vedi tutti
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentTickets.length === 0 ? (
                <div className="text-center py-8">
                  <Ticket className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Nessun ticket recente</p>
                  <Link href="/tickets/new" className="mt-2 inline-block">
                    <Button size="sm" variant="outline">
                      Crea il tuo primo ticket
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTickets.map((ticket) => (
                    <div key={ticket.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(ticket.status)}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{ticket.title}</p>
                          <p className="text-xs text-gray-500">{ticket.id} • {ticket.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          className={`text-xs ${getStatusColor(ticket.status)}`}
                        >
                          {statusLabels[ticket.status as keyof typeof statusLabels]}
                        </Badge>
                        <Link href={`/tickets/${ticket._id}`}>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attività Recente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Attività Recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {myTickets.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Nessuna attività recente</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myTickets.slice(0, 5).map((ticket) => (
                      <div key={ticket.id} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">
                            Hai creato il ticket <strong>{ticket.id}</strong>
                          </p>
                          <p className="text-xs text-gray-500">{ticket.created}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}