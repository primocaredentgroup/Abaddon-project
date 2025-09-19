'use client';

import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useRole } from '@/providers/RoleProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import {
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  Ticket as TicketIcon,
  Clock,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  ArrowUpDown,
  Pencil
} from 'lucide-react';
import Link from 'next/link';

// Dati mock estesi per testare la paginazione
type Ticket = {
  id: string;
  title: string;
  description: string;
  status: 'new' | 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee: string;
  created: string;
  sla: 'on_time' | 'warning' | 'overdue';
  slaTime: string;
  category: string;
  visibility: 'public' | 'private';
  comments: number;
};
const mockTickets: Ticket[] = [
  {
    id: '#1234',
    title: 'Problema sistema prenotazioni',
    description: 'Il sistema di prenotazioni non risponde correttamente alle richieste degli utenti',
    status: 'open',
    priority: 'high',
    assignee: 'Marco Bianchi',
    created: '2 ore fa',
    sla: 'warning',
    slaTime: '2h rimanenti',
    category: 'Software',
    visibility: 'public',
    comments: 3
  },
  {
    id: '#1235',
    title: 'Richiesta nuovo utente',
    description: 'Creazione nuovo account per dottoressa Rossi nel sistema gestionale',
    status: 'in_progress',
    priority: 'medium',
    assignee: 'Te',
    created: '1 giorno fa',
    sla: 'on_time',
    slaTime: '1 giorno rimanente',
    category: 'Account',
    visibility: 'private',
    comments: 1
  },
  {
    id: '#1236',
    title: 'Aggiornamento software',
    description: 'Aggiornamento del software gestionale completato con successo',
    status: 'resolved',
    priority: 'low',
    assignee: 'Anna Verdi',
    created: '3 giorni fa',
    sla: 'on_time',
    slaTime: 'Completato',
    category: 'Manutenzione',
    visibility: 'public',
    comments: 5
  },
  {
    id: '#1237',
    title: 'Stampante non funziona',
    description: 'La stampante del reparto cardiologia non stampa correttamente',
    status: 'new',
    priority: 'urgent',
    assignee: 'Non assegnato',
    created: '30 minuti fa',
    sla: 'overdue',
    slaTime: 'SCADUTO da 15min',
    category: 'Hardware',
    visibility: 'public',
    comments: 0
  },
  {
    id: '#1238',
    title: 'Richiesta accesso database',
    description: 'Il Dr. Bianchi necessita accesso al database pazienti per ricerca',
    status: 'open',
    priority: 'medium',
    assignee: 'Te',
    created: '4 ore fa',
    sla: 'on_time',
    slaTime: '4h rimanenti',
    category: 'Sicurezza',
    visibility: 'private',
    comments: 2
  },
  {
    id: '#1239',
    title: 'Configurazione email automatica',
    description: 'Impostazione notifiche email automatiche per nuovi appuntamenti',
    status: 'in_progress',
    priority: 'low',
    assignee: 'Luca Rossi',
    created: '6 ore fa',
    sla: 'on_time',
    slaTime: '18h rimanenti',
    category: 'Software',
    visibility: 'public',
    comments: 4
  },
  {
    id: '#1240',
    title: 'Problema connessione VPN',
    description: 'Utenti remoti non riescono a connettersi via VPN aziendale',
    status: 'open',
    priority: 'high',
    assignee: 'Sara Neri',
    created: '8 ore fa',
    sla: 'warning',
    slaTime: '4h rimanenti',
    category: 'Rete',
    visibility: 'public',
    comments: 2
  },
  {
    id: '#1241',
    title: 'Backup dati pazienti',
    description: 'Verifica e configurazione backup automatico dati sensibili',
    status: 'pending',
    priority: 'medium',
    assignee: 'Marco Bianchi',
    created: '1 giorno fa',
    sla: 'on_time',
    slaTime: '23h rimanenti',
    category: 'Sicurezza',
    visibility: 'private',
    comments: 1
  },
  {
    id: '#1242',
    title: 'Aggiornamento antivirus',
    description: 'Installazione aggiornamenti sicurezza su tutti i workstation',
    status: 'resolved',
    priority: 'low',
    assignee: 'Anna Verdi',
    created: '2 giorni fa',
    sla: 'on_time',
    slaTime: 'Completato',
    category: 'Sicurezza',
    visibility: 'public',
    comments: 3
  },
  {
    id: '#1243',
    title: 'Monitor esterno rotto',
    description: 'Il monitor del desk reception non si accende più',
    status: 'closed',
    priority: 'low',
    assignee: 'Luca Rossi',
    created: '3 giorni fa',
    sla: 'on_time',
    slaTime: 'Completato',
    category: 'Hardware',
    visibility: 'public',
    comments: 2
  }
];

