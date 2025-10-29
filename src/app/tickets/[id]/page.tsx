'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusSelect } from '@/components/tickets/StatusSelect';
import { StatusBadge } from '@/components/tickets/StatusBadge';
import { PriorityLevel } from '@/components/tickets/PriorityLevel';
import { SLACountdown } from '@/components/tickets/SLACountdown';
import { useRole } from '@/providers/RoleProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  Send,
  Bell,
  Edit,
  Save,
  X,
  Calendar,
  Tag,
  Building,
  UserCheck,
  Zap,
  Pencil,
  ChevronDown,
  UserX,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

const statusOptions = [
  { value: 'new', label: 'Nuovo' },
  { value: 'open', label: 'Aperto' },
  { value: 'in_progress', label: 'In lavorazione' },
  { value: 'closed', label: 'Chiuso' }
];

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useRole();
  const { toast } = useToast();
  
  // 🆕 Interpreta params.id come ticketNumber (non più _id)
  const ticketNumber = parseInt(params.id as string, 10);
  
  // 🆕 Stato per timeout - DEVE essere prima di ogni return!
  const [isTimeout, setIsTimeout] = React.useState(false);
  
  // 🆕 Log per debugging
  useEffect(() => {
    console.log('🎫 Params:', params);
    console.log('🎫 Ticket Number:', ticketNumber, 'isNaN:', isNaN(ticketNumber));
    console.log('🎫 User:', user?.email);
  }, [params, ticketNumber, user?.email]);

  // Stati per editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [newComment, setNewComment] = useState('');
  
  // 🆕 Stati per dropdown assegnatario
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);
  
  // 🆕 Stati per dropdown categoria
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // 🆕 Fetch ticket by ticketNumber invece di _id
  const ticket = useQuery(
    api.tickets.getByTicketNumber, 
    user?.email && !isNaN(ticketNumber) ? { ticketNumber, userEmail: user.email } : "skip"
  );
  
  // 🆕 Log risultato query
  useEffect(() => {
    console.log('🎫 Ticket loaded:', ticket);
    if (ticket) {
      console.log('🎫 Ticket data:', {
        _id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        status: ticket.status,
        category: ticket.category,
        assignee: ticket.assignee,
        creator: ticket.creator,
        clinic: ticket.clinic,
      });
    }
  }, [ticket]);

  // 🆕 Timeout per debugging
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (ticket === undefined && user) {
        console.error('⏰ TIMEOUT: La query non sta ritornando nulla dopo 5 secondi!');
        console.error('⏰ ticketNumber:', ticketNumber);
        console.error('⏰ user.email:', user.email);
        console.error('⏰ Query args:', { ticketNumber, userEmail: user.email });
      }
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [ticket, user, ticketNumber]);
  
  // 🆕 Timeout UI per mostrare errore dopo 10 secondi
  useEffect(() => {
    const timer = setTimeout(() => {
      if (ticket === undefined) {
        setIsTimeout(true);
      }
    }, 10000); // 10 secondi
    
    return () => clearTimeout(timer);
  }, [ticket]);
  
  const comments = useQuery(
    api.ticketComments.getByTicketId, 
    user?.email && ticket?._id ? { ticketId: ticket._id as any, userEmail: user.email } : "skip"
  );
  
  // 🆕 Fetch ticket attributes
  const allTicketAttributes = useQuery(
    api.ticketAttributes.getByTicket,
    ticket?._id ? { ticketId: ticket._id as any } : "skip"
  );
  
  // 🆕 Mutation per assicurarsi che gli attributi agentOnly esistano (per ticket vecchi)
  const ensureAgentOnlyAttributes = useMutation(api.ticketAttributes.ensureAgentOnlyAttributes);
  
  // 🆕 Effetto per creare attributi mancanti su ticket vecchi (una sola volta)
  const [hasCheckedAttributes, setHasCheckedAttributes] = useState(false);
  useEffect(() => {
    // Confronto case-insensitive con versioni italiane e inglesi
    const roleLower = user?.roleName?.toLowerCase();
    const isAgent = roleLower === 'agent' || roleLower === 'agente' || roleLower === 'admin' || roleLower === 'amministratore';
    
    if (ticket?._id && isAgent && allTicketAttributes !== undefined && !hasCheckedAttributes) {
      // Chiama la mutation per assicurarsi che tutti gli attributi agentOnly esistano
      ensureAgentOnlyAttributes({ ticketId: ticket._id as any })
        .then(() => {
          setHasCheckedAttributes(true);
        })
        .catch(() => {
          setHasCheckedAttributes(true);
        });
    }
  }, [ticket?._id, user?.roleName, allTicketAttributes, hasCheckedAttributes]);

  // Filtra gli attributi in base al ruolo: rimuovi agentOnly se l'utente NON è agente
  const ticketAttributes = useMemo(() => {
    if (!allTicketAttributes) return allTicketAttributes;
    
    // Confronto case-insensitive con versioni italiane e inglesi
    const roleLower = user?.roleName?.toLowerCase();
    const isAgent = roleLower === 'agent' || roleLower === 'agente' || roleLower === 'admin' || roleLower === 'amministratore';
    
    // Se è agente, mostra tutti gli attributi
    if (isAgent) return allTicketAttributes;
    
    // Se è utente normale, rimuovi gli attributi agentOnly
    return allTicketAttributes.filter((attr: any) => !attr.attribute?.agentOnly);
  }, [allTicketAttributes, user?.roleName]);
  
  // Usa clinicId dall'utente (ora disponibile in useRole)
  const clinicId = user?.clinicId;
  
  // Fetch macro disponibili per la categoria del ticket
  const macros = useQuery(
    api.macros.getMacrosByCategory,
    ticket?.category && clinicId ? {
      clinicId: clinicId,
      categorySlug: ticket.category.slug
    } : "skip"
  );
  
  // 🆕 Fetch agenti disponibili per l'assegnazione
  const availableAgents = useQuery(
    api.users.getAvailableAgents,
    clinicId && user?.email ? {
      clinicId: clinicId,
      userEmail: user.email
    } : "skip"
  );
  
  // 🆕 Fetch categorie disponibili (per agenti)
  const availableCategories = useQuery(
    api.categories.getCategoriesByClinic,
    user?.email ? { 
      isActive: true,
      userId: (user as any)?._id 
    } : "skip"
  );


  // Mutations
  const addComment = useMutation(api.ticketComments.add);
  const nudgeTicket = useMutation(api.ticketComments.nudge);
  const updateTicket = useMutation(api.tickets.update);
  const updatePriority = useMutation(api.tickets.updatePriority);
  const executeMacro = useMutation(api.macros.executeMacro);
  const updateTicketAttribute = useMutation(api.ticketAttributes.update);
  const changeAssignee = useMutation(api.tickets.changeAssignee);

  // Imposta i valori di editing quando il ticket viene caricato
  useEffect(() => {
    if (ticket) {
      setEditTitle(ticket.title);
      setEditDescription(ticket.description);
    }
  }, [ticket]);
  
  // 🆕 Chiudi dropdown assegnatario quando clicco fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
    };
    
    if (showAssigneeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAssigneeDropdown]);
  
  // 🆕 Chiudi dropdown categoria quando clicco fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    
    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCategoryDropdown]);

  if (!ticket) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Caricamento ticket...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <AlertCircle className="h-5 w-5 text-blue-600" />;
      case 'open':
        return <Clock className="h-5 w-5 text-orange-600" />;
      case 'in_progress':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'closed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const handleSaveTitle = async () => {
    try {
      await updateTicket({
        id: ticket._id as any,
        title: editTitle,
        userEmail: user?.email || ""
      });
      setIsEditingTitle(false);
      toast({ title: 'Titolo aggiornato!', variant: 'default' });
    } catch (error: any) {
      toast({ title: 'Errore aggiornamento', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveDescription = async () => {
    try {
      await updateTicket({
        id: ticket._id as any,
        description: editDescription,
        userEmail: user?.email || ""
      });
      setIsEditingDescription(false);
      toast({ title: 'Descrizione aggiornata!', variant: 'default' });
    } catch (error: any) {
      toast({ title: 'Errore aggiornamento', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      await addComment({
        ticketId: ticket._id as any,
        content: newComment,
        userEmail: user?.email || ""
      });
      setNewComment('');
      toast({ title: 'Commento aggiunto!', variant: 'default' });
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const handleNudge = async () => {
    try {
      await nudgeTicket({
        ticketId: ticket._id as any,
        userEmail: user?.email || ""
      });
      toast({ title: 'Ticket sollecitato!', description: 'L\'agente riceverà una notifica.', variant: 'default' });
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const handleExecuteMacro = async (macroId: any, macroName: string) => {
    if (!confirm(`Vuoi eseguire la macro "${macroName}"?`)) return;
    
    try {
      await executeMacro({
        macroId,
        ticketId: ticket._id as any,
        userEmail: user?.email || ""
      });
      toast({ title: '🎬 Macro eseguita!', description: `"${macroName}" completata con successo`, variant: 'default' });
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  // Handlers per modifiche ticket
  const handleStatusChange = async (newStatus: any) => {
    try {
      await updateTicket({
        id: ticket._id as any,
        ticketStatusId: newStatus, // 🆕 Usa ticketStatusId invece di status
        userEmail: user?.email || ""
      });
    } catch (error: any) {
      console.error("❌ Errore:", error.message);
    }
  };

  const handleAssigneeChange = async (newAssigneeId?: string) => {
    try {
      await changeAssignee({
        ticketId: ticket._id as any,
        newAssigneeId: newAssigneeId as any,
        userEmail: user?.email || ""
      });
      setShowAssigneeDropdown(false);
      toast({ title: '✅ Assegnatario aggiornato!', variant: 'default' });
    } catch (error: any) {
      console.error("❌ Errore:", error.message);
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const handleCategoryChange = async (newCategoryId: string) => {
    try {
      await updateTicket({
        id: ticket._id as any,
        categoryId: newCategoryId as any,
        userEmail: user?.email || ""
      });
      setShowCategoryDropdown(false);
      toast({ title: '✅ Categoria aggiornata!', variant: 'default' });
    } catch (error: any) {
      console.error("❌ Errore:", error.message);
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  // 🆕 Gestione loading e errori
  
  // Verifica che ticketNumber sia valido
  if (isNaN(ticketNumber)) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">URL Non Valido</h1>
            <p className="text-gray-600 mb-4">Il numero del ticket "{params.id}" non è valido.</p>
            <Button onClick={() => router.push('/tickets/my')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Vai ai Miei Ticket
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  if (!user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Caricamento utente...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // 🔴 Se ticket è null, significa che non esiste!
  if (ticket === null) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Ticket Non Trovato</h1>
            <p className="text-gray-600 mb-4">
              Il ticket #{ticketNumber} non esiste o non hai i permessi per vederlo.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => router.push('/tickets/my')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                I Miei Ticket
              </Button>
              <Button variant="outline" onClick={() => router.push('/tickets/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Ticket
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  if (ticket === undefined && !isTimeout) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <Clock className="h-16 w-16 text-blue-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Caricamento ticket #{ticketNumber}...</p>
            <p className="text-xs text-gray-400 mt-2">Se il caricamento dura troppo, prova a ricaricare la pagina</p>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  if (ticket === undefined && isTimeout) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Timeout Caricamento</h1>
            <p className="text-gray-600 mb-4">
              Il ticket #{ticketNumber} sta impiegando troppo tempo a caricare.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => window.location.reload()}>
                Ricarica Pagina
              </Button>
              <Button variant="outline" onClick={() => router.push('/tickets/my')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Torna ai Ticket
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!ticket) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Ticket Non Trovato</h1>
            <p className="text-gray-600 mb-4">Il ticket #{ticketNumber} non esiste o non hai i permessi per vederlo.</p>
            <Button onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Torna Indietro
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Confronto case-insensitive per i ruoli (italiano e inglese)
  const roleLowerForPermissions = user?.roleName?.toLowerCase();
  const isAgentRole = roleLowerForPermissions === 'agente' || roleLowerForPermissions === 'agent' || roleLowerForPermissions === 'amministratore' || roleLowerForPermissions === 'admin';
  const canEdit = ticket.creatorId === user?.id || isAgentRole;
  const canNudge = ticket.creatorId === user?.id && ticket.status !== 'closed';
  const canManage = isAgentRole;
  const isCreator = ticket.creatorId === user?.id;
  const isAssignee = ticket.assigneeId === user?.id;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Indietro
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                Ticket #{ticket.ticketNumber || 'N/A'}
              </h1>
              <p className="text-gray-600 mt-1">
                Creato {new Date(ticket._creationTime).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
            {canNudge && (
              <Button variant="outline" onClick={handleNudge}>
                <Bell className="h-4 w-4 mr-2" />
                Sollecita ({ticket.nudgeCount || 0})
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonna principale - Dettagli ticket */}
          <div className="lg:col-span-2 space-y-6">
            {/* Titolo */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    {getStatusIcon(ticket.status)}
                    <span className="ml-2">Titolo</span>
                  </CardTitle>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingTitle(!isEditingTitle)}
                    >
                      {isEditingTitle ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditingTitle ? (
                  <div className="space-y-3">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-lg font-semibold"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveTitle}>
                        <Save className="h-4 w-4 mr-2" />
                        Salva
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setEditTitle(ticket.title);
                          setIsEditingTitle(false);
                        }}
                      >
                        Annulla
                      </Button>
                    </div>
                  </div>
                ) : (
                  <h2 className="text-xl font-semibold text-gray-900">{ticket.title}</h2>
                )}
              </CardContent>
            </Card>

            {/* Descrizione */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Descrizione</CardTitle>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingDescription(!isEditingDescription)}
                    >
                      {isEditingDescription ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditingDescription ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveDescription}>
                        <Save className="h-4 w-4 mr-2" />
                        Salva
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setEditDescription(ticket.description);
                          setIsEditingDescription(false);
                        }}
                      >
                        Annulla
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
                )}
              </CardContent>
            </Card>

            {/* Sistema Commenti */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Commenti ({comments?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Lista commenti */}
                <div className="space-y-4 mb-6">
                  {!comments || comments.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Nessun commento ancora</p>
                      <p className="text-xs text-gray-500">Inizia la conversazione scrivendo il primo commento</p>
                    </div>
                  ) : (
                    comments.map((comment: any) => (
                      <div key={comment._id} className="flex space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {comment.author?.name || 'Utente'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(comment._creationTime).toLocaleString()}
                            </span>
                            {comment.isInternal && (
                              <Badge variant="secondary" className="text-xs">
                                Interno
                              </Badge>
                            )}
                          </div>
                          <p className="text-gray-700 text-sm whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Form nuovo commento */}
                <div className="border-t pt-4">
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Scrivi un commento..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        Il commento sarà visibile a tutti gli utenti coinvolti nel ticket
                      </span>
                      <Button 
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        size="sm"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Invia commento
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Info ticket */}
          <div className="space-y-6">
            {/* Stato e info */}
            <Card>
              <CardHeader>
                <CardTitle>Informazioni</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Stato</span>
                  <Badge 
                    variant={
                      ticket.status === 'open' ? 'destructive' :
                      ticket.status === 'in_progress' ? 'secondary' :
                      ticket.status === 'closed' ? 'default' : 'outline'
                    }
                    className="flex items-center"
                  >
                    {getStatusIcon(ticket.status)}
                    <span className="ml-1 capitalize">
                      {ticket.status === 'in_progress' ? 'In corso' : 
                       ticket.status === 'open' ? 'Aperto' :
                       ticket.status === 'closed' ? 'Chiuso' : 'Nuovo'}
                    </span>
                  </Badge>
                </div>

                {/* 🆕 Categoria con dropdown inline */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Categoria</span>
                  {canManage ? (
                    <div className="relative" ref={categoryDropdownRef}>
                      <button
                        onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                        className="flex items-center space-x-1 hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                      >
                        <Badge variant="outline" className="flex items-center">
                          <Tag className="h-3 w-3 mr-1" />
                          {ticket.category?.name || 'N/A'}
                        </Badge>
                        <ChevronDown className="h-3 w-3 text-gray-500" />
                      </button>
                      
                      {/* Dropdown Menu */}
                      {showCategoryDropdown && (
                        <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                          {availableCategories && availableCategories.length > 0 ? (
                            availableCategories.map((category: any) => (
                              <button
                                key={category._id}
                                onClick={() => handleCategoryChange(category._id)}
                                className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-100 transition-colors ${
                                  ticket.categoryId === category._id ? 'bg-blue-50' : ''
                                }`}
                              >
                                <div className="flex items-start space-x-2">
                                  <Tag className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 flex items-center justify-between">
                                      <span className="truncate">{category.name}</span>
                                      {ticket.categoryId === category._id && (
                                        <CheckCircle className="h-4 w-4 text-blue-600 ml-2 flex-shrink-0" />
                                      )}
                                    </div>
                                    {category.description && (
                                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                        {category.description}
                                      </div>
                                    )}
                                    {/* Mostra percorso gerarchico se esiste */}
                                    {category.path && category.path.length > 1 && (
                                      <div className="text-xs text-gray-400 mt-1">
                                        📁 {category.path.length - 1} livello{category.path.length > 2 ? 'i' : ''} sopra
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                              Nessuna categoria disponibile
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline" className="flex items-center">
                      <Tag className="h-3 w-3 mr-1" />
                      {ticket.category?.name || 'N/A'}
                    </Badge>
                  )}
                </div>

                {/* Priorità */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Priorità</span>
                  <PriorityLevel
                    value={ticket.priority || 1}
                    onChange={canManage ? async (newPriority) => {
                      try {
                        await updatePriority({
                          ticketId: ticket._id as any,
                          priority: newPriority,
                          userEmail: user?.email || '',
                        });
                        toast({
                          title: "Priorità aggiornata",
                          description: `Priorità impostata a ${newPriority}`,
                        });
                      } catch (error) {
                        toast({
                          title: "Errore",
                          description: "Impossibile aggiornare la priorità",
                          variant: "destructive",
                        });
                      }
                    } : undefined}
                    readonly={!canManage}
                    showLabel={false}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Clinica</span>
                  <Badge variant="outline" className="flex items-center">
                    <Building className="h-3 w-3 mr-1" />
                    {ticket.clinic?.name || 'N/A'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Creatore</span>
                  <span className="text-sm text-gray-900">
                    {ticket.creator?.name || 'N/A'}
                  </span>
                </div>

                {/* 🆕 Assegnatario con dropdown inline */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Assegnato a</span>
                  {canManage ? (
                    <div className="relative" ref={assigneeDropdownRef}>
                      <button
                        onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                        className="flex items-center space-x-1 text-sm text-gray-900 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                      >
                        <span>{ticket.assignee?.name || 'Non assegnato'}</span>
                        <ChevronDown className="h-3 w-3 text-gray-500" />
                      </button>
                      
                      {/* Dropdown Menu */}
                      {showAssigneeDropdown && (
                        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                          {/* Opzione "Non assegnato" */}
                          <button
                            onClick={() => handleAssigneeChange(undefined)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <UserX className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-700">Non assegnato</span>
                          </button>
                          
                          {/* Divider */}
                          <div className="border-t border-gray-200 my-1"></div>
                          
                          {/* Lista agenti */}
                          {availableAgents && availableAgents.length > 0 ? (
                            availableAgents.map((agent: any) => (
                              <button
                                key={agent._id}
                                onClick={() => handleAssigneeChange(agent._id)}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2 ${
                                  ticket.assigneeId === agent._id ? 'bg-blue-50' : ''
                                }`}
                              >
                                <UserCheck className="h-4 w-4 text-blue-600" />
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">{agent.name}</div>
                                  <div className="text-xs text-gray-500">{agent.email}</div>
                                </div>
                                {ticket.assigneeId === agent._id && (
                                  <CheckCircle className="h-4 w-4 text-blue-600" />
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                              Nessun agente disponibile
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-900">
                      {ticket.assignee?.name || 'Non assegnato'}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Creato</span>
                  <span className="text-sm text-gray-900 flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(ticket._creationTime).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Ultima attività</span>
                  <span className="text-sm text-gray-900">
                    {new Date(ticket.lastActivityAt).toLocaleDateString()}
                  </span>
                </div>

                {/* 🆕 SLA Countdown */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">SLA</span>
                  <SLACountdown 
                    slaDeadline={ticket.slaDeadline} 
                    size="sm"
                    showIcon={true}
                  />
                </div>

                {ticket.nudgeCount && ticket.nudgeCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Solleciti</span>
                    <Badge variant="secondary" className="flex items-center">
                      <Bell className="h-3 w-3 mr-1" />
                      {ticket.nudgeCount}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 🆕 Attributi Ticket */}
            {ticketAttributes && ticketAttributes.length > 0 && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-blue-900">📝 Informazioni Aggiuntive</CardTitle>
                  <CardDescription className="text-blue-700">
                    Dettagli raccolti per questo ticket
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {ticketAttributes.map((attr) => (
                    <EditableAttribute
                      key={attr._id}
                      attribute={attr}
                      isAgent={canManage}
                      onSave={async (newValue) => {
                        try {
                          await updateTicketAttribute({
                            ticketAttributeId: attr._id as any,
                            value: newValue
                          });
                          toast({ title: 'Attributo aggiornato!', variant: 'default' });
                        } catch (error: any) {
                          toast({ title: 'Errore', description: error.message, variant: 'destructive' });
                        }
                      }}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Macro Rapide - Solo per agenti/admin */}
            {canManage && macros && macros.length > 0 && (
              <Card className="border-purple-200 bg-purple-50">
                <CardHeader>
                  <CardTitle className="flex items-center text-purple-900">
                    <Zap className="h-5 w-5 mr-2 text-purple-600" />
                    Macro Rapide
                  </CardTitle>
                  <CardDescription className="text-purple-700">
                    {macros.length} macro disponibili per questa categoria
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {macros.map((macro) => (
                    <div key={macro._id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200 hover:border-purple-300 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{macro.name}</p>
                        {macro.description && (
                          <p className="text-xs text-gray-500 mt-1">{macro.description}</p>
                        )}
                        <p className="text-xs text-purple-600 mt-1">
                          {macro.actions.length} azioni
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="ml-3 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white"
                        onClick={() => handleExecuteMacro(macro._id, macro.name)}
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        Esegui
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 🆕 Cambio Stato Semplificato */}
            {canManage && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Stato Ticket</CardTitle>
                  <CardDescription>
                    Cambia lo stato del ticket
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Stato attuale visualizzato */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Stato attuale
                      </label>
                      <div className="flex items-center space-x-2">
                        <StatusBadge 
                          ticketStatusId={ticket.ticketStatusId} 
                          status={ticket.status}
                          showIcon={true}
                        />
                      </div>
                    </div>

                    {/* Dropdown cambio stato */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Cambia stato
                      </label>
                      <StatusSelect
                        value={ticket.ticketStatusId}
                        onChange={handleStatusChange}
                        disabled={!canManage}
                        className="w-full"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// Componente per rendere gli attributi modificabili dagli agenti
function EditableAttribute({ 
  attribute, 
  isAgent, 
  onSave 
}: { 
  attribute: any; 
  isAgent: boolean; 
  onSave: (value: any) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(attribute.value || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving attribute:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(attribute.value || '');
    setIsEditing(false);
  };

  // Se l'attributo è agentOnly e l'utente è un agente, mostra sempre come modificabile
  const canEdit = isAgent && attribute.attribute?.agentOnly;
  const displayValue = typeof attribute.value === 'object' 
    ? JSON.stringify(attribute.value) 
    : attribute.value || (canEdit ? '(Non compilato)' : '');

  return (
    <div className="flex items-start justify-between p-3 bg-white rounded-lg border border-blue-200">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium text-gray-700">
            {attribute.attribute?.name || 'N/A'}
          </p>
          {attribute.attribute?.agentOnly && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
              👤 Solo Agenti
            </span>
          )}
        </div>

        {isEditing ? (
          <div className="mt-2 space-y-2">
            {attribute.attribute?.type === 'boolean' ? (
              <select
                value={editValue === true || editValue === 'true' ? 'true' : 'false'}
                onChange={(e) => setEditValue(e.target.value === 'true')}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="true">Sì</option>
                <option value="false">No</option>
              </select>
            ) : attribute.attribute?.type === 'select' && attribute.attribute?.config?.options ? (
              <select
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleziona...</option>
                {attribute.attribute.config.options.map((option: string) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : attribute.attribute?.type === 'number' ? (
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : attribute.attribute?.type === 'date' ? (
              <input
                type="date"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={attribute.attribute?.config?.placeholder || 'Inserisci valore...'}
              />
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Salvataggio...' : 'Salva'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Annulla
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mt-1">
            <p className="text-base text-gray-900">
              {displayValue}
            </p>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
                className="ml-2"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Modifica
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
