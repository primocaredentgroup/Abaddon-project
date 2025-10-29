'use client'

import React, { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useAuth } from '@/hooks/useAuth'
import { canCreatePersonalViews as checkCanCreatePersonalViews, hasFullAccess } from '@/lib/permissions'
import { AppLayout } from '@/components/layout/AppLayout'
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
  Globe,
  User,
  X,
  Filter,
  Ticket as TicketIcon,
  Shield
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ViewsPage() {
  const { user, role, isLoading: userLoading } = useAuth()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingView, setEditingView] = useState<any>(null)
  const [selectedView, setSelectedView] = useState<any>(null)
  const [showTicketsModal, setShowTicketsModal] = useState(false)
  
  // 🔒 CONTROLLO ACCESSO: Solo admin possono vedere questa pagina
  const isAdmin = role ? hasFullAccess(role) : false
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    filters: {
      status: [] as string[],
      categoryId: undefined as string | undefined,
    },
  })
  
  // Estrai clinicId
  const clinicId = (user as any)?.clinicId || (user as any)?.clinic?._id
  
  // Queries
  const availableViews = useQuery(
    api.ticketViews.getAvailableViewsForUser,
    user?.email && clinicId ? { userEmail: user.email, clinicId } : "skip"
  )
  
  // 🔓 ADMIN VIEW: Mostra TUTTE le categorie (no filtro società)
  const categories = useQuery(
    api.categories.getCategoriesByClinic,
    { isActive: true } // NO userId → mostra TUTTO
  )
  
  // Query per i ticket di una vista specifica
  const viewTickets = useQuery(
    api.ticketViews.getTicketsByView,
    selectedView && user?.email
      ? { viewId: selectedView._id, userEmail: user.email }
      : "skip"
  )
  
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
  
  // Separa viste pubbliche e personali
  const publicViews = availableViews?.filter(v => v.isPublic) || []
  const personalViews = availableViews?.filter(v => v.isPersonal && v.createdBy === (user as any)?._id) || []
  const assignedViews = availableViews?.filter(v => !v.isPublic && !v.isPersonal) || []
  
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      filters: {
        status: [],
        categoryId: undefined,
      },
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
          filters: formData.filters,
        })
        toast.success('Vista aggiornata con successo!')
      } else {
        await createView({
          name: formData.name,
          description: formData.description,
          creatorEmail: user.email,
          clinicId,
          isPublic: false,
          isPersonal: true, // Le viste create dagli utenti sono sempre personali
          filters: formData.filters,
        })
        toast.success('Vista personale creata con successo!')
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
      filters: view.filters || { status: [], categoryId: undefined },
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
  
  const handleViewTickets = (view: any) => {
    setSelectedView(view)
    setShowTicketsModal(true)
  }
  
  // Controllo autenticazione
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
  
  // 🔒 CONTROLLO ADMIN: Solo amministratori possono accedere
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Riservato</h1>
            <p className="text-gray-600">Solo gli amministratori possono accedere alla gestione delle viste.</p>
            <Link href="/dashboard">
              <Button className="mt-4">
                Torna alla Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    )
  }
  
  const canCreatePersonalViews = checkCanCreatePersonalViews(user.role)
  
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
                <h1 className="text-3xl font-bold text-gray-900">Le Mie Viste</h1>
                <p className="text-gray-600">Accedi rapidamente ai ticket filtrati per te</p>
              </div>
            </div>
          </div>
          {canCreatePersonalViews && (
            <Button
              onClick={() => {
                resetForm()
                setShowCreateModal(true)
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Vista Personale
            </Button>
          )}
        </div>
        
        {/* Viste Pubbliche */}
        {publicViews.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              Viste Pubbliche
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {publicViews.map((view) => (
                <Card key={view._id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleViewTickets(view)}>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-5 w-5 text-blue-500" />
                      <CardTitle className="text-lg">{view.name}</CardTitle>
                    </div>
                    <CardDescription>{view.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="default">Pubblica</Badge>
                      <Button size="sm" variant="outline">
                        <TicketIcon className="h-4 w-4 mr-1" />
                        Vedi Ticket
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        
        {/* Viste Assegnate */}
        {assignedViews.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-purple-500" />
              Viste Assegnate
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {assignedViews.map((view) => (
                <Card key={view._id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleViewTickets(view)}>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-5 w-5 text-purple-500" />
                      <CardTitle className="text-lg">{view.name}</CardTitle>
                    </div>
                    <CardDescription>{view.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Assegnata</Badge>
                      <Button size="sm" variant="outline">
                        <TicketIcon className="h-4 w-4 mr-1" />
                        Vedi Ticket
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        
        {/* Viste Personali */}
        {canCreatePersonalViews && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-green-500" />
              Le Mie Viste Personali
            </h2>
            {personalViews.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <Eye className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>Nessuna vista personale creata</p>
                  <p className="text-sm mt-2">Crea la tua prima vista per organizzare i ticket</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {personalViews.map((view) => (
                  <Card key={view._id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => handleViewTickets(view)}>
                          <div className="flex items-center gap-2 mb-2">
                            <Eye className="h-5 w-5 text-green-500" />
                            <CardTitle className="text-lg">{view.name}</CardTitle>
                          </div>
                          <CardDescription>{view.description}</CardDescription>
                        </div>
                        <div className="flex space-x-1">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(view)
                            }}
                            title="Modifica vista"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(view._id)
                            }}
                            title="Elimina vista"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Badge className="bg-green-100 text-green-800">Personale</Badge>
                        <Button size="sm" variant="outline" onClick={() => handleViewTickets(view)}>
                          <TicketIcon className="h-4 w-4 mr-1" />
                          Vedi Ticket
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Messaggio se non ci sono viste */}
        {publicViews.length === 0 && assignedViews.length === 0 && personalViews.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <Eye className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">Nessuna vista disponibile</h3>
              <p className="mb-4">Non hai ancora viste a disposizione</p>
              {canCreatePersonalViews && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-5 w-5 mr-2" />
                  Crea la tua prima vista
                </Button>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Modal Crea/Modifica Vista Personale */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {editingView ? 'Modifica Vista Personale' : 'Nuova Vista Personale'}
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
                    ? 'Modifica la tua vista personale'
                    : 'Crea una vista personalizzata solo per te'
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
                      placeholder="es. I miei ticket urgenti" 
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
        
        {/* Modal Ticket Vista */}
        {showTicketsModal && selectedView && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedView.name}</CardTitle>
                    <CardDescription>{selectedView.description}</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowTicketsModal(false)
                      setSelectedView(null)
                    }}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {viewTickets === undefined ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Caricamento ticket...</p>
                  </div>
                ) : viewTickets.length === 0 ? (
                  <div className="text-center py-8">
                    <TicketIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">Nessun ticket trovato con questi filtri</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {viewTickets.map((ticket: any) => (
                      <Link key={ticket._id} href={`/tickets/${ticket._id}`}>
                        <div className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold">{ticket.title}</h3>
                            <Badge>{ticket.status}</Badge>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{ticket.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {ticket.priority}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {new Date(ticket._creationTime).toLocaleDateString('it-IT')}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