const statusLabels = {
  new: 'Nuovo',
  open: 'Aperto',
  in_progress: 'In lavorazione',
  pending: 'In attesa',
  resolved: 'Risolto',
  closed: 'Chiuso'
};

const priorityLabels = {
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente'
};

const ITEMS_PER_PAGE = 20;
const statusOptions = [
  { value: 'new', label: 'Nuovo' },
  { value: 'open', label: 'Aperto' },
  { value: 'in_progress', label: 'In lavorazione' },
  { value: 'pending', label: 'In attesa' },
  { value: 'resolved', label: 'Risolto' },
  { value: 'closed', label: 'Chiuso' }
];

export default function MyTicketsPage() {
  const { user } = useRole();
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  // Filtri header
  const [ticketIdFilter, setTicketIdFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [slaFilter, setSlaFilter] = useState('all');
  // Ordinamento
  const [sortBy, setSortBy] = useState<null | 'id' | 'visibility' | 'assignee' | 'sla' | 'status'>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);

  const toggleSort = (column: 'id' | 'visibility' | 'assignee' | 'sla' | 'status') => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const assigneeOptions = useMemo(() => {
    const unique = Array.from(new Set(tickets.filter(t => t.visibility === 'private').map(t => t.assignee)));
    return [{ value: 'all', label: 'Tutti' }, ...unique.map(a => ({ value: a, label: a }))];
  }, [tickets]);

  // Filtraggio dei ticket
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const matchesSearch = searchTerm === '' ||
        ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
      const matchesTicketId = ticketIdFilter === '' || ticket.id.toLowerCase().includes(ticketIdFilter.toLowerCase());
      // Solo ticket privati in questa vista
      const matchesVisibility = ticket.visibility === 'private';
      const matchesAssignee = assigneeFilter === 'all' || ticket.assignee === assigneeFilter;
      const matchesSla = slaFilter === 'all' || ticket.sla === slaFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesTicketId && matchesVisibility && matchesAssignee && matchesSla;
    });
  }, [tickets, searchTerm, statusFilter, priorityFilter, ticketIdFilter, assigneeFilter, slaFilter]);

  const sortedTickets = useMemo(() => {
    const list = [...filteredTickets];
    if (!sortBy) return list;
    const visRank: Record<string, number> = { public: 0, private: 1 };
    const slaRank: Record<string, number> = { on_time: 0, warning: 1, overdue: 2 };
    const statusRank: Record<string, number> = { new: 0, open: 1, in_progress: 2, pending: 3, resolved: 4, closed: 5 };
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'id') {
        const na = parseInt(a.id.replace(/[^0-9]/g, '')) || 0;
        const nb = parseInt(b.id.replace(/[^0-9]/g, '')) || 0;
        cmp = na - nb;
      } else if (sortBy === 'visibility') {
        cmp = (visRank[a.visibility] ?? 0) - (visRank[b.visibility] ?? 0);
      } else if (sortBy === 'assignee') {
        cmp = a.assignee.localeCompare(b.assignee);
      } else if (sortBy === 'sla') {
        cmp = (slaRank[a.sla] ?? 0) - (slaRank[b.sla] ?? 0);
      } else if (sortBy === 'status') {
        cmp = (statusRank[a.status] ?? 0) - (statusRank[b.status] ?? 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredTickets, sortBy, sortDir]);

  // Paginazione
  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const visibleCount = Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length);
  const paginatedTickets = sortedTickets.slice(0, visibleCount);

  // Funzione per determinare il colore della riga basato su SLA e stato
  const getRowColor = (ticket: typeof mockTickets[0]) => {
    // Se il ticket è risolto o chiuso, sempre grigio
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return 'bg-gray-50 border-gray-200';
    }

    // Altrimenti basato su SLA
    switch (ticket.sla) {
      case 'overdue':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-orange-50 border-orange-200';
      case 'on_time':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  // Funzione per ottenere l'icona SLA
  const getSLAIcon = (sla: string) => {
    switch (sla) {
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'on_time':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const updateTicketStatus = (id: string, newStatus: Ticket['status']) => {
    setTickets(prev => prev.map(t => (t.id === id ? { ...t, status: newStatus } : t)));
    setEditingStatusId(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <TicketIcon className="h-8 w-8 mr-3 text-blue-600" />
              I miei ticket · Privati
            </h1>
            <p className="text-gray-600 mt-1">
              Gestisci tutti i tuoi ticket di supporto • {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/tickets/new">
              <Button>
                <TicketIcon className="h-4 w-4 mr-2" />
                Nuovo Ticket
              </Button>
            </Link>
          </div>
        </div>

        {/* Filtri e Ricerca */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Cerca per numero ticket, titolo o descrizione..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-40"
                  options={[
                    { value: 'all', label: 'Tutti gli stati' },
                    { value: 'new', label: 'Nuovi' },
                    { value: 'open', label: 'Aperti' },
                    { value: 'in_progress', label: 'In lavorazione' },
                    { value: 'pending', label: 'In attesa' },
                    { value: 'resolved', label: 'Risolti' },
                    { value: 'closed', label: 'Chiusi' }
                  ]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabella Ticket */}
        <Card>
          <CardHeader>
            <CardTitle>Lista Ticket</CardTitle>
            <CardDescription>
              Pagina {currentPage} di {totalPages} • {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} totali
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '19%' }} />
                  <col style={{ width: '27%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '6%' }} />
                </colgroup>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="space-y-1">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('id')}>
                          <span>Ticket</span>
                          <ArrowUpDown className="h-3 w-3 text-gray-400" />
                        </button>
                        <Input
                          placeholder="#1234"
                          value={ticketIdFilter}
                          onChange={(e) => { setTicketIdFilter(e.target.value); setCurrentPage(1); }}
                          className="h-8 px-2 text-xs"
                        />
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Oggetto</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrizione</th>
                    
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="space-y-1">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('assignee')}>
                          <span>Assegnato a</span>
                          <ArrowUpDown className="h-3 w-3 text-gray-400" />
                        </button>
                        <Select
                          value={assigneeFilter}
                          onChange={(e) => { setAssigneeFilter(e.target.value); setCurrentPage(1); }}
                          className="h-8 text-xs"
                          options={assigneeOptions}
                        />
                      </div>
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('status')}>
                        <span>Stato</span>
                        <ArrowUpDown className="h-3 w-3 text-gray-400" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="space-y-1">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('sla')}>
                          <span>SLA</span>
                          <ArrowUpDown className="h-3 w-3 text-gray-400" />
                        </button>
                        <Select
                          value={slaFilter}
                          onChange={(e) => { setSlaFilter(e.target.value); setCurrentPage(1); }}
                          className="h-8 text-xs"
                          options={[
                            { value: 'all', label: 'Tutti' },
                            { value: 'on_time', label: 'In orario' },
                            { value: 'warning', label: 'A ridosso' },
                            { value: 'overdue', label: 'Fuori SLA' }
                          ]}
                        />
                      </div>
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" title="Azioni">Azioni</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedTickets.map((ticket) => (
                    <tr key={ticket.id} className={`hover:bg-gray-50 transition-colors ${getRowColor(ticket)}`}>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <Badge variant="default" className="font-mono">
                            {ticket.id}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-full" title={ticket.title}>
                          {ticket.title}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm text-gray-600 truncate max-w-full" title={ticket.description}>
                          {ticket.description}
                        </div>
                      </td>
                      
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {ticket.assignee}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        {editingStatusId === ticket.id ? (
                          <Select
                            value={ticket.status}
                            onChange={(e) => updateTicketStatus(ticket.id, e.target.value as Ticket['status'])}
                            className="h-8 text-xs w-40 mx-auto"
                            options={statusOptions}
                          />
                        ) : (
                          <button onClick={() => setEditingStatusId(ticket.id)} className="inline-flex">
                            <Badge
                              variant={
                                ticket.status === 'resolved' || ticket.status === 'closed' ? 'success' :
                                ticket.status === 'new' ? 'info' :
                                ticket.status === 'in_progress' ? 'warning' :
                                'default'
                              }
                              size="sm"
                            >
                              {statusLabels[ticket.status as keyof typeof statusLabels]}
                            </Badge>
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap min-w-0 text-center">
                        <div className="flex items-center justify-center text-sm max-w-full overflow-hidden">
                          {getSLAIcon(ticket.sla)}
                          <span className="ml-2 text-gray-600 truncate" title={ticket.slaTime}>
                            {ticket.slaTime}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="mx-auto" aria-label="Modifica">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="mx-auto" aria-label="Visualizza">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Nessun risultato */}
            {paginatedTickets.length === 0 && (
              <div className="text-center py-12">
                <TicketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nessun ticket trovato
                </h3>
                <p className="text-gray-600">
                  Non ci sono ticket che corrispondono ai tuoi criteri di ricerca.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paginazione */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostra 1-{visibleCount} di {filteredTickets.length} risultati
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Precedente
              </Button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    // Mostra sempre la prima, l'ultima e quelle vicine alla corrente
                    return page === 1 ||
                           page === totalPages ||
                           (page >= currentPage - 1 && page <= currentPage + 1);
                  })
                  .map((page, index, array) => (
                    <React.Fragment key={page}>
                      {index > 0 && array[index - 1] !== page - 1 && (
                        <span className="px-2 text-gray-500">...</span>
                      )}
                      <Button
                        variant={currentPage === page ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    </React.Fragment>
                  ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Successivo
                <ChevronRight className="h-4 w-4" />
              </Button>
              {currentPage < totalPages && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                >
                  Carica altri {Math.min(ITEMS_PER_PAGE, filteredTickets.length - visibleCount)}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

