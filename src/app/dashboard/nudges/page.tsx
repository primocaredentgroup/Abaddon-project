'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useRole } from '@/providers/RoleProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Bell,
  Clock,
  AlertTriangle,
  User,
  Building,
  Calendar,
  ArrowRight,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NudgedTicketsPage() {
  const { user } = useRole();
  const [assigningTicket, setAssigningTicket] = useState<string | null>(null); // 🆕 Loading state
  
  // Fetch di TUTTI i ticket da risolvere (aperti e in corso)
  const allTickets = useQuery(
    api.tickets.getNudgedTickets, 
    user?.email ? { userEmail: user.email } : "skip"
  ) || [];
  
  // 🆕 Mutation per auto-assegnazione
  const assignTicket = useMutation(api.tickets.assign);

  // Solo agenti e admin possono vedere questa pagina
  if (user?.roleName !== 'Agente' && user?.roleName !== 'Amministratore') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Accesso riservato agli agenti</p>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  // Conta i ticket sollecitati
  const nudgedTickets = allTickets.filter((t: any) => (t.nudgeCount || 0) > 0);

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

        {/* Lista ticket da risolvere */}
        {allTickets.length === 0 ? (
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
            {allTickets.map((ticket: any) => {
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
        )}
      </div>
    </AppLayout>
  );
}
