'use client'

import React, { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useAuth } from '@/hooks/useAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { hasFullAccess } from '@/lib/permissions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { 
  Eye,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  Users,
  Globe,
  User,
  Filter,
  X
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdminViewsPage() {
  const { user, isLoading: userLoading } = useAuth()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingView, setEditingView] = useState<any>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
    filters: {
      status: [] as string[],
      categoryId: undefined as string | undefined,
    },
    assignedToRoles: [] as string[],
  })
  
  // Estrai clinicId
  const clinicId = (user as any)?.clinicId || (user as any)?.clinic?._id
  
  // Queries
  const views = useQuery(
    api.ticketViews.getViewsByClinic,
    clinicId ? { clinicId } : "skip"
  )
  const categories = useQuery(
    api.categories.getCategoriesByClinic,
    clinicId ? { clinicId, isActive: true } : "skip"
  )
  const allUsers = useQuery(api.users.getAllUsers, {})
  
  // Mutations
  const createView = useMutation(api.ticketViews.createView)
  const updateView = useMutation(api.ticketViews.updateView)
  const deleteView = useMutation(api.ticketViews.deleteView)
  
  // Stati disponibili
  const statusOptions = [
    { value: 'open', label: 'Aperto' },
    { value: 'in_progress', label: 'In Corso' },
    { value: 'closed', label: 'Chiuso' }
  ]
  
  // Ruoli disponibili
  const roleOptions = [
    { value: 'utente', label: 'Utenti' },
    { value: 'agente', label: 'Agenti' },
    { value: 'amministratore', label: 'Amministratori' }
  ]
  
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      isPublic: false,
      filters: {
        status: [],
        categoryId: undefined,
      },
      assignedToRoles: [],
    })
    setEditingView(null)
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user?.email || !clinicId) {
      toast.error('Errore: dati utente mancanti')
      return
    }
    
    try {
      if (editingView) {
        await updateView({
          viewId: editingView._id,
          userEmail: user.email,
          name: formData.name,
          description: formData.description,
          isPublic: formData.isPublic,
          filters: formData.filters,
          assignedToRoles: formData.assignedToRoles.length > 0 ? formData.assignedToRoles : undefined,
        })
        toast.success('Vista aggiornata con successo!')
      } else {
        await createView({
          name: formData.name,
          description: formData.description,
          creatorEmail: user.email,
          clinicId,
          isPublic: formData.isPublic,
          isPersonal: false,
          filters: formData.filters,
          assignedToRoles: formData.assignedToRoles.length > 0 ? formData.assignedToRoles : undefined,
        })
        toast.success('Vista creata con successo!')
      }
      
      setShowCreateModal(false)
      resetForm()
    } catch (error) {
      console.error('Errore salvataggio vista:', error)
      toast.error('Errore durante il salvataggio della vista')
    }
  }
  
  const handleEdit = (view: any) => {
    setEditingView(view)
    setFormData({
      name: view.name,
      description: view.description,
      isPublic: view.isPublic,
      filters: view.filters || { status: [], categoryId: undefined },
      assignedToRoles: view.assignedToRoles || [],
    })
    setShowCreateModal(true)
  }
  
  const handleDelete = async (viewId: string) => {
    if (!user?.email) return
    
    if (confirm('Sei sicuro di voler eliminare questa vista?')) {
      try {
        await deleteView({ viewId: viewId as any, userEmail: user.email })
        toast.success('Vista eliminata con successo!')
      } catch (error) {
        console.error('Errore eliminazione vista:', error)
        toast.error('Errore durante l\'eliminazione della vista')
      }
    }
  }
  
  const toggleStatus = (status: string) => {
    setFormData(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        status: prev.filters.status.includes(status)
          ? prev.filters.status.filter(s => s !== status)
          : [...prev.filters.status, status]
      }
    }))
  }
  
  const toggleRole = (role: string) => {
    setFormData(prev => ({
      ...prev,
      assignedToRoles: prev.assignedToRoles.includes(role)
        ? prev.assignedToRoles.filter(r => r !== role)
        : [...prev.assignedToRoles, role]
    }))
  }
  
  // Controllo permessi
  if (userLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Eye className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Caricamento...</p>
          </div>
        </div>
      </AppLayout>
    )
  }
  
  if (!user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
            <p className="text-gray-600">Devi essere autenticato per accedere a questa pagina.</p>
          </div>
        </div>
      </AppLayout>
    )
  }
  
  // Controlla i permessi di amministratore
  if (!hasFullAccess(user.role)) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Eye className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
            <p className="text-gray-600">Solo gli amministratori possono gestire le viste.</p>
            <p className="text-sm text-gray-500 mt-2">Il tuo ruolo: {user.role?.name}</p>
          </div>
        </div>
      </AppLayout>
    )
  }
  
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                <Eye className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Gestione Viste</h1>
                <p className="text-gray-600">Crea e gestisci viste personalizzate dei ticket</p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Nuova Vista
          </Button>
        </div>
        
        {/* Lista Viste */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {views && views.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center text-gray-500">
                <Eye className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>Nessuna vista creata</p>
                <p className="text-sm mt-2">Crea la tua prima vista per organizzare i ticket</p>
              </CardContent>
            </Card>
          ) : (
            views?.map((view) => (
              <Card key={view._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {view.isPublic ? (
                          <Globe className="h-5 w-5 text-blue-500" />
                        ) : (
                          <Users className="h-5 w-5 text-purple-500" />
                        )}
                        <CardTitle className="text-lg">{view.name}</CardTitle>
                      </div>
                      <CardDescription>{view.description}</CardDescription>
                    </div>
                    <div className="flex space-x-1">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleEdit(view)}
                        title="Modifica vista"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleDelete(view._id)}
                        title="Elimina vista"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Visibilità */}
                  <div>
                    <Badge variant={view.isPublic ? 'default' : 'secondary'}>
                      {view.isPublic ? 'Pubblica' : 'Assegnata'}
                    </Badge>
                  </div>
                  
                  {/* Filtri applicati */}
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2">Filtri:</p>
                    <div className="flex flex-wrap gap-1">
                      {view.filters.status && view.filters.status.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Stati: {view.filters.status.length}
                        </Badge>
                      )}
                      {view.filters.categoryId && (
                        <Badge variant="outline" className="text-xs">
                          Categoria
                        </Badge>
                      )}
                      {(!view.filters.status || view.filters.status.length === 0) && !view.filters.categoryId && (
                        <span className="text-xs text-gray-500">Nessun filtro</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Assegnata a */}
                  {!view.isPublic && view.assignedToRoles && view.assignedToRoles.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">Visibile a:</p>
                      <div className="flex flex-wrap gap-1">
                        {view.assignedToRoles.map((role: string) => (
                          <Badge key={role} variant="secondary" className="text-xs capitalize">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Creatore */}
                  <div className="pt-2 border-t text-xs text-gray-500">
                    Creata da: {view.creator?.name || 'Sconosciuto'}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        
        {/* Modal Crea/Modifica Vista */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {editingView ? 'Modifica Vista' : 'Nuova Vista'}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCreateModal(false)
                      resetForm()
                    }}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <CardDescription>
                  {editingView 
                    ? 'Modifica le impostazioni della vista'
                    : 'Crea una nuova vista personalizzata per organizzare i ticket'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Nome */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Vista *
                    </label>
                    <Input 
                      placeholder="es. Ticket urgenti aperti" 
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  
                  {/* Descrizione */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descrizione *
                    </label>
                    <Textarea 
                      placeholder="Descrivi cosa mostra questa vista..." 
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      required
                    />
                  </div>
                  
                  {/* Visibilità */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Visibilità
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.isPublic}
                          onChange={() => setFormData(prev => ({ ...prev, isPublic: true }))}
                          className="h-4 w-4"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">Pubblica</span>
                          </div>
                          <p className="text-xs text-gray-500">Visibile a tutti gli utenti della clinica</p>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          checked={!formData.isPublic}
                          onChange={() => setFormData(prev => ({ ...prev, isPublic: false }))}
                          className="h-4 w-4"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-500" />
                            <span className="font-medium">Assegnata</span>
                          </div>
                          <p className="text-xs text-gray-500">Visibile solo ai ruoli selezionati</p>
                        </div>
                      </label>
                    </div>
                  </div>
                  
                  {/* Ruoli (se non pubblica) */}
                  {!formData.isPublic && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Visibile ai ruoli
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {roleOptions.map((role) => (
                          <button
                            key={role.value}
                            type="button"
                            onClick={() => toggleRole(role.value)}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                              formData.assignedToRoles.includes(role.value)
                                ? 'bg-purple-100 text-purple-700 border-2 border-purple-500'
                                : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                            }`}
                          >
                            {role.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Filtri */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Filter className="h-5 w-5 text-gray-600" />
                      <h3 className="text-lg font-semibold">Filtri Vista</h3>
                    </div>
                    
                    {/* Filtro Stati */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Stati
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {statusOptions.map((status) => (
                          <button
                            key={status.value}
                            type="button"
                            onClick={() => toggleStatus(status.value)}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                              formData.filters.status.includes(status.value)
                                ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                                : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                            }`}
                          >
                            {status.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Lascia vuoto per mostrare tutti gli stati</p>
                    </div>
                    
                    {/* Filtro Categoria */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Categoria
                      </label>
                      <select
                        value={formData.filters.categoryId || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          filters: {
                            ...prev.filters,
                            categoryId: e.target.value || undefined
                          }
                        }))}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="">Tutte le categorie</option>
                        {categories?.map((category) => (
                          <option key={category._id} value={category._id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Seleziona una categoria specifica (opzionale)</p>
                    </div>
                  </div>
                  
                  {/* Bottoni */}
                  <div className="flex items-center justify-end gap-2 pt-4">
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => {
                        setShowCreateModal(false)
                        resetForm()
                      }}
                    >
                      Annulla
                    </Button>
                    <Button type="submit">
                      {editingView ? 'Salva Modifiche' : 'Crea Vista'}
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

