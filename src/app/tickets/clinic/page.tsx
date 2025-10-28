'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { PriorityLevel } from '@/components/tickets/PriorityLevel';
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
  Pencil,
  Layers
} from 'lucide-react';
import Link from 'next/link';

// Tipi per i ticket (SOLO dati reali da Convex)
type Ticket = {
  id: string;
  title: string;
  description: string;
  status: 'new' | 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
  priority: number; // 1-5: 1=Molto Bassa, 2=Bassa, 3=Media, 4=Alta, 5=Urgente
  assignee: string;
  createdAt: string;
  lastActivity: string;
  category: string;
  clinic: string;
  creator: string;
  visibility: 'public' | 'private';
  _id?: string;
};

const ITEMS_PER_PAGE = 10;

const statusOptions = [
  { value: 'all', label: 'Tutti' },
  { value: 'new', label: 'Nuovo' },
  { value: 'open', label: 'Aperto' },
  { value: 'in_progress', label: 'In lavorazione' },
  { value: 'pending', label: 'In attesa' },
  { value: 'resolved', label: 'Risolto' },
  { value: 'closed', label: 'Chiuso' }
];

const priorityOptions = [
  { value: 'all', label: 'Tutte' },
  { value: 'low', label: 'Bassa' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' }
];

export default function ClinicTicketsPage() {
  const { user } = useRole();
  
  // Estrai clinicId
  const clinicId = (user as any)?.clinicId || (user as any)?.clinic?._id
  
  // Fetch delle viste disponibili
  const availableViews = useQuery(
    api.ticketViews.getAvailableViewsForUser,
    user?.email && clinicId ? { userEmail: user.email, clinicId } : "skip"
  )
  
  // Stato per la vista selezionata
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null)
  
  // Fetch dei ticket della clinica da Convex
  const ticketsData = useQuery(
    api.tickets.getMyClinicTicketsWithAuth, 
    user?.email ? { userEmail: user.email } : "skip"
  ) || [];
  
  // Fetch dei ticket filtrati per vista (se una vista è selezionata)
  const viewTickets = useQuery(
    api.ticketViews.getTicketsByView,
    selectedViewId && user?.email
      ? { viewId: selectedViewId as any, userEmail: user.email }
      : "skip"
  )
  
  // Usa i ticket dalla vista se selezionata, altrimenti tutti i ticket
  const activeTicketsData = selectedViewId && viewTickets ? viewTickets : ticketsData
  
  // Trasforma i dati di Convex nel formato aspettato dal componente
  const convexTickets = useMemo(() => {
    const sortedTickets = [...activeTicketsData].sort((a, b) => a._creationTime - b._creationTime)
    
    let tempTicketNumber = 1000 // Fallback per ticket senza numero
    
    return sortedTickets.map((ticket: any) => ({
      id: `#${ticket.ticketNumber || (tempTicketNumber++)}`,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status === 'open' ? 'open' : 
              ticket.status === 'in_progress' ? 'in_progress' :
              ticket.status === 'closed' ? 'closed' : 'new',
      priority: 'medium', // Default
      assignee: ticket.assignee?.name || 'Non assegnato',
      createdAt: new Date(ticket._creationTime).toLocaleDateString(),
      lastActivity: new Date(ticket.lastActivityAt).toLocaleDateString(),
      category: ticket.category?.name || 'N/A',
      clinic: ticket.clinic?.name || 'N/A',
      creator: ticket.creator?.name || 'N/A',
      visibility: ticket.visibility,
      _id: ticket._id,
    }))
  }, [activeTicketsData]);

  // Usa SOLO i dati reali da Convex (NO MOCK!)
  const displayTickets = convexTickets;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const assigneeOptions = useMemo(() => {
    const unique = Array.from(new Set(convexTickets.filter(t => t.visibility === 'public').map(t => t.assignee)));
    return [{ value: 'all', label: 'Tutti' }, ...unique.map(a => ({ value: a, label: a }))];
  }, [convexTickets]);

  // Filtraggio dei ticket (usa i dati reali da Convex)
  const filteredTickets = useMemo(() => {
    return convexTickets.filter(ticket => {
      const matchesSearch = searchTerm === '' ||
        ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
      
      // Solo ticket pubblici in questa vista (ticket della clinica)
      const matchesVisibility = ticket.visibility === 'public';

      return matchesSearch && matchesStatus && matchesPriority && matchesVisibility;
    });
  }, [convexTickets, searchTerm, statusFilter, priorityFilter]);

  const sortedTickets = useMemo(() => {
    const list = [...filteredTickets];
    
    list.sort((a, b) => {
      let aVal: any = a[sortBy as keyof Ticket];
      let bVal: any = b[sortBy as keyof Ticket];
      
      if (sortBy === 'created') {
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
      }
      
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    
    return list;
  }, [filteredTickets, sortBy, sortDir]);

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const visibleCount = Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length);
  const paginatedTickets = sortedTickets.slice(0, visibleCount);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case 'open':
        return <Clock className="h-4 w-4 text-orange-600" />;
      case 'in_progress':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'resolved':
      case 'closed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const updateTicketStatus = (id: string, newStatus: string) => {
    // TODO: Implementare con mutation Convex
    setEditingStatusId(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <TicketIcon className="h-8 w-8 mr-3 text-blue-600" />
              Ticket clinica
            </h1>
            <p className="text-gray-600 mt-1">
              Ticket pubblici delle tue cliniche • {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
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

        {/* Filtri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filtri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dropdown Viste */}
            {availableViews && availableViews.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Layers className="h-4 w-4 inline mr-1" />
                  Vista Rapida
                </label>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedViewId || 'none'}
                    onChange={(e) => setSelectedViewId(e.target.value === 'none' ? null : e.target.value)}
                    options={[
                      { value: 'none', label: '📋 Tutti i ticket' },
                      ...availableViews.map(view => ({
                        value: view._id,
                        label: `${view.isPublic ? '🌐' : view.isPersonal ? '👤' : '👥'} ${view.name}`
                      }))
                    ]}
                    className="flex-1"
                  />
                  {selectedViewId && (
                    <Badge className="bg-blue-100 text-blue-800">
                      Vista attiva
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Seleziona una vista per filtrare rapidamente i ticket
                </p>
              </div>
            )}
            
            {/* Filtri manuali (disabilitati se c'è una vista attiva) */}
            <div className={selectedViewId ? 'opacity-50 pointer-events-none' : ''}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cerca
                  </label>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Cerca per titolo, descrizione o ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      disabled={!!selectedViewId}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stato
                  </label>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    options={statusOptions}
                    disabled={!!selectedViewId}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priorità
                  </label>
                  <Select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    options={priorityOptions}
                    disabled={!!selectedViewId}
                  />
                </div>
              </div>
              {selectedViewId && (
                <p className="text-xs text-blue-600 mt-2">
                  💡 I filtri manuali sono disabilitati quando una vista è attiva. Deseleziona la vista per usarli.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Messaggio se non ci sono ticket pubblici */}
        {displayTickets.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <TicketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nessun ticket pubblico trovato
              </h3>
              <p className="text-gray-600 mb-4">
                Non ci sono ticket pubblici nelle tue cliniche.
              </p>
              <Link href="/tickets/new">
                <Button>
                  <TicketIcon className="h-4 w-4 mr-2" />
                  Crea nuovo ticket
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Tabella Ticket - Solo se ci sono ticket */}
        {displayTickets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ticket Pubblici della Clinica</CardTitle>
              <CardDescription>
                Pagina {currentPage} di {totalPages} • {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} trovati
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '11%' }} />
                  </colgroup>
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('id')}
                          className="flex items-center hover:text-gray-700"
                        >
                          ID
                          <ArrowUpDown className="h-3 w-3 ml-1" />
                        </button>
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('title')}
                          className="flex items-center hover:text-gray-700"
                        >
                          Titolo
                          <ArrowUpDown className="h-3 w-3 ml-1" />
                        </button>
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stato
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Categoria
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Priorità
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Creatore
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('createdAt')}
                          className="flex items-center hover:text-gray-700 mx-auto"
                        >
                          Creato
                          <ArrowUpDown className="h-3 w-3 ml-1" />
                        </button>
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Azioni
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-sm font-medium text-blue-600">
                          {ticket.id}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {ticket.title}
                          </div>
                          <div className="text-xs text-gray-500 truncate mt-1">
                            {ticket.description}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-center">
                          {editingStatusId === ticket.id ? (
                            <Select
                              value={ticket.status}
                              onChange={(e) => updateTicketStatus(ticket.id, e.target.value)}
                              className="h-8 text-xs w-40 mx-auto"
                              options={statusOptions}
                            />
                          ) : (
                            <button onClick={() => setEditingStatusId(ticket.id)} className="inline-flex">
                              <Badge 
                                variant={
                                  ticket.status === 'open' ? 'danger' :
                                  ticket.status === 'in_progress' ? 'warning' :
                                  ticket.status === 'closed' ? 'success' : 'default'
                                }
                                className="text-xs flex items-center cursor-pointer hover:opacity-80"
                              >
                                {getStatusIcon(ticket.status)}
                                <span className="ml-1 capitalize">
                                  {ticket.status === 'in_progress' ? 'In corso' : 
                                   ticket.status === 'open' ? 'Aperto' :
                                   ticket.status === 'closed' ? 'Chiuso' : 'Nuovo'}
                                </span>
                                <Pencil className="h-3 w-3 ml-1" />
                              </Badge>
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="default" className="text-xs">
                              {ticket.category}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              🏥 {ticket.clinic}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex justify-center">
                            <PriorityLevel
                              value={ticket.priority || 1}
                              readonly={true}
                              showLabel={false}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs text-gray-600">
                            {ticket.creator}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-gray-500">
                          {ticket.createdAt}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Link href={`/tickets/${ticket._id}`}>
                            <Button size="sm" variant="ghost" className="h-7 px-2">
                              <Eye className="h-3 w-3" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginazione */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Mostrati {Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)} di {filteredTickets.length} ticket
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Precedente
                    </Button>
                    <span className="px-3 py-1 text-sm text-gray-600">
                      {currentPage} di {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Successivo
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}