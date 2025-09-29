'use client'

import React, { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { AppLayout } from '@/components/layout/AppLayout'
import { useRole } from '@/providers/RoleProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { 
  AlertTriangle, 
  Clock, 
  Ticket, 
  CheckCircle, 
  AlertCircle,
  Activity,
  Filter,
  Search,
  Eye,
  UserCheck
} from 'lucide-react'
import Link from 'next/link'

export default function AgentDashboardPage() {
  const { user } = useRole()
  
  // Fetch dei dati reali da Convex
  const myCreatedTickets = useQuery(api.tickets.getMyCreatedWithAuth, { userEmail: user?.email }) || []
  const myAssignedTickets = useQuery(api.tickets.getMyAssignedTicketsWithAuth, { userEmail: user?.email }) || []
  const myClinicTickets = useQuery(api.tickets.getMyClinicTicketsWithAuth, { userEmail: user?.email }) || []

  // Calcola statistiche reali
  const stats = {
    totalCreated: myCreatedTickets.length,
    totalAssigned: myAssignedTickets.length,
    totalClinic: myClinicTickets.length,
    openAssigned: myAssignedTickets.filter(t => t.status === 'open').length,
    urgentTickets: [...myCreatedTickets, ...myAssignedTickets].filter(t => t.priority === 'urgent').length
  }

  // Ticket recenti creati
  const recentCreated = myCreatedTickets
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, 3)
    .map((ticket: any) => ({
      id: `#${ticket.ticketNumber || 'N/A'}`,
      title: ticket.title,
      status: ticket.status,
      priority: 'medium',
      created: new Date(ticket._creationTime).toLocaleDateString(),
      category: ticket.category?.name || 'N/A',
      _id: ticket._id
    }))

  // Ticket assegnati
  const recentAssigned = myAssignedTickets
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, 3)
    .map((ticket: any) => ({
      id: `#${ticket.ticketNumber || 'N/A'}`,
      title: ticket.title,
      status: ticket.status,
      priority: 'medium',
      created: new Date(ticket._creationTime).toLocaleDateString(),
      category: ticket.category?.name || 'N/A',
      _id: ticket._id
    }))

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
            <h1 className="text-3xl font-bold text-gray-900">Dashboard Agente</h1>
            <p className="text-gray-600 mt-1">
              Benvenuto, {user?.name || 'Agente'}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/tickets/new">
              <Button>
                <Ticket className="h-4 w-4 mr-2" />
                Nuovo Ticket
              </Button>
            </Link>
          </div>
        </div>

        {/* Statistiche principali */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Creati</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCreated}</div>
              <p className="text-xs text-muted-foreground">
                Ticket che hai creato
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assegnati a Te</CardTitle>
              <UserCheck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.totalAssigned}</div>
              <p className="text-xs text-muted-foreground">
                Da gestire
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Clinica</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.totalClinic}</div>
              <p className="text-xs text-muted-foreground">
                Nelle tue cliniche
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aperti Assegnati</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.openAssigned}</div>
              <p className="text-xs text-muted-foreground">
                Priorità alta
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ticket che ho creato */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Ticket className="h-5 w-5 mr-2" />
                  I Miei Ticket Creati
                </span>
                <Link href="/tickets/my">
                  <Button variant="ghost" size="sm">
                    Vedi tutti
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentCreated.length === 0 ? (
                <div className="text-center py-8">
                  <Ticket className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Nessun ticket creato</p>
                  <Link href="/tickets/new" className="mt-2 inline-block">
                    <Button size="sm" variant="outline">
                      Crea il tuo primo ticket
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentCreated.map((ticket) => (
                    <div key={ticket.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(ticket.status)}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{ticket.title}</p>
                          <p className="text-xs text-gray-500">{ticket.id} • {ticket.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={`text-xs ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
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

          {/* Ticket assegnati a me */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <UserCheck className="h-5 w-5 mr-2" />
                  Ticket Assegnati
                </span>
                <Link href="/tickets/my">
                  <Button variant="ghost" size="sm">
                    Vedi tutti
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentAssigned.length === 0 ? (
                <div className="text-center py-8">
                  <UserCheck className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Nessun ticket assegnato</p>
                  <p className="text-xs text-gray-500 mt-1">
                    I ticket ti verranno assegnati automaticamente
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentAssigned.map((ticket) => (
                    <div key={ticket.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(ticket.status)}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{ticket.title}</p>
                          <p className="text-xs text-gray-500">{ticket.id} • {ticket.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={`text-xs ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
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
        </div>
      </div>
    </AppLayout>
  )
}