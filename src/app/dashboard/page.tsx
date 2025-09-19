'use client'

import React, { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useRole } from '@/providers/RoleProvider'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
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

const mockTickets = [
  {
    id: '#1234',
    title: 'Problema sistema prenotazioni',
    status: 'open',
    priority: 'high',
    assignee: 'Marco Bianchi',
    created: '2 ore fa',
    sla: 'warning',
    slaTime: '2h rimanenti',
    category: 'Software',
    description: 'Il sistema di prenotazioni non risponde correttamente...',
    comments: 3
  },
  {
    id: '#1235',
    title: 'Richiesta nuovo utente',
    status: 'in_progress',
    priority: 'medium',
    assignee: 'Te',
    created: '1 giorno fa',
    sla: 'on_time',
    slaTime: '1 giorno rimanente',
    category: 'Account',
    description: 'Creazione nuovo account per dottoressa Rossi...',
    comments: 1
  },
  {
    id: '#1236',
    title: 'Aggiornamento software',
    status: 'resolved',
    priority: 'low',
    assignee: 'Anna Verdi',
    created: '3 giorni fa',
    sla: 'on_time',
    slaTime: 'Completato',
    category: 'Manutenzione',
    description: 'Aggiornamento del software gestionale completato',
    comments: 5
  },
  {
    id: '#1237',
    title: 'Stampante non funziona',
    status: 'new',
    priority: 'urgent',
    assignee: 'Non assegnato',
    created: '30 minuti fa',
    sla: 'overdue',
    slaTime: 'SCADUTO da 15min',
    category: 'Hardware',
    description: 'La stampante del reparto cardiologia non stampa',
    comments: 0
  },
  {
    id: '#1238',
    title: 'Richiesta accesso database',
    status: 'open',
    priority: 'medium',
    assignee: 'Te',
    created: '4 ore fa',
    sla: 'on_time',
    slaTime: '4h rimanenti',
    category: 'Sicurezza',
    description: 'Il Dr. Bianchi necessita accesso al database pazienti',
    comments: 2
  }
]

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

  // No loading state needed

  const myTickets = mockTickets.filter(ticket =>
    ticket.assignee === 'Te' || ticket.assignee === user?.name
  )
  
  const clinicTickets = mockTickets.filter(ticket => 
    ticket.status !== 'resolved' && ticket.status !== 'closed'
  )

  const urgentTickets = mockTickets.filter(ticket => 
    ticket.sla === 'overdue' || ticket.priority === 'urgent'
  )

  const getSLAColor = (sla: string) => {
    switch (sla) {
      case 'overdue': return 'text-red-600 bg-red-50 border-red-200'
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'on_time': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getSLAIcon = (sla: string) => {
    switch (sla) {
      case 'overdue': return <AlertCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'on_time': return <CheckCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">
              Benvenuto, {user?.name || 'Utente'} • {user?.clinic || 'Clinica'}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/kb">
              <Button variant="outline">
                <Search className="w-4 h-4 mr-2" />
                Knowledge Base
              </Button>
            </Link>
            <Link href="/tickets/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Ticket
              </Button>
            </Link>
          </div>
        </div>



        {/* Urgent Tickets Alert */}
        {urgentTickets.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                Ticket Urgenti - Attenzione Richiesta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {urgentTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200">
                    <div className="flex items-center space-x-3">
                      <Badge variant="danger">{ticket.id}</Badge>
                      <span className="font-medium text-gray-900">{ticket.title}</span>
                      <Badge variant={ticket.priority === 'urgent' ? 'danger' : 'warning'}>
                        {priorityLabels[ticket.priority as keyof typeof priorityLabels]}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-full border ${getSLAColor(ticket.sla)}`}>
                        {getSLAIcon(ticket.sla)}
                        <span className="ml-1">{ticket.slaTime}</span>
                      </span>
                      <Button size="sm">Visualizza</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ticket Lists */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* I miei ticket */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2 text-blue-600" />
                    I miei ticket
                  </CardTitle>
                  <CardDescription>
                    Ticket assegnati a te ({myTickets.length})
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myTickets.slice(0, 4).map((ticket) => (
                  <div key={ticket.id} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="default" size="sm">{ticket.id}</Badge>
                        <Badge 
                          variant={
                            ticket.status === 'open' ? 'info' : 
                            ticket.status === 'in_progress' ? 'warning' :
                            ticket.status === 'resolved' ? 'success' : 'default'
                          }
                          size="sm"
                        >
                          {statusLabels[ticket.status as keyof typeof statusLabels]}
                        </Badge>
                        <Badge 
                          variant={
                            ticket.priority === 'urgent' ? 'danger' : 
                            ticket.priority === 'high' ? 'warning' : 'default'
                          }
                          size="sm"
                        >
                          {priorityLabels[ticket.priority as keyof typeof priorityLabels]}
                        </Badge>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full border flex items-center ${getSLAColor(ticket.sla)}`}>
                        {getSLAIcon(ticket.sla)}
                        <span className="ml-1">{ticket.slaTime}</span>
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">{ticket.title}</h4>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-1">{ticket.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-3">
                        <span>{ticket.category}</span>
                        <span className="flex items-center">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          {ticket.comments}
                        </span>
                      </div>
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {ticket.created}
                      </span>
                    </div>
                  </div>
                ))}
                {myTickets.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Ticket className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Nessun ticket assegnato</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ticket della clinica */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-green-600" />
                    Ticket della clinica
                  </CardTitle>
                  <CardDescription>
                    Ticket pubblici attivi ({clinicTickets.length})
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {clinicTickets.slice(0, 4).map((ticket) => (
                  <div key={ticket.id} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="default" size="sm">{ticket.id}</Badge>
                        <Badge 
                          variant={
                            ticket.status === 'open' ? 'info' : 
                            ticket.status === 'in_progress' ? 'warning' :
                            ticket.status === 'new' ? 'default' : 'success'
                          }
                          size="sm"
                        >
                          {statusLabels[ticket.status as keyof typeof statusLabels]}
                        </Badge>
                        <Badge 
                          variant={
                            ticket.priority === 'urgent' ? 'danger' : 
                            ticket.priority === 'high' ? 'warning' : 'default'
                          }
                          size="sm"
                        >
                          {priorityLabels[ticket.priority as keyof typeof priorityLabels]}
                        </Badge>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full border flex items-center ${getSLAColor(ticket.sla)}`}>
                        {getSLAIcon(ticket.sla)}
                        <span className="ml-1">{ticket.slaTime}</span>
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">{ticket.title}</h4>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-1">{ticket.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-3">
                        <span>{ticket.category}</span>
                        <span>Assegnato a: {ticket.assignee}</span>
                        <span className="flex items-center">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          {ticket.comments}
                        </span>
                      </div>
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {ticket.created}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}