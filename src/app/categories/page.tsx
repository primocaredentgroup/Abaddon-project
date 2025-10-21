'use client'

import React, { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useAuth } from '@/hooks/useAuth'
import { AttributeBuilder } from '@/components/admin/AttributeBuilder'
import { canManageAllTickets } from '@/lib/permissions'
import { 
  Tags,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  BarChart3,
  Hash,
  Palette,
  Zap,
  Brain,
  Users,
  TrendingUp,
  RotateCcw,
  Archive,
  AlertTriangle,
  Settings2,
  X,
  Lock, // 🆕 Icona lucchetto
  Loader2 // 🆕 Spinner per loading
} from 'lucide-react'

export default function AdminCategoriesPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'categories' | 'tags' | 'deleted'>('categories')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  const [managingAttributesCategory, setManagingAttributesCategory] = useState<any>(null) // 🆕 Modal attributi
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null) // 🆕 Loading state per cancellazione
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: 'public' as 'public' | 'private',
    defaultTicketVisibility: 'public' as 'public' | 'private', // 🆕 Visibilità di default per i ticket
    synonyms: '',
    societyIds: [] as string[] // 🆕 Supporto società
  })

  // Estrai clinicId in modo sicuro (potrebbe essere user.clinicId o user.clinic._id)
  const clinicId = (user as any)?.clinicId || (user as any)?.clinic?._id
  
  // Queries
  const categories = useQuery(api.categories.getAllCategoriesByClinic, 
    clinicId ? { clinicId, includeDeleted: false } : "skip"
  )
  const deletedCategories = useQuery(api.categories.getDeletedCategories, 
    clinicId ? { clinicId } : "skip"
  )
  const societies = useQuery(api.societies.getAllSocieties, { activeOnly: true })
  const categoryAttributes = useQuery(
    api.categoryAttributes.getByCategory,
    managingAttributesCategory ? { categoryId: managingAttributesCategory._id } : "skip"
  )
  
  // Mutations (usando versioni con autenticazione)
  const createCategory = useMutation(api.categories.createCategory)
  const updateCategory = useMutation(api.categories.updateCategory)
  const softDeleteCategory = useMutation(api.categories.softDeleteCategory)
  const restoreCategory = useMutation(api.categories.restoreCategory)
  const hardDeleteCategory = useMutation(api.categories.deleteCategory)
  
  // 🆕 Mutations per attributi (usando versioni con autenticazione)
  const createAttribute = useMutation(api.categoryAttributes.create)
  const updateAttribute = useMutation(api.categoryAttributes.update)
  const deleteAttribute = useMutation(api.categoryAttributes.remove)

  // Filter categories based on search + Optimistic Update 🚀
  const filteredCategories = categories?.filter(cat =>
    // 🎯 Nascondi immediatamente la categoria che si sta cancellando (optimistic!)
    cat._id !== deletingCategoryId &&
    (cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.synonyms.some(syn => syn.toLowerCase().includes(searchTerm.toLowerCase())))
  ) || []

  const filteredDeletedCategories = deletedCategories?.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clinicId || !formData.name.trim()) {
      alert('Errore: Clinica non trovata o nome categoria mancante')
      return
    }

    try {
      const synonymsArray = formData.synonyms 
        ? formData.synonyms.split(',').map(s => s.trim()).filter(Boolean)
        : []

      if (editingCategory) {
        // Update existing category
        await updateCategory({
          categoryId: editingCategory._id,
          name: formData.name,
          description: formData.description || undefined,
          visibility: formData.visibility,
          defaultTicketVisibility: formData.defaultTicketVisibility, // 🆕
          societyIds: formData.societyIds.length > 0 ? formData.societyIds : undefined // 🆕 Società
        })
      } else {
        // Create new category
        await createCategory({
          name: formData.name,
          description: formData.description || undefined,
          clinicId,
          visibility: formData.visibility,
          defaultTicketVisibility: formData.defaultTicketVisibility, // 🆕
          synonyms: synonymsArray,
          societyIds: formData.societyIds.length > 0 ? formData.societyIds : undefined // 🆕 Società
        })
      }
      
      // Reset form
      setFormData({ name: '', description: '', visibility: 'public', defaultTicketVisibility: 'public', synonyms: '', societyIds: [] })
      setShowCreateForm(false)
      setEditingCategory(null)
    } catch (error) {
      console.error('Errore nel salvare la categoria:', error)
      alert('Errore nel salvare la categoria: ' + error)
    }
  }

  // Handle edit
  const handleEdit = (category: any) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || '',
      visibility: category.visibility,
      defaultTicketVisibility: category.defaultTicketVisibility || 'public', // 🆕 Default a public se non impostato
      synonyms: category.synonyms.join(', '),
      societyIds: category.societyIds || []
    })
    setShowCreateForm(true)
  }

  // Handle soft delete con Optimistic Update 🚀
  const handleSoftDelete = async (categoryId: string) => {
    if (confirm('Sei sicuro di voler eliminare questa categoria? Potrà essere ripristinata dal cestino.')) {
      // 🎯 STEP 1: Mostra immediatamente lo spinner (feedback istantaneo!)
      setDeletingCategoryId(categoryId)
      
      try {
        // 🎯 STEP 2: Esegui la mutation in background
        await softDeleteCategory({ categoryId })
      } catch (error) {
        console.error('Errore nell\'eliminare la categoria:', error)
        alert('Errore nell\'eliminare la categoria: ' + error)
      } finally {
        // 🎯 STEP 3: Rimuovi lo spinner quando finito
        setDeletingCategoryId(null)
      }
    }
  }

  // Handle restore
  const handleRestore = async (categoryId: string) => {
    try {
      await restoreCategory({ categoryId })
    } catch (error) {
      console.error('Errore nel ripristinare la categoria:', error)
      alert('Errore nel ripristinare la categoria: ' + error)
    }
  }

  // Handle hard delete
  const handleHardDelete = async (categoryId: string) => {
    if (confirm('ATTENZIONE: Questa operazione eliminerà DEFINITIVAMENTE la categoria. Non potrà essere recuperata. Continuare?')) {
      try {
        await hardDeleteCategory({ categoryId })
      } catch (error) {
        console.error('Errore nell\'eliminazione definitiva:', error)
        alert('Errore nell\'eliminazione definitiva: ' + error)
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
            <p className="text-gray-600">Non hai i permessi per gestire le categorie.</p>
            <p className="text-sm text-gray-500 mt-2">Richiesti permessi: gestione ticket</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  // 🆕 Handler per salvare gli attributi
  const handleSaveAttributes = async (attributes: any[]) => {
    if (!managingAttributesCategory) return
    
    try {
      for (const attr of attributes) {
        if (attr.isNew) {
          // Crea nuovo attributo
          await createAttribute({
            categoryId: managingAttributesCategory._id,
            name: attr.name,
            slug: attr.slug,
            type: attr.type,
            required: attr.required || false,
            showInCreation: attr.showInCreation !== false,
            showInList: attr.showInList || false,
            order: attr.order || 0,
            config: attr.config || {},
            conditions: attr.conditions,
          })
        } else if (attr._id) {
          // Aggiorna attributo esistente
          await updateAttribute({
            attributeId: attr._id,
            name: attr.name,
            slug: attr.slug,
            type: attr.type,
            required: attr.required,
            showInCreation: attr.showInCreation,
            showInList: attr.showInList,
            order: attr.order,
            config: attr.config,
            conditions: attr.conditions,
          })
        }
      }
      
      alert('✅ Attributi salvati con successo!')
      setManagingAttributesCategory(null)
    } catch (error) {
      console.error('Errore salvataggio attributi:', error)
      alert('❌ Errore durante il salvataggio degli attributi')
    }
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
              <Tags className="h-8 w-8 mr-3 text-blue-600" />
              Gestione Categorie
            </h1>
            <p className="text-gray-600 mt-2">
              Gestisci le categorie per la classificazione dei ticket
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button 
              onClick={() => {
                setEditingCategory(null)
                setFormData({ name: '', description: '', visibility: 'public', defaultTicketVisibility: 'public', synonyms: '', societyIds: [] })
                setShowCreateForm(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuova Categoria
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Categorie Attive</p>
                  <p className="text-2xl font-bold text-gray-900">{categories?.length || 0}</p>
                </div>
                <Tags className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Categorie Pubbliche</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {categories?.filter(c => c.visibility === 'public').length || 0}
                  </p>
                </div>
                <Eye className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Nel Cestino</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {deletedCategories?.length || 0}
                  </p>
                </div>
                <Archive className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Con Sinonimi</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {categories?.filter(c => c.synonyms.length > 0).length || 0}
                  </p>
                </div>
                <Brain className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cerca categorie, tag, descrizioni..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'categories' ? 'default' : 'outline'}
              onClick={() => setActiveTab('categories')}
            >
              <Tags className="w-4 h-4 mr-2" />
              Categorie ({categories?.length || 0})
            </Button>
            <Button
              variant={activeTab === 'deleted' ? 'default' : 'outline'}
              onClick={() => setActiveTab('deleted')}
            >
              <Archive className="w-4 h-4 mr-2" />
              Cestino ({deletedCategories?.length || 0})
            </Button>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'categories' ? (
          /* Categories View */
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCategories.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                {categories === undefined ? 'Caricamento categorie...' : 'Nessuna categoria trovata.'}
              </div>
            ) : (
              filteredCategories.map((category) => (
                <Card key={category._id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-2 ${
                            category.visibility === 'public' ? 'bg-green-500' : 'bg-gray-500'
                          }`} />
                          {category.name}
                          {/* 🆕 Lucchetto se la categoria ha ticket privati di default */}
                          {category.defaultTicketVisibility === 'private' && (
                            <span title="I ticket in questa categoria sono privati di default">
                              <Lock className="h-4 w-4 ml-2 text-orange-600" />
                            </span>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {category.description || 'Nessuna descrizione'}
                        </CardDescription>
                      </div>
                      <div className="flex space-x-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setManagingAttributesCategory(category)}
                          title="Gestisci attributi obbligatori"
                        >
                          <Settings2 className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleEdit(category)}
                          title="Modifica categoria"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleSoftDelete(category._id)}
                          title="Elimina categoria"
                          disabled={deletingCategoryId === category._id}
                        >
                          {deletingCategoryId === category._id ? (
                            <Loader2 className="h-4 w-4 text-red-500 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-500" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    {/* Department */}
                    {category.department && (
                      <div className="text-sm text-gray-600">
                        📁 Dipartimento: {category.department.name}
                      </div>
                    )}
                    
                    {/* Societies */}
                    {category.societyIds && category.societyIds.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">🏢 Società:</p>
                        <div className="flex flex-wrap gap-1">
                          {societies?.filter(s => category.societyIds.includes(s._id)).map((society) => (
                            <Badge key={society._id} variant="outline" size="sm" className="bg-blue-50">
                              {society.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Synonyms */}
                    {category.synonyms.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Sinonimi:</p>
                        <div className="flex flex-wrap gap-1">
                          {category.synonyms.slice(0, 4).map((synonym, index) => (
                            <Badge key={index} variant="secondary" size="sm">
                              {synonym}
                            </Badge>
                          ))}
                          {category.synonyms.length > 4 && (
                            <Badge variant="secondary" size="sm">
                              +{category.synonyms.length - 4}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Status and Info */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center space-x-2">
                        <Badge variant={category.isActive ? 'success' : 'secondary'}>
                          {category.isActive ? 'Attiva' : 'Inattiva'}
                        </Badge>
                        <Badge variant={category.visibility === 'public' ? 'default' : 'outline'}>
                          {category.visibility === 'public' ? 'Pubblica' : 'Privata'}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        Livello: {category.depth}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : activeTab === 'deleted' ? (
          /* Deleted Categories View (Cestino) */
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
                <div>
                  <h3 className="font-medium text-orange-800">Cestino Categorie</h3>
                  <p className="text-sm text-orange-700">
                    Le categorie eliminate possono essere ripristinate o eliminate definitivamente.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredDeletedCategories.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500">
                  {deletedCategories === undefined ? 'Caricamento cestino...' : 'Il cestino è vuoto.'}
                </div>
              ) : (
                filteredDeletedCategories.map((category) => (
                  <Card key={category._id} className="hover:shadow-lg transition-shadow border-red-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center">
                            <Archive className="h-4 w-4 mr-2 text-red-500" />
                            {category.name}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {category.description || 'Nessuna descrizione'}
                          </CardDescription>
                          <p className="text-xs text-red-600 mt-1">
                            Eliminata il: {new Date(category.deletedAt!).toLocaleDateString('it-IT')}
                          </p>
                        </div>
                        <div className="flex space-x-1">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRestore(category._id)}
                            title="Ripristina categoria"
                          >
                            <RotateCcw className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleHardDelete(category._id)}
                            title="Elimina definitivamente"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                      {/* Department */}
                      {category.department && (
                        <div className="text-sm text-gray-600">
                          📁 Dipartimento: {category.department.name}
                        </div>
                      )}
                      
                      {/* Synonyms */}
                      {category.synonyms.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-2">Sinonimi:</p>
                          <div className="flex flex-wrap gap-1">
                            {category.synonyms.slice(0, 4).map((synonym, index) => (
                              <Badge key={index} variant="secondary" size="sm">
                                {synonym}
                              </Badge>
                            ))}
                            {category.synonyms.length > 4 && (
                              <Badge variant="secondary" size="sm">
                                +{category.synonyms.length - 4}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Info */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <Badge variant="secondary">
                          {category.visibility === 'public' ? 'Era Pubblica' : 'Era Privata'}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          Livello: {category.depth}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ) : null}

        {/* Create/Edit Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>
                  {editingCategory ? 'Modifica Categoria' : 'Nuova Categoria'}
                </CardTitle>
                <CardDescription>
                  {editingCategory 
                    ? 'Modifica i dettagli della categoria esistente'
                    : 'Aggiungi una nuova categoria per classificare i ticket'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome categoria *
                    </label>
                    <Input 
                      placeholder="es. Manutenzioni, IT Support, HR..." 
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
                      placeholder="Descrizione dettagliata della categoria (opzionale)"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visibilità
                    </label>
                    <select 
                      className="w-full p-2 border rounded-md"
                      value={formData.visibility}
                      onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value as 'public' | 'private' }))}
                    >
                      <option value="public">Pubblica - Visibile a tutti gli utenti</option>
                      <option value="private">Privata - Solo per amministratori</option>
                    </select>
                  </div>
                  
                  {/* 🆕 Visibilità di default per i ticket */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="block text-sm font-medium text-blue-900 mb-2">
                      🔒 Visibilità di Default per i Ticket
                    </label>
                    <p className="text-xs text-blue-700 mb-3">
                      Quando un utente crea un ticket in questa categoria, questa sarà la visibilità iniziale (può comunque cambiarla)
                    </p>
                    <select 
                      className="w-full p-2 border border-blue-300 rounded-md bg-white"
                      value={formData.defaultTicketVisibility}
                      onChange={(e) => setFormData(prev => ({ ...prev, defaultTicketVisibility: e.target.value as 'public' | 'private' }))}
                    >
                      <option value="public">🌍 Pubblico - Visibile a tutti gli utenti della clinica</option>
                      <option value="private">🔒 Privato - Solo per chi l'ha creato e gli agenti assegnati</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sinonimi
                    </label>
                    <Input 
                      placeholder="es. manutenzione, riparazione, guasto (separati da virgola)"
                      value={formData.synonyms}
                      onChange={(e) => setFormData(prev => ({ ...prev, synonyms: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      I sinonimi aiutano nella ricerca automatica delle categorie
                    </p>
                  </div>

                  {/* 🆕 Selezione Società */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Società
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Seleziona le società per cui questa categoria è visibile. Se non selezioni nessuna, sarà visibile a tutte.
                    </p>
                    {societies && societies.length > 0 ? (
                      <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                        {societies.map((society) => (
                          <label key={society._id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={formData.societyIds.includes(society._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    societyIds: [...prev.societyIds, society._id] 
                                  }))
                                } else {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    societyIds: prev.societyIds.filter(id => id !== society._id) 
                                  }))
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{society.name}</span>
                            <Badge variant="outline" size="sm">{society.code}</Badge>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        Nessuna società disponibile. 
                        <a href="/admin/societies" className="text-blue-600 hover:underline ml-1">
                          Crea nuove società
                        </a>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => {
                        setShowCreateForm(false)
                        setEditingCategory(null)
                        setFormData({ name: '', description: '', visibility: 'public', defaultTicketVisibility: 'public', synonyms: '' })
                      }}
                    >
                      Annulla
                    </Button>
                    <Button type="submit">
                      {editingCategory ? 'Salva Modifiche' : 'Crea Categoria'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 🆕 MODAL GESTIONE ATTRIBUTI */}
        {managingAttributesCategory && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    ⚙️ Attributi di "{managingAttributesCategory.name}"
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Configura le informazioni obbligatorie e opzionali che Ermes AI chiederà quando suggerisce questa categoria
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setManagingAttributesCategory(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="p-6">
                {categoryAttributes === undefined ? (
                  <div className="text-center py-12 text-gray-500">
                    Caricamento attributi...
                  </div>
                ) : (
                  <AttributeBuilder
                    categoryId={managingAttributesCategory._id}
                    categoryName={managingAttributesCategory.name}
                    initialAttributes={categoryAttributes || []}
                    onSave={handleSaveAttributes}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
