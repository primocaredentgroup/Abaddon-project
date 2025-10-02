'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { TicketActions } from '@/components/tickets/TicketActions';
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
  Zap
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
  const ticketId = params.id as string;

  // Stati per editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [newComment, setNewComment] = useState('');

  // Fetch dati reali da Convex
  // Non fare la query finché non abbiamo l'email dell'utente
  const ticket = useQuery(
    api.tickets.getById, 
    user?.email ? { id: ticketId, userEmail: user.email } : "skip"
  );
  const comments = useQuery(
    api.ticketComments.getByTicketId, 
    user?.email ? { ticketId: ticketId as any, userEmail: user.email } : "skip"
  );
  
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

  // Debug log
  React.useEffect(() => {
    console.log('🔍 DEBUG MACRO - ticket:', ticket);
    console.log('🔍 DEBUG MACRO - user:', user);
    console.log('🔍 DEBUG MACRO - clinicId:', clinicId);
    console.log('🔍 DEBUG MACRO - canManage:', user?.roleName === 'Agente' || user?.roleName === 'Amministratore');
    
    if (ticket?.category && clinicId) {
      console.log('✅ Ricerca macro per:', {
        clinicId,
        categorySlug: ticket.category.slug,
        categoryName: ticket.category.name
      });
    } else {
      console.log('❌ Non cerco macro perché:', {
        hasTicketCategory: !!ticket?.category,
        hasClinicId: !!clinicId
      });
    }
    if (macros !== undefined) {
      console.log('📋 Macro trovate:', macros?.length || 0, macros);
    }
  }, [ticket, clinicId, macros, user]);

  // Mutations
  const addComment = useMutation(api.ticketComments.add);
  const nudgeTicket = useMutation(api.ticketComments.nudge);
  const updateTicket = useMutation(api.tickets.update);
  const executeMacro = useMutation(api.macros.executeMacro);

  // Imposta i valori di editing quando il ticket viene caricato
  useEffect(() => {
    if (ticket) {
      setEditTitle(ticket.title);
      setEditDescription(ticket.description);
    }
  }, [ticket]);

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
        id: ticketId as any,
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
        id: ticketId as any,
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
        ticketId: ticketId as any,
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
        ticketId: ticketId as any,
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
        ticketId: ticketId as any,
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
        id: ticketId as any,
        status: newStatus,
        userEmail: user?.email || ""
      });
      console.log("✅ Stato aggiornato:", newStatus);
    } catch (error: any) {
      console.error("❌ Errore:", error.message);
    }
  };

  const handleAssigneeChange = async (newAssigneeId?: string) => {
    try {
      await updateTicket({
        id: ticketId as any,
        // Converti stringhe vuote in undefined per Convex
        assigneeId: (newAssigneeId && newAssigneeId.trim() !== "") ? newAssigneeId as any : undefined,
        userEmail: user?.email || ""
      });
      console.log("✅ Assegnatario aggiornato:", newAssigneeId);
    } catch (error: any) {
      console.error("❌ Errore:", error.message);
    }
  };

  const handleCategoryChange = async (newCategoryId: string) => {
    try {
      await updateTicket({
        id: ticketId as any,
        categoryId: newCategoryId as any,
        userEmail: user?.email || ""
      });
      console.log("✅ Categoria aggiornata");
    } catch (error: any) {
      console.error("❌ Errore:", error.message);
    }
  };

  const handleClinicChange = async (newClinicId: string) => {
    try {
      await updateTicket({
        id: ticketId as any,
        clinicId: newClinicId as any,
        userEmail: user?.email || ""
      });
      console.log("✅ Clinica aggiornata");
    } catch (error: any) {
      console.error("❌ Errore:", error.message);
    }
  };

  const canEdit = ticket.creatorId === user?.id || user?.roleName === 'Agente' || user?.roleName === 'Amministratore';
  const canNudge = ticket.creatorId === user?.id && ticket.status !== 'closed';
  const canManage = user?.roleName === 'Agente' || user?.roleName === 'Amministratore';
  const isCreator = ticket.creatorId === user?.id;
  const isAssignee = ticket.assigneeId === user?.id;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/tickets/my">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Indietro
              </Button>
            </Link>
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

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Categoria</span>
                  <Badge variant="outline" className="flex items-center">
                    <Tag className="h-3 w-3 mr-1" />
                    {ticket.category?.name || 'N/A'}
                  </Badge>
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

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Assegnato a</span>
                  <span className="text-sm text-gray-900">
                    {ticket.assignee?.name || 'Non assegnato'}
                  </span>
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

            {/* Azioni ticket */}
            {canManage && (
              <TicketActions
                ticketId={ticketId}
                currentStatus={ticket.status}
                currentAssigneeId={ticket.assigneeId}
                currentCategoryId={ticket.categoryId}
                currentClinicId={ticket.clinicId}
                creatorId={ticket.creatorId}
                currentUserId={user?.id || ''}
                onStatusChange={handleStatusChange}
                onAssigneeChange={handleAssigneeChange}
                onCategoryChange={handleCategoryChange}
                onClinicChange={handleClinicChange}
                canManage={canManage}
                canEdit={canEdit}
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
