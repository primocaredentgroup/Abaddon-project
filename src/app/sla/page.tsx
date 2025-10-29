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
import { canEditSLA as checkCanEditSLA } from '@/lib/permissions'
import { 
  Clock,
  Plus,
  Search,
  Edit,
  Trash2,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  Timer,
  Settings,
  Target,
  FileText,
  Layers,
  Users,
  AlertCircle,
  TrendingUp,
  Hourglass
} from 'lucide-react'

interface SLARule {
  _id: string
  name: string
  description?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  responseTime: number // in hours
  resolutionTime: number // in hours
  businessHoursOnly: boolean
  categories: string[]
  isActive: boolean
  requiresApproval: boolean
  createdBy?: string
  createdAt?: string
}

export default function SLAMonitorPage() {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingRule, setEditingRule] = useState<SLARule | null>(null)
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 'all' as 'all' | 'low' | 'medium' | 'high' | 'urgent', // 🆕 Aggiunto 'all'
    responseTime: 24,
    resolutionTime: 72,
    businessHoursOnly: true,
    categories: [] as string[],
    isActive: true,
    requiresApproval: false
  })

  // 🔓 ADMIN VIEW: Mostra TUTTE le categorie (no filtro società)
  const categoriesFromDB = useQuery(
    api.categories.getCategoriesByClinic,
    { isActive: true } // NO userId → mostra TUTTO
  )
  
  // Mappa le categorie in un formato semplice per il form
  const availableCategories = categoriesFromDB?.map(cat => ({
    id: cat._id,
    name: cat.name,
    slug: cat.slug
  })) || []
  
  // ✅ QUERY REALE: Carica le SLA rules da Convex (globale, TUTTE le regole per admin)
  const slaRulesFromDB = useQuery(
    api.slaRules.getAllSLARules,
    {} // Nessun filtro → mostra TUTTE le regole (admin view)
  )
  
  // Mappa i dati dal database al formato del frontend
  const slaRules: SLARule[] = (slaRulesFromDB || []).map(rule => {
    // Estrai le conditions
    const conditions = rule.conditions as any
    
    return {
      _id: rule._id,
      name: rule.name,
      description: '', // Non c'è description nello schema attuale
      priority: conditions?.priority || 'all', // 🆕 Estrai priority dalle conditions (default: 'all')
      responseTime: rule.targetHours || 24,
      resolutionTime: rule.targetHours || 72,
      businessHoursOnly: conditions?.businessHoursOnly ?? true, // 🆕 Estrai da conditions
      categories: conditions?.categories || [], // 🆕 Estrai categorie dalle conditions
      isActive: rule.isActive,
      requiresApproval: rule.requiresApproval || false,
      createdBy: rule.creator?.name || 'Sistema',
      createdAt: rule._creationTime ? new Date(rule._creationTime).toLocaleDateString() : ''
    }
  })
  
  // Stats
  const slaStats = {
    total: slaRules.length,
    active: slaRules.filter(rule => rule.isActive).length,
    inactive: slaRules.filter(rule => !rule.isActive).length,
    urgent: slaRules.filter(rule => rule.priority === 'urgent').length
  }

  // ✅ MUTATIONS REALI: Usa Convex per salvare i dati
  const createSLARuleMutation = useMutation(api.slaRules.createSLARule)
  const updateSLARuleMutation = useMutation(api.slaRules.updateSLARule)
  const deleteSLARuleMutation = useMutation(api.slaRules.deleteSLARule)

  // Filter SLA rules based on search
  const filteredRules = slaRules.filter(rule =>
    rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !user?.email) {
      alert('Errore: Nome regola SLA mancante o utente non autenticato')
      return
    }

    try {
      // Costruisci l'oggetto conditions con i dati del form
      // 🆕 Se priority è 'all', non includiamo il campo priority (= si applica a tutte)
      const conditions: any = {
        categories: formData.categories,
        businessHoursOnly: formData.businessHoursOnly
      }
      
      // Aggiungi priority solo se non è 'all'
      if (formData.priority !== 'all') {
        conditions.priority = formData.priority
      }

      if (editingRule) {
        // Update existing rule
        await updateSLARuleMutation({
          ruleId: editingRule._id as any,
          name: formData.name,
          conditions: conditions,
          targetHours: formData.resolutionTime, // Usa resolutionTime come targetHours
          isActive: formData.isActive
        })
        alert('Regola SLA aggiornata con successo!')
      } else {
        // Create new rule
        // 🆕 Il backend calcolerà automaticamente societyIds dalle categorie
        await createSLARuleMutation({
          name: formData.name,
          conditions: conditions,
          targetHours: formData.resolutionTime, // Usa resolutionTime come targetHours
          requiresApproval: formData.requiresApproval,
          creatorEmail: user.email,
          // societyIds verrà calcolato dal backend dalle categorie selezionate
        })
        alert('Regola SLA creata con successo!')
      }
      
      // Reset form
      setFormData({ 
        name: '', 
        description: '', 
        priority: 'all', // 🆕 Default a 'all' (tutti i ticket)
        responseTime: 24,
        resolutionTime: 72,
        businessHoursOnly: true,
        categories: [],
        isActive: true,
        requiresApproval: false
      })
      setShowCreateForm(false)
      setEditingRule(null)
    } catch (error) {
      console.error('Errore nel salvare la regola SLA:', error)
      alert('Errore nel salvare la regola SLA: ' + (error as any).message || error)
    }
  }

  // Handle edit
  const handleEdit = (rule: SLARule) => {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      description: rule.description || '',
      priority: rule.priority,
      responseTime: rule.responseTime,
      resolutionTime: rule.resolutionTime,
      businessHoursOnly: rule.businessHoursOnly,
      categories: rule.categories,
      isActive: rule.isActive,
      requiresApproval: rule.requiresApproval
    })
    setShowCreateForm(true)
  }

  // Handle delete
  const handleDelete = async (ruleId: string) => {
    if (confirm('Sei sicuro di voler eliminare questa regola SLA?')) {
      try {
        await deleteSLARuleMutation({ ruleId: ruleId as any })
        alert('Regola SLA eliminata con successo!')
      } catch (error) {
        console.error('Errore nell\'eliminare la regola SLA:', error)
        alert('Errore nell\'eliminare la regola SLA: ' + (error as any).message || error)
      }
    }
  }

  // Handle toggle active
  const handleToggleActive = async (rule: SLARule) => {
    try {
      await updateSLARuleMutation({
        ruleId: rule._id as any,
        isActive: !rule.isActive
      })
    } catch (error) {
      console.error('Errore nel cambiare lo stato della regola SLA:', error)
      alert('Errore nel cambiare lo stato della regola SLA: ' + (error as any).message || error)
    }
  }

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'all': return 'text-blue-600 bg-blue-50 border-blue-200' // 🆕 Colore per "Tutti i ticket"
      case 'urgent': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-blue-600 bg-blue-50 border-blue-200' // Default = tutti i ticket
    }
  }

  // Format time
  const formatTime = (hours: number) => {
    if (hours < 24) {
      return `${hours}h`
    } else {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return remainingHours > 0 ? `${days}g ${remainingHours}h` : `${days}g`
    }
  }

  if (!user) {
    return <div>Caricamento...</div>
  }

  // Controllo permessi: la pagina è visibile a tutti gli utenti autenticati
  // Basato sui permessi del ruolo invece che sul nome
  const canEdit = checkCanEditSLA(user.role)

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Clock className="h-8 w-8 mr-3 text-blue-600" />
              SLA Monitor
            </h1>
            <p className="text-gray-600 mt-2">
              Gestisci le regole Service Level Agreement per i ticket di supporto
            </p>
          </div>
          
          {canEdit && (
            <div className="flex gap-3">
              <Button 
                onClick={() => {
                  setEditingRule(null)
                  setFormData({ 
                    name: '', 
                    description: '', 
                    priority: 'all', // 🆕 Default a 'all'
                    responseTime: 24,
                    resolutionTime: 72,
                    businessHoursOnly: true,
                    categories: [],
                    isActive: true,
                    requiresApproval: false
                  })
                  setShowCreateForm(true)
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuova Regola SLA
              </Button>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Regole Totali</p>
                  <p className="text-2xl font-bold text-gray-900">{slaStats.total}</p>
                </div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Regole Attive</p>
                  <p className="text-2xl font-bold text-gray-900">{slaStats.active}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Regole Inattive</p>
                  <p className="text-2xl font-bold text-gray-900">{slaStats.inactive}</p>
                </div>
                <Pause className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Regole Urgenti</p>
                  <p className="text-2xl font-bold text-gray-900">{slaStats.urgent}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
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
                placeholder="Cerca regole SLA..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* SLA Rules List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredRules.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              Nessuna regola SLA trovata.
            </div>
          ) : (
            filteredRules.map((rule) => (
              <Card key={rule._id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center">
                        <Clock className={`h-4 w-4 mr-2 ${rule.isActive ? 'text-green-500' : 'text-gray-400'}`} />
                        {rule.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {rule.description || 'Nessuna descrizione'}
                      </CardDescription>
                    </div>
                    {canEdit && (
                      <div className="flex space-x-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleToggleActive(rule)}
                          title={rule.isActive ? 'Disattiva' : 'Attiva'}
                        >
                          {rule.isActive ? 
                            <Pause className="h-4 w-4 text-orange-500" /> : 
                            <Play className="h-4 w-4 text-green-500" />
                          }
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleEdit(rule)}
                          title="Modifica regola"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDelete(rule._id)}
                          title="Elimina regola"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Priority and Times */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Priorità:</span>
                      <Badge className={getPriorityColor(rule.priority)}>
                        {rule.priority === 'all' ? '🌐 Tutti i ticket' :
                         rule.priority === 'urgent' ? '🔴 Urgente' :
                         rule.priority === 'high' ? '🟠 Alta' :
                         rule.priority === 'medium' ? '🟡 Media' :
                         rule.priority === 'low' ? '🟢 Bassa' : '🌐 Tutti i ticket'}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Timer className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Risposta:</span>
                      <Badge variant="default">
                        {formatTime(rule.responseTime)}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Hourglass className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">Risoluzione:</span>
                      <Badge variant="default">
                        {formatTime(rule.resolutionTime)}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Business Hours and Categories */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Settings className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">Orario:</span>
                      <Badge variant="default">
                        {rule.businessHoursOnly ? 'Solo ore lavorative' : '24/7'}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <FileText className="h-4 w-4 text-indigo-500" />
                      <span className="font-medium">Categorie:</span>
                      <Badge variant="default">
                        {rule.categories.length > 0 
                          ? rule.categories.map(catId => {
                              // Trova il nome della categoria dall'ID
                              const category = availableCategories.find(c => c.id === catId)
                              return category?.name || catId
                            }).join(', ')
                          : 'Tutte'}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Status and Info */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center space-x-2">
                      <Badge variant={rule.isActive ? 'success' : 'default'}>
                        {rule.isActive ? 'Attiva' : 'Inattiva'}
                      </Badge>
                      {rule.requiresApproval && (
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
        {showCreateForm && canEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>
                  {editingRule ? 'Modifica Regola SLA' : 'Nuova Regola SLA'}
                </CardTitle>
                <CardDescription>
                  {editingRule 
                    ? 'Modifica le impostazioni della regola SLA esistente'
                    : 'Crea una nuova regola Service Level Agreement'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Regola *
                    </label>
                    <Input 
                      placeholder="es. SLA Standard per Software" 
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
                      placeholder="Descrivi a cosa si applica questa regola SLA..." 
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priorità Ticket
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                    >
                      <option value="all">🌐 Tutti i ticket (qualsiasi priorità)</option>
                      <option value="low">🟢 Bassa</option>
                      <option value="medium">🟡 Media</option>
                      <option value="high">🟠 Alta</option>
                      <option value="urgent">🔴 Urgente</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.priority === 'all' 
                        ? 'La regola si applicherà a ticket di qualsiasi priorità' 
                        : `La regola si applicherà solo ai ticket con priorità ${
                            formData.priority === 'low' ? 'Bassa' :
                            formData.priority === 'medium' ? 'Media' :
                            formData.priority === 'high' ? 'Alta' : 'Urgente'
                          }`
                      }
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tempo di Risposta (ore)
                      </label>
                      <Input 
                        type="number"
                        placeholder="24" 
                        value={formData.responseTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, responseTime: parseInt(e.target.value) || 0 }))}
                        min="1"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tempo di Risoluzione (ore)
                      </label>
                      <Input 
                        type="number"
                        placeholder="72" 
                        value={formData.resolutionTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, resolutionTime: parseInt(e.target.value) || 0 }))}
                        min="1"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Categorie Applicabili
                    </label>
                    {!categoriesFromDB ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-sm text-gray-600">Caricamento categorie...</span>
                      </div>
                    ) : availableCategories.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500">Nessuna categoria disponibile.</p>
                        <p className="text-xs text-gray-400 mt-1">La regola si applicherà a tutte le categorie.</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {availableCategories.map((category) => (
                            <div key={category.id} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`category-${category.id}`}
                                checked={formData.categories.includes(category.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData(prev => ({
                                      ...prev,
                                      categories: [...prev.categories, category.id]
                                    }))
                                  } else {
                                    setFormData(prev => ({
                                      ...prev,
                                      categories: prev.categories.filter(c => c !== category.id)
                                    }))
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <label htmlFor={`category-${category.id}`} className="ml-2 text-sm text-gray-700">
                                {category.name}
                              </label>
                            </div>
                          ))}
                        </div>
                        {formData.categories.length === 0 && (
                          <p className="text-sm text-gray-500 mt-2">
                            Nessuna categoria selezionata. La regola si applicherà a tutte le categorie.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="businessHoursOnly"
                        checked={formData.businessHoursOnly}
                        onChange={(e) => setFormData(prev => ({ ...prev, businessHoursOnly: e.target.checked }))}
                        className="rounded"
                      />
                      <label htmlFor="businessHoursOnly" className="text-sm text-gray-700">
                        Solo ore lavorative
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                        className="rounded"
                      />
                      <label htmlFor="isActive" className="text-sm text-gray-700">
                        Regola attiva
                      </label>
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
                      Richiede approvazione per l'esecuzione
                    </label>
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => {
                        setShowCreateForm(false)
                        setEditingRule(null)
                        setFormData({ 
                          name: '', 
                          description: '', 
                          priority: 'all', // 🆕 Default a 'all'
                          responseTime: 24,
                          resolutionTime: 72,
                          businessHoursOnly: true,
                          categories: [],
                          isActive: true,
                          requiresApproval: false
                        })
                      }}
                    >
                      Annulla
                    </Button>
                    <Button type="submit">
                      {editingRule ? 'Salva Modifiche' : 'Crea Regola'}
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
