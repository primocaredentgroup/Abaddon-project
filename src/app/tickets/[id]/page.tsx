'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Zap,
  Pencil
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
  
  // 🆕 Fetch ticket attributes
  const allTicketAttributes = useQuery(
    api.ticketAttributes.getByTicket,
    ticketId ? { ticketId: ticketId as any } : "skip"
  );
  
  // 🆕 Mutation per assicurarsi che gli attributi agentOnly esistano (per ticket vecchi)
  const ensureAgentOnlyAttributes = useMutation(api.ticketAttributes.ensureAgentOnlyAttributes);
  
  // 🆕 Effetto per creare attributi mancanti su ticket vecchi (una sola volta)
  const [hasCheckedAttributes, setHasCheckedAttributes] = useState(false);
  useEffect(() => {
    // Confronto case-insensitive con versioni italiane e inglesi
    const roleLower = user?.roleName?.toLowerCase();
    const isAgent = roleLower === 'agent' || roleLower === 'agente' || roleLower === 'admin' || roleLower === 'amministratore';
    
    if (ticketId && isAgent && allTicketAttributes !== undefined && !hasCheckedAttributes) {
      // Chiama la mutation per assicurarsi che tutti gli attributi agentOnly esistano
      ensureAgentOnlyAttributes({ ticketId: ticketId as any })
        .then(() => {
          setHasCheckedAttributes(true);
        })
        .catch(() => {
          setHasCheckedAttributes(true);
        });
    }
  }, [ticketId, user?.roleName, allTicketAttributes, hasCheckedAttributes]);

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


  // Mutations
  const addComment = useMutation(api.ticketComments.add);
  const nudgeTicket = useMutation(api.ticketComments.nudge);
  const updateTicket = useMutation(api.tickets.update);
  const executeMacro = useMutation(api.macros.executeMacro);
  const updateTicketAttribute = useMutation(api.ticketAttributes.update);

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
    } catch (error: any) {
      console.error("❌ Errore:", error.message);
    }
  };

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
