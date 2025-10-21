'use client'

import React, { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useAuth } from '@/hooks/useAuth'
import { canManageAllTickets } from '@/lib/permissions'
import { 
  Zap,
  Plus,
  Search,
  Edit,
  Trash2,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Code,
  Target
} from 'lucide-react'

export default function TriggersPage() {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTrigger, setEditingTrigger] = useState<any>(null)
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    conditionType: 'status_change' as string,
    conditionValue: '',
    actionType: 'assign_user' as string,
    actionValue: '',
    requiresApproval: false
  })

  // Get clinic ID from user
  const clinicId = (user as any)?.clinicId || (user as any)?.clinic?._id
  
  // Queries
  const triggers = useQuery(api.triggers.getTriggersByClinic, 
    clinicId ? { clinicId } : "skip"
  )
  const triggerStats = useQuery(api.triggers.getTriggerStats, 
    clinicId ? { clinicId } : "skip"
  )
  
  // Query per categorie
  const categoriesFromDB = useQuery(
    api.categories.getCategoriesByClinic,
    clinicId ? { clinicId, isActive: true } : "skip"
  )
  
  // Query per utenti (agenti/admin)
  const usersFromDB = useQuery(
    api.users.getAvailableAgents,
    clinicId && user?.email ? { clinicId, userEmail: user.email } : "skip"
  )
  
  // Query per stati ticket DINAMICI dal database (con fallback)
  const ticketStatusesFromDB = useQuery(api.ticketStatuses?.getActiveStatuses || "skip")
  
  // Mappa gli stati in formato semplice per le dropdown
  // FALLBACK: Se Convex non ha ancora caricato il nuovo file, usa stati statici
  const ticketStatuses = ticketStatusesFromDB?.map(status => ({
    value: status.slug,
    label: status.name,
    color: status.color
  })) || [
    { value: 'open', label: 'Aperto', color: '#ef4444' },
    { value: 'in_progress', label: 'In Corso', color: '#f59e0b' },
    { value: 'closed', label: 'Chiuso', color: '#22c55e' }
  ]
  
  // Mutations (usando versioni con autenticazione)
  const createTrigger = useMutation(api.triggers.createTrigger)
  const updateTrigger = useMutation(api.triggers.updateTrigger)
  const deleteTrigger = useMutation(api.triggers.deleteTrigger)

  // Filter triggers based on search
  const filteredTriggers = triggers?.filter(trigger =>
    trigger.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clinicId || !formData.name.trim() || !user?.email) {
      alert('Errore: Clinica non trovata o nome trigger mancante')
      return
    }

    try {
      const conditions = {
        type: formData.conditionType,
        value: formData.conditionValue || null
      }
      
      const actions = {
        type: formData.actionType,
        value: formData.actionValue || null
      }

      if (editingTrigger) {
        // Update existing trigger
        await updateTrigger({
          triggerId: editingTrigger._id,
          name: formData.name,
          conditions,
          actions,
          requiresApproval: formData.requiresApproval
        })
      } else {
        // Create new trigger
        await createTrigger({
          name: formData.name,
          clinicId,
          conditions,
          actions,
          requiresApproval: formData.requiresApproval
        })
      }
      
      // Reset form
      setFormData({ 
        name: '', 
        description: '', 
        conditionType: 'status_change',
        conditionValue: '',
        actionType: 'assign_user',
        actionValue: '',
        requiresApproval: false
      })
      setShowCreateForm(false)
      setEditingTrigger(null)
    } catch (error) {
      console.error('Errore nel salvare il trigger:', error)
      alert('Errore nel salvare il trigger: ' + error)
    }
  }

  // Handle edit
  const handleEdit = (trigger: any) => {
    setEditingTrigger(trigger)
    setFormData({
      name: trigger.name,
      description: '',
      conditionType: trigger.conditions?.type || 'status_change',
      conditionValue: trigger.conditions?.value || '',
      actionType: trigger.actions?.type || 'assign_user',
      actionValue: trigger.actions?.value || '',
      requiresApproval: trigger.requiresApproval
    })
    setShowCreateForm(true)
  }

  // Handle delete
  const handleDelete = async (triggerId: string) => {
    if (confirm('Sei sicuro di voler eliminare questo trigger?')) {
      try {
        await deleteTrigger({ triggerId })
      } catch (error) {
        console.error('Errore nell\'eliminare il trigger:', error)
        alert('Errore nell\'eliminare il trigger: ' + error)
      }
    }
  }

  if (!user) {
    return <div>Caricamento...</div>
  }

  // Controllo permessi: basato sui permessi del ruolo
  if (!canManageAllTickets(user.role)) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
            <p className="text-gray-600">Non hai i permessi per gestire i trigger.</p>
            <p className="text-sm text-gray-500 mt-2">Richiesti permessi: gestione ticket</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Se non c'è clinicId, mostra messaggio di errore
  if (!clinicId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Clinica Non Trovata</h1>
            <p className="text-gray-600">Non è possibile determinare la clinica di appartenenza.</p>
            <p className="text-sm text-gray-500 mt-2">Contatta l'amministratore di sistema.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Zap className="h-8 w-8 mr-3 text-blue-600" />
              Gestione Trigger
            </h1>
            <p className="text-gray-600 mt-2">
              Automatizza le azioni sui ticket con trigger intelligenti
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button 
              onClick={() => {
                setEditingTrigger(null)
                setFormData({ 
                  name: '', 
                  description: '', 
                  conditionType: 'status_change',
                  conditionValue: '',
                  actionType: 'assign_user',
                  actionValue: '',
                  requiresApproval: false
                })
                setShowCreateForm(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Trigger
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Trigger Totali</p>
                  <p className="text-2xl font-bold text-gray-900">{triggerStats?.total || 0}</p>
                </div>
                <Zap className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Trigger Attivi</p>
                  <p className="text-2xl font-bold text-gray-900">{triggerStats?.active || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Trigger Inattivi</p>
                  <p className="text-2xl font-bold text-gray-900">{triggerStats?.inactive || 0}</p>
                </div>
                <Pause className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">In Approvazione</p>
                  <p className="text-2xl font-bold text-gray-900">{triggerStats?.pendingApproval || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cerca trigger..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Triggers List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredTriggers.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              {triggers === undefined ? 'Caricamento trigger...' : 'Nessun trigger trovato.'}
            </div>
          ) : (
            filteredTriggers.map((trigger) => (
              <Card key={trigger._id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center">
                        <Zap className={`h-4 w-4 mr-2 ${trigger.isActive ? 'text-green-500' : 'text-gray-400'}`} />
                        {trigger.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Creato da {trigger.creator?.name || 'Sconosciuto'}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-1">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleEdit(trigger)}
                        title="Modifica trigger"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleDelete(trigger._id)}
                        title="Elimina trigger"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Condition & Action */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Target className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Quando:</span>
                      <Badge variant="outline">
                        {trigger.conditions?.type || 'Non definito'}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Settings className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Allora:</span>
                      <Badge variant="outline">
                        {trigger.actions?.type || 'Non definito'}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Status and Info */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center space-x-2">
                      <Badge variant={trigger.isActive ? 'success' : 'secondary'}>
                        {trigger.isActive ? 'Attivo' : 'Inattivo'}
                      </Badge>
                      {trigger.requiresApproval && (
                        <Badge variant="outline">
                          Richiede Approvazione
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Create/Edit Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>
                  {editingTrigger ? 'Modifica Trigger' : 'Nuovo Trigger'}
                </CardTitle>
                <CardDescription>
                  {editingTrigger 
                    ? 'Modifica le impostazioni del trigger esistente'
                    : 'Crea un nuovo trigger per automatizzare le azioni'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Trigger *
                    </label>
                    <Input 
                      placeholder="es. Assegna automaticamente ticket urgenti" 
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Condizione (Quando)
                      </label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={formData.conditionType}
                        onChange={(e) => setFormData(prev => ({ ...prev, conditionType: e.target.value, conditionValue: '' }))}
                      >
                        <option value="status_change">Cambio di stato</option>
                        <option value="priority_high">Priorità alta</option>
                        <option value="time_elapsed">Tempo trascorso</option>
                        <option value="keyword_match">Parola chiave</option>
                        <option value="category_match">Categoria specifica</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valore Condizione
                      </label>
                      {formData.conditionType === 'category_match' ? (
                        <select 
                          className="w-full p-2 border rounded-md"
                          value={formData.conditionValue}
                          onChange={(e) => setFormData(prev => ({ ...prev, conditionValue: e.target.value }))}
                          required
                        >
                          <option value="">Seleziona una categoria...</option>
                          {categoriesFromDB?.map((cat) => (
                            <option key={cat._id} value={cat.slug}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      ) : formData.conditionType === 'status_change' ? (
                        <select 
                          className="w-full p-2 border rounded-md"
                          value={formData.conditionValue}
                          onChange={(e) => setFormData(prev => ({ ...prev, conditionValue: e.target.value }))}
                          required
                        >
                          <option value="">Seleziona uno stato...</option>
                          {ticketStatuses.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input 
                          placeholder="es. 24 ore, parola chiave..." 
                          value={formData.conditionValue}
                          onChange={(e) => setFormData(prev => ({ ...prev, conditionValue: e.target.value }))}
                        />
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Azione (Allora)
                      </label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={formData.actionType}
                        onChange={(e) => setFormData(prev => ({ ...prev, actionType: e.target.value, actionValue: '' }))}
                      >
                        <option value="assign_user">Assegna utente</option>
                        <option value="change_status">Cambia stato</option>
                        <option value="change_priority">Cambia priorità</option>
                        <option value="send_notification">Invia notifica</option>
                        <option value="add_comment">Aggiungi commento</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valore Azione
                      </label>
                      {formData.actionType === 'assign_user' ? (
                        <select 
                          className="w-full p-2 border rounded-md"
                          value={formData.actionValue}
                          onChange={(e) => setFormData(prev => ({ ...prev, actionValue: e.target.value }))}
                          required
                        >
                          <option value="">Seleziona un utente...</option>
                          {usersFromDB?.map((userItem) => (
                            <option key={userItem._id} value={userItem.email}>
                              {userItem.name} ({userItem.email})
                            </option>
                          ))}
                        </select>
                      ) : formData.actionType === 'change_status' ? (
                        <select 
                          className="w-full p-2 border rounded-md"
                          value={formData.actionValue}
                          onChange={(e) => setFormData(prev => ({ ...prev, actionValue: e.target.value }))}
                          required
                        >
                          <option value="">Seleziona uno stato...</option>
                          {ticketStatuses.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input 
                          placeholder="es. urgent, testo commento..." 
                          value={formData.actionValue}
                          onChange={(e) => setFormData(prev => ({ ...prev, actionValue: e.target.value }))}
                        />
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="requiresApproval"
                      checked={formData.requiresApproval}
                      onChange={(e) => setFormData(prev => ({ ...prev, requiresApproval: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="requiresApproval" className="text-sm text-gray-700">
                      Richiede approvazione prima dell'esecuzione
                    </label>
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => {
                        setShowCreateForm(false)
                        setEditingTrigger(null)
                        setFormData({ 
                          name: '', 
                          description: '', 
                          conditionType: 'status_change',
                          conditionValue: '',
                          actionType: 'assign_user',
                          actionValue: '',
                          requiresApproval: false
                        })
                      }}
                    >
                      Annulla
                    </Button>
                    <Button type="submit">
                      {editingTrigger ? 'Salva Modifiche' : 'Crea Trigger'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
