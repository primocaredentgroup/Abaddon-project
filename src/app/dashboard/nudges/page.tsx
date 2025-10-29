'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { PriorityLevel } from '@/components/tickets/PriorityLevel';
import { useRole } from '@/providers/RoleProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import {
  Bell,
  Clock,
  AlertTriangle,
  User,
  Building,
  Calendar,
  ArrowRight,
  Eye,
  Shield
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const priorityOptions = [
  { value: 'all', label: 'Tutte' },
  { value: '1', label: '🔥 Molto Bassa' },
  { value: '2', label: '🔥🔥 Bassa' },
  { value: '3', label: '🔥🔥🔥 Media' },
  { value: '4', label: '🔥🔥🔥🔥 Alta' },
  { value: '5', label: '🔥🔥🔥🔥🔥 Urgente' },
];

export default function NudgedTicketsPage() {
  const { user, role } = useRole();
  const [assigningTicket, setAssigningTicket] = useState<string | null>(null); // 🆕 Loading state
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  
  // Fetch di TUTTI i ticket da risolvere (aperti e in corso)
  const allTickets = useQuery(
    api.tickets.getNudgedTickets, 
    user?.email ? { userEmail: user.email } : "skip"
  ) || [];
  
  // 🆕 Mutation per auto-assegnazione
  const assignTicket = useMutation(api.tickets.assign);

  // 🔒 CONTROLLO ACCESSO: Solo admin possono vedere questa pagina
  if (role !== 'admin') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Riservato</h1>
            <p className="text-gray-600">Solo gli amministratori possono accedere alla gestione dei ticket sollecitati.</p>
            <Link href="/dashboard">
              <Button className="mt-4">
                Torna alla Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  // 🆕 Separa ticket sollecitati e non assegnati
  let nudgedTickets = allTickets.filter((t: any) => (t.nudgeCount || 0) > 0);
  let unassignedTickets = allTickets.filter((t: any) => !t.assigneeId && (t.nudgeCount || 0) === 0);
  
  // Applica filtro priorità a entrambi
  if (priorityFilter && priorityFilter !== 'all') {
    const targetPriority = parseInt(priorityFilter);
    nudgedTickets = nudgedTickets.filter((t: any) => t.priority === targetPriority);
    unassignedTickets = unassignedTickets.filter((t: any) => t.priority === targetPriority);
  }
  
  // Ordina SEMPRE per priorità (5 urgente prima, poi 4, 3, 2, 1), poi per data creazione
  const sortByPriority = (a: any, b: any) => {
    const priorityDiff = (b.priority || 1) - (a.priority || 1);
    if (priorityDiff !== 0) return priorityDiff;
    return b._creationTime - a._creationTime;
  };
  
  nudgedTickets = nudgedTickets.sort(sortByPriority);
  unassignedTickets = unassignedTickets.sort(sortByPriority);

  const getUrgencyLevel = (nudgeCount: number, lastNudgeAt: number) => {
    const hoursAgo = (Date.now() - lastNudgeAt) / (1000 * 60 * 60);
    
    if (nudgeCount >= 3 || hoursAgo < 2) {
      return { level: 'urgent', color: 'bg-red-100 text-red-800', label: 'Urgente' };
    } else if (nudgeCount >= 2 || hoursAgo < 12) {
      return { level: 'high', color: 'bg-orange-100 text-orange-800', label: 'Alta' };
    } else {
      return { level: 'normal', color: 'bg-yellow-100 text-yellow-800', label: 'Normale' };
    }
  };

  // 🆕 Funzione per auto-assegnazione ticket
  const handleAssignToMe = async (ticketId: string, ticketNumber: string) => {
    if (!user?.id) {
      toast.error('❌ Errore: ID utente non trovato');
      return;
    }

    setAssigningTicket(ticketId); // Mostra loading
    
    try {
      await assignTicket({
        ticketId: ticketId as any,
        assigneeId: user.id as any,
      });
      
      toast.success(`✅ Ticket #${ticketNumber} assegnato con successo!`, {
        duration: 3000,
      });
    } catch (error) {
      console.error('Errore nell\'assegnazione:', error);
      toast.error('❌ Errore nell\'assegnare il ticket. Riprova.');
    } finally {
      setAssigningTicket(null); // Rimuovi loading
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Bell className="h-8 w-8 mr-3 text-orange-600" />
              Ticket da Gestire
            </h1>
            <p className="text-gray-600 mt-1">
              Tutti i ticket aperti e in corso • {allTickets.length} totali • {nudgedTickets.length} con sollecito
            </p>
          </div>
        </div>

        {/* Statistiche rapide */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Totali</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allTickets.length}</div>
              <p className="text-xs text-muted-foreground">
                Aperti e in corso
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Con Sollecito</CardTitle>
              <Bell className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{nudgedTickets.length}</div>
              <p className="text-xs text-muted-foreground">
                Richiedono attenzione
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Urgenti</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {allTickets.filter((t: any) => (t.nudgeCount || 0) >= 3).length}
              </div>
              <p className="text-xs text-muted-foreground">
                3+ solleciti
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Non Assegnati</CardTitle>
              <User className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {allTickets.filter((t: any) => !t.assigneeId).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Da assegnare
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtri */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Filtra per priorità:</label>
              <Select
                value={priorityFilter}
                onChange={(value) => setPriorityFilter(value)}
                placeholder="Filtra per priorità"
                options={priorityOptions}
                className="w-64"
              />
            </div>
          </CardContent>
        </Card>

        {/* 🆕 Sezione: Ticket Sollecitati */}
        {nudgedTickets.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Bell className="h-6 w-6 mr-2 text-orange-600" />
                Ticket Sollecitati
                <Badge className="ml-3 bg-orange-100 text-orange-800">{nudgedTickets.length}</Badge>
              </h2>
            </div>

        {/* Lista ticket sollecitati */}
        {nudgedTickets.length === 0 && priorityFilter !== 'all' ? (
          <Card>
            <CardContent className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nessun ticket trovato con questi filtri
              </h3>
              <p className="text-gray-600">
                Prova a modificare il filtro priorità per vedere più risultati.
              </p>
              <Button
                variant="outline"
                onClick={() => setPriorityFilter('all')}
                className="mt-4"
              >
                Mostra tutti i ticket
              </Button>
            </CardContent>
          </Card>
        ) : allTickets.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nessun ticket da risolvere
              </h3>
              <p className="text-gray-600">
                Ottimo lavoro! Non ci sono ticket aperti al momento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {nudgedTickets.map((ticket: any) => {
              const isNudged = (ticket.nudgeCount || 0) > 0;
              const urgency = isNudged ? getUrgencyLevel(ticket.nudgeCount || 0, ticket.lastNudgeAt || 0) : null;
              const hoursAgo = ticket.lastNudgeAt ? Math.floor((Date.now() - ticket.lastNudgeAt) / (1000 * 60 * 60)) : null;
              
              // Bordo colorato solo per ticket sollecitati
              const borderClass = isNudged 
                ? (ticket.nudgeCount >= 3 ? "border-l-red-500" : "border-l-orange-500")
                : "border-l-gray-300";
              
              return (
                <Card key={ticket._id} className={`border-l-4 ${borderClass}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Header ticket */}
                        <div className="flex items-center space-x-3 mb-3">
                          <Badge className="text-sm font-semibold">
                            #{ticket.ticketNumber || 'N/A'}
                          </Badge>
                          
                          {/* Badge sollecitato - mostra solo se sollecitato */}
                          {isNudged && urgency && (
                            <Badge className={`text-xs ${urgency.color}`}>
                              <Bell className="h-3 w-3 mr-1" />
                              {urgency.label} ({ticket.nudgeCount} solleciti)
                            </Badge>
                          )}
                          
                          <Badge 
                            variant={
                              ticket.status === 'open' ? 'destructive' :
                              ticket.status === 'in_progress' ? 'secondary' : 'outline'
                            }
                            className="text-xs"
                          >
                            {ticket.status === 'in_progress' ? 'In corso' : 
                             ticket.status === 'open' ? 'Aperto' : 'Nuovo'}
                          </Badge>
                        </div>

                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {ticket.title}
                        </h3>
                        
                        <p className="text-gray-700 mb-4 line-clamp-2">
                          {ticket.description}
                        </p>

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1" />
                            <span>Creato da: {ticket.creator?.name || 'N/A'}</span>
                          </div>
                          <div className="flex items-center">
                            <Building className="h-4 w-4 mr-1" />
                            <span>{ticket.clinic?.name || 'N/A'}</span>
                          </div>
                          
                          {/* Priorità */}
                          {ticket.priority && (
                            <div className="flex items-center">
                              <PriorityLevel
                                value={ticket.priority}
                                readonly={true}
                                showLabel={true}
                              />
                            </div>
                          )}
                          
                          {/* Mostra info sollecito solo se sollecitato */}
                          {isNudged && hoursAgo !== null && (
                            <div className="flex items-center text-orange-600 font-medium">
                              <Bell className="h-4 w-4 mr-1" />
                              <span>Sollecitato {hoursAgo}h fa</span>
                            </div>
                          )}
                          
                          {ticket.assigneeId && (
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              <span>Assegnato a: {ticket.assignee?.name || 'N/A'}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Azioni */}
                      <div className="flex flex-col gap-2 ml-4">
                        <Link href={`/tickets/${ticket._id}`}>
                          <Button size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            Apri ticket
                          </Button>
                        </Link>
                        
                        {!ticket.assigneeId && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleAssignToMe(ticket._id, ticket.ticketNumber)}
                            disabled={assigningTicket === ticket._id}
                          >
                            {assigningTicket === ticket._id ? (
                              <>
                                <Clock className="h-4 w-4 mr-2 animate-spin" />
                                Assegnazione...
                              </>
                            ) : (
                              <>
                                <User className="h-4 w-4 mr-2" />
                                Assegna a me
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          </div>
        )}

        {/* 🆕 Sezione: Ticket Non Assegnati */}
        {unassignedTickets.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <User className="h-6 w-6 mr-2 text-blue-600" />
                Ticket Non Assegnati
                <Badge className="ml-3 bg-blue-100 text-blue-800">{unassignedTickets.length}</Badge>
              </h2>
              <p className="text-sm text-gray-600">Ticket in attesa di assegnazione</p>
            </div>

            {unassignedTickets.map((ticket: any) => (
              <Card key={ticket._id} className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <Link href={`/tickets/${ticket.ticketNumber}`}>
                            <h3 className="text-lg font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                              #{ticket.ticketNumber} - {ticket.title}
                            </h3>
                          </Link>
                          <p className="text-sm text-gray-600 mt-1">
                            {ticket.description?.substring(0, 150)}{ticket.description?.length > 150 ? '...' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <PriorityLevel value={ticket.priority || 1} readonly showLabel />
                        </div>
                        <div className="flex items-center">
                          <Building className="h-4 w-4 mr-1" />
                          {ticket.clinic?.name || 'N/A'}
                        </div>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          Creato da: {ticket.creator?.name || 'N/A'}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {new Date(ticket._creationTime).toLocaleDateString('it-IT')}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-4">
                      <Link href={`/tickets/${ticket.ticketNumber}`}>
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizza
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleAssignToMe(ticket._id, ticket.ticketNumber)}
                        disabled={assigningTicket === ticket._id}
                      >
                        {assigningTicket === ticket._id ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Assegnazione...
                          </>
                        ) : (
                          <>
                            <User className="h-4 w-4 mr-2" />
                            Assegna a me
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {nudgedTickets.length === 0 && unassignedTickets.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Tutti i ticket sono gestiti!
              </h3>
              <p className="text-gray-600">
                Non ci sono ticket sollecitati o da assegnare al momento.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
