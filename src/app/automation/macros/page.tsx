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
  Target,
  FileText,
  Layers,
  Users
} from 'lucide-react'

export default function MacrosPage() {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingMacro, setEditingMacro] = useState<any>(null)
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general' as string,
    actions: [] as Array<{
      type: string
      value: string
      order: number
    }>,
    isActive: true,
    requiresApproval: false,
    allowedRoles: [] as string[]
  })

  // Get clinic ID from user
  const clinicId = user?.clinic?._id
  
  // Queries - NOTA: Queste query dovranno essere implementate nel backend
  // Per ora uso dei dati fittizi per la struttura del frontend
  const [macros, setMacros] = useState<any[]>([])
  
  // Stats temporanee - da implementare nel backend
  const macroStats = {
    total: macros?.length || 0,
    active: macros?.filter((m: any) => m.isActive).length || 0,
    inactive: macros?.filter((m: any) => !m.isActive).length || 0,
    pendingApproval: 0
  }
  
  // Mutations fittizie - da implementare nel backend
  const createMacro = async (data: any) => {
    // Simulazione creazione
    const newMacro = { ...data, _id: Date.now().toString(), creator: { name: (user as any)?.name || 'Sconosciuto' } }
    setMacros(prev => [...prev, newMacro])
    return newMacro
  }
  
  const updateMacro = async (data: any) => {
    // Simulazione aggiornamento
    setMacros(prev => prev.map(m => m._id === data.ticketId ? { ...m, ...data } : m))
    return data
  }
  
  const deleteMacro = async (data: any) => {
    // Simulazione eliminazione
    setMacros(prev => prev.filter(m => m._id !== data.ticketId))
    return data
  }

  // Filter macros based on search
  const filteredMacros = macros?.filter((macro: any) =>
    macro.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clinicId || !formData.name.trim()) {
      alert('Errore: Clinica non trovata o nome macro mancante')
      return
    }

    try {
      const macroData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        actions: formData.actions,
        isActive: formData.isActive,
        requiresApproval: formData.requiresApproval,
        allowedRoles: formData.allowedRoles,
        clinicId
      }

      if (editingMacro) {
        // Update existing macro
        await updateMacro({
          ticketId: editingMacro._id,
          ...macroData
        })
      } else {
        // Create new macro
        await createMacro({
          ...macroData,
          creatorId: (user as any)?._id
        })
      }
      
      // Reset form
      setFormData({ 
        name: '', 
        description: '', 
        category: 'general',
        actions: [],
        isActive: true,
        requiresApproval: false,
        allowedRoles: []
      })
      setShowCreateForm(false)
      setEditingMacro(null)
    } catch (error) {
      console.error('Errore nel salvare la macro:', error)
      alert('Errore nel salvare la macro: ' + error)
    }
  }

  // Handle edit
  const handleEdit = (macro: { _id: string; name: string; description?: string; category?: string; actions?: any[]; isActive?: boolean; requiresApproval?: boolean; allowedRoles?: string[] }) => {
    setEditingMacro(macro)
    setFormData({
      name: macro.name,
      description: macro.description || '',
      category: macro.category || 'general',
      actions: macro.actions || [],
      isActive: macro.isActive !== false,
      requiresApproval: macro.requiresApproval || false,
      allowedRoles: macro.allowedRoles || []
    })
    setShowCreateForm(true)
  }

  // Handle delete
  const handleDelete = async (macroId: string) => {
    if (confirm('Sei sicuro di voler eliminare questa macro?')) {
      try {
        await deleteMacro({ ticketId: macroId })
      } catch (error) {
        console.error('Errore nell\'eliminare la macro:', error)
        alert('Errore nell\'eliminare la macro: ' + error)
      }
    }
  }

  // Handle execute macro
  const handleExecute = async (macro: { _id: string; name: string }) => {
    if (confirm(`Sei sicuro di voler eseguire la macro "${macro.name}"?`)) {
      try {
        // Qui andrebbe implementata la logica di esecuzione della macro
        alert(`Macro "${macro.name}" eseguita con successo!`)
      } catch (error) {
        console.error('Errore nell\'eseguire la macro:', error)
        alert('Errore nell\'eseguire la macro: ' + error)
      }
    }
  }

  // Add action to form
  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [
        ...prev.actions,
        { type: '', value: '', order: prev.actions.length + 1 }
      ]
    }))
  }

  // Update action
  const updateAction = (index: number, field: 'type' | 'value', value: string) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((action, i) => 
        i === index ? { ...action, [field]: value } : action
      )
    }))
  }

  // Remove action
  const removeAction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }))
  }

  if (!user) {
    return <div>Caricamento...</div>
  }

  // Controllo permessi: solo agenti e admin possono gestire le macro
  if (user.role?.name !== 'Agente' && user.role?.name !== 'Amministratore') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
            <p className="text-gray-600">Non hai i permessi per gestire le macro.</p>
            <p className="text-sm text-gray-500 mt-2">Richiesti ruoli: Agente o Amministratore</p>
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
              <Zap className="h-8 w-8 mr-3 text-purple-600" />
              Gestione Macro
            </h1>
            <p className="text-gray-600 mt-2">
              Crea e gestisci macro per automatizzare sequenze di azioni complesse
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button 
              onClick={() => {
                setEditingMacro(null)
                setFormData({ 
                  name: '', 
                  description: '', 
                  category: 'general',
                  actions: [],
                  isActive: true,
                  requiresApproval: false,
                  allowedRoles: []
                })
                setShowCreateForm(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuova Macro
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Macro Totali</p>
                  <p className="text-2xl font-bold text-gray-900">{macroStats.total}</p>
                </div>
                <Layers className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Macro Attive</p>
                  <p className="text-2xl font-bold text-gray-900">{macroStats.active}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Macro Inattive</p>
                  <p className="text-2xl font-bold text-gray-900">{macroStats.inactive}</p>
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
                  <p className="text-2xl font-bold text-gray-900">{macroStats.pendingApproval}</p>
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
                placeholder="Cerca macro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Macros List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredMacros.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              {macros === undefined ? 'Caricamento macro...' : 'Nessuna macro trovata.'}
            </div>
          ) : (
            filteredMacros.map((macro) => (
              <Card key={macro._id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center">
                        <Zap className={`h-4 w-4 mr-2 ${macro.isActive !== false ? 'text-green-500' : 'text-gray-400'}`} />
                        {macro.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {macro.description || 'Nessuna descrizione'}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-1">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleExecute(macro)}
                        title="Esegui macro"
                      >
                        <Play className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleEdit(macro)}
                        title="Modifica macro"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleDelete(macro._id)}
                        title="Elimina macro"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Category and Actions */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Categoria:</span>
                      <Badge variant="default">
                        {macro.category || 'Generale'}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Layers className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">Azioni:</span>
                      <Badge variant="default">
                        {macro.actions?.length || 0}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Status and Info */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center space-x-2">
                      <Badge variant={macro.isActive !== false ? 'success' : 'default'}>
                        {macro.isActive !== false ? 'Attiva' : 'Inattiva'}
                      </Badge>
                      {macro.requiresApproval && (
                        <Badge variant="warning">
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
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>
                  {editingMacro ? 'Modifica Macro' : 'Nuova Macro'}
                </CardTitle>
                <CardDescription>
                  {editingMacro 
                    ? 'Modifica le impostazioni della macro esistente'
                    : 'Crea una nuova macro per automatizzare sequenze di azioni'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Macro *
                    </label>
                    <Input 
                      placeholder="es. Gestione ticket urgente completo" 
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descrizione
                    </label>
                    <Textarea 
                      placeholder="Descrivi cosa fa questa macro..." 
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoria
                    </label>
                    <select 
                      className="w-full p-2 border rounded-md"
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    >
                      <option value="general">Generale</option>
                      <option value="ticket_management">Gestione Ticket</option>
                      <option value="notification">Notifiche</option>
                      <option value="assignment">Assegnazione</option>
                      <option value="escalation">Escalation</option>
                    </select>
                  </div>
                  
                  {/* Actions Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Azioni della Macro
                      </label>
                      <Button 
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addAction}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Aggiungi Azione
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      {formData.actions.map((action, index) => (
                        <div key={index} className="flex items-center space-x-2 p-3 border rounded-md bg-gray-50">
                          <span className="text-sm font-medium text-gray-500">
                            {index + 1}.
                          </span>
                          <select 
                            className="flex-1 p-2 border rounded-md"
                            value={action.type}
                            onChange={(e) => updateAction(index, 'type', e.target.value)}
                          >
                            <option value="">Seleziona azione</option>
                            <option value="assign_user">Assegna utente</option>
                            <option value="change_status">Cambia stato</option>
                            <option value="change_priority">Cambia priorità</option>
                            <option value="send_notification">Invia notifica</option>
                            <option value="add_comment">Aggiungi commento</option>
                            <option value="set_due_date">Imposta scadenza</option>
                          </select>
                          <Input 
                            placeholder="Valore"
                            value={action.value}
                            onChange={(e) => updateAction(index, 'value', e.target.value)}
                            className="w-32"
                          />
                          <Button 
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeAction(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                      
                      {formData.actions.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">
                          Nessuna azione definita. Clicca su "Aggiungi Azione" per iniziare.
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                        className="rounded"
                      />
                      <label htmlFor="isActive" className="text-sm text-gray-700">
                        Macro attiva
                      </label>
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
                        Richiede approvazione
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => {
                        setShowCreateForm(false)
                        setEditingMacro(null)
                        setFormData({ 
                          name: '', 
                          description: '', 
                          category: 'general',
                          actions: [],
                          isActive: true,
                          requiresApproval: false,
                          allowedRoles: []
                        })
                      }}
                    >
                      Annulla
                    </Button>
                    <Button type="submit">
                      {editingMacro ? 'Salva Modifiche' : 'Crea Macro'}
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
