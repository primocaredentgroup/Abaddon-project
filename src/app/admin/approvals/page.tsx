'use client'

import React, { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useAuth } from '@/hooks/useAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { 
  CheckSquare,
  AlertTriangle,
  Check,
  X,
  Clock,
  Zap,
  Command,
  Timer,
  User,
  Calendar
} from 'lucide-react'
import { toast } from 'sonner'

type TabType = 'triggers' | 'macros' | 'sla'

export default function ApprovalsPage() {
  const { user, isLoading: userLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('triggers')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [selectedType, setSelectedType] = useState<TabType>('triggers')
  
  // Estrai clinicId
  const clinicId = (user as any)?.clinicId || (user as any)?.clinic?._id
  
  // Queries
  const triggers = useQuery(
    api.triggers.getTriggersByClinic,
    clinicId ? { clinicId } : "skip"
  )
  const macros = useQuery(
    api.macros.getMacrosByClinic,
    clinicId ? { clinicId } : "skip"
  )
  const slaRules = useQuery(
    api.slaRules.getSLARulesByClinic,
    clinicId ? { clinicId } : "skip"
  )
  
  // Mutations
  // NOTA: Usando versioni Simple per sviluppo (senza controllo autenticazione)
  const approveTrigger = useMutation(api.triggers.approveTriggerSimple)
  const rejectTrigger = useMutation(api.triggers.rejectTriggerSimple)
  const approveMacro = useMutation(api.macros.approveMacro)
  const rejectMacro = useMutation(api.macros.rejectMacro)
  const approveSLARule = useMutation(api.slaRules.approveSLARule)
  const rejectSLARule = useMutation(api.slaRules.rejectSLARule)
  
  // Filtra solo gli elementi in attesa di approvazione
  const pendingTriggers = triggers?.filter(t => t.requiresApproval && !t.isApproved && !t.rejectedBy) || []
  const pendingMacros = macros?.filter(m => m.requiresApproval && !m.isApproved && !m.rejectedBy) || []
  const pendingSLAs = slaRules?.filter(s => s.requiresApproval && !s.isApproved && !s.rejectedBy) || []
  
  // Handlers
  const handleApprove = async (item: any, type: TabType) => {
    const userId = user?._id || (user as any)?.id
    if (!user?.email || !userId) {
      toast.error('Errore: utente non trovato')
      return
    }
    
    try {
      if (type === 'triggers') {
        await approveTrigger({ triggerId: item._id, userId })
        toast.success(`✅ Trigger "${item.name}" approvato!`, { duration: 4000 })
      } else if (type === 'macros') {
        await approveMacro({ macroId: item._id, approverEmail: user.email })
        toast.success(`✅ Macro "${item.name}" approvata!`, { duration: 4000 })
      } else if (type === 'sla') {
        await approveSLARule({ ruleId: item._id, approverEmail: user.email })
        toast.success(`✅ SLA Rule "${item.name}" approvata!`, { duration: 4000 })
      }
    } catch (error) {
      console.error('Errore approvazione:', error)
      toast.error('❌ Errore durante l\'approvazione')
    }
  }
  
  const handleReject = async () => {
    const userId = user?._id || (user as any)?.id
    if (!selectedItem || !user?.email || !userId) return
    
    try {
      if (selectedType === 'triggers') {
        await rejectTrigger({ 
          triggerId: selectedItem._id,
          userId,
          reason: rejectReason || undefined 
        })
      } else if (selectedType === 'macros') {
        await rejectMacro({ 
          macroId: selectedItem._id, 
          approverEmail: user.email,
          reason: rejectReason || undefined 
        })
      } else if (selectedType === 'sla') {
        await rejectSLARule({ 
          ruleId: selectedItem._id, 
          approverEmail: user.email,
          reason: rejectReason || undefined 
        })
      }
      
      const itemName = selectedType === 'triggers' ? 'Trigger' : selectedType === 'macros' ? 'Macro' : 'SLA Rule'
      toast.success(`❌ ${itemName} "${selectedItem.name}" rifiutato`, { duration: 4000 })
      setShowRejectModal(false)
      setRejectReason('')
      setSelectedItem(null)
    } catch (error) {
      console.error('Errore rifiuto:', error)
      toast.error('❌ Errore durante il rifiuto')
    }
  }
  
  const openRejectModal = (item: any, type: TabType) => {
    setSelectedItem(item)
    setSelectedType(type)
    setShowRejectModal(true)
  }
  
  // Controllo permessi
  if (userLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Clock className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
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
  
  if (user.role?.name !== 'Amministratore') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <CheckSquare className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
            <p className="text-gray-600">Solo gli amministratori possono gestire le approvazioni.</p>
            <p className="text-sm text-gray-500 mt-2">Il tuo ruolo: {user.role?.name}</p>
          </div>
        </div>
      </AppLayout>
    )
  }
  
  const totalPending = pendingTriggers.length + pendingMacros.length + pendingSLAs.length
  
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg">
                <CheckSquare className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Approvazioni</h1>
                <p className="text-gray-600">Gestisci le richieste di approvazione per Trigger, Macro e SLA</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Richieste in attesa</p>
            <p className="text-3xl font-bold text-orange-600">{totalPending}</p>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('triggers')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'triggers'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Zap className="h-5 w-5" />
              Trigger
              {pendingTriggers.length > 0 && (
                <Badge className="ml-2 bg-orange-100 text-orange-800">
                  {pendingTriggers.length}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab('macros')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'macros'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Command className="h-5 w-5" />
              Macro
              {pendingMacros.length > 0 && (
                <Badge className="ml-2 bg-orange-100 text-orange-800">
                  {pendingMacros.length}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab('sla')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'sla'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Timer className="h-5 w-5" />
              SLA Rules
              {pendingSLAs.length > 0 && (
                <Badge className="ml-2 bg-orange-100 text-orange-800">
                  {pendingSLAs.length}
                </Badge>
              )}
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="space-y-4">
          {/* Trigger Tab */}
          {activeTab === 'triggers' && (
            <div className="space-y-4">
              {pendingTriggers.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-gray-500">
                    <CheckSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>Nessun trigger in attesa di approvazione</p>
                  </CardContent>
                </Card>
              ) : (
                pendingTriggers.map((trigger) => (
                  <Card key={trigger._id} className="border-orange-200">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="h-5 w-5 text-orange-500" />
                            <CardTitle>{trigger.name}</CardTitle>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              In attesa
                            </Badge>
                          </div>
                          <CardDescription className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {trigger.creator?.name || 'Sconosciuto'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(trigger._creationTime).toLocaleDateString('it-IT')}
                            </span>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="font-medium text-blue-900 mb-1">Condizione (Quando)</p>
                          <Badge variant="outline" className="text-blue-700">
                            {trigger.conditions?.type || 'Non definito'}
                          </Badge>
                          {trigger.conditions?.value && (
                            <p className="text-xs text-blue-600 mt-1">= {trigger.conditions.value}</p>
                          )}
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="font-medium text-green-900 mb-1">Azione (Allora)</p>
                          <Badge variant="outline" className="text-green-700">
                            {trigger.actions?.type || 'Non definito'}
                          </Badge>
                          {trigger.actions?.value && (
                            <p className="text-xs text-green-600 mt-1">= {trigger.actions.value}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => openRejectModal(trigger, 'triggers')}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Rifiuta
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(trigger, 'triggers')}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approva
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
          
          {/* Macro Tab */}
          {activeTab === 'macros' && (
            <div className="space-y-4">
              {pendingMacros.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-gray-500">
                    <CheckSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>Nessuna macro in attesa di approvazione</p>
                  </CardContent>
                </Card>
              ) : (
                pendingMacros.map((macro) => (
                  <Card key={macro._id} className="border-orange-200">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Command className="h-5 w-5 text-orange-500" />
                            <CardTitle>{macro.name}</CardTitle>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              In attesa
                            </Badge>
                          </div>
                          <CardDescription className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {macro.creator?.name || 'Sconosciuto'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(macro._creationTime).toLocaleDateString('it-IT')}
                            </span>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {macro.description && (
                        <p className="text-sm text-gray-600">{macro.description}</p>
                      )}
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <p className="font-medium text-purple-900 mb-1">Categoria</p>
                        <Badge variant="outline" className="text-purple-700">
                          {macro.category}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => openRejectModal(macro, 'macros')}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Rifiuta
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(macro, 'macros')}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approva
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
          
          {/* SLA Tab */}
          {activeTab === 'sla' && (
            <div className="space-y-4">
              {pendingSLAs.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-gray-500">
                    <CheckSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>Nessuna SLA rule in attesa di approvazione</p>
                  </CardContent>
                </Card>
              ) : (
                pendingSLAs.map((sla) => (
                  <Card key={sla._id} className="border-orange-200">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Timer className="h-5 w-5 text-orange-500" />
                            <CardTitle>{sla.name}</CardTitle>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              In attesa
                            </Badge>
                          </div>
                          <CardDescription className="flex items-center gap-4 text-sm">
                            {sla.creator && (
                              <span className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                {sla.creator?.name || 'Sconosciuto'}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(sla._creationTime).toLocaleDateString('it-IT')}
                            </span>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <p className="font-medium text-yellow-900 mb-1">Tempo Target</p>
                        <p className="text-2xl font-bold text-yellow-700">{sla.targetHours} ore</p>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => openRejectModal(sla, 'sla')}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Rifiuta
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(sla, 'sla')}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approva
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
        
        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Rifiuta {selectedType === 'triggers' ? 'Trigger' : selectedType === 'macros' ? 'Macro' : 'SLA Rule'}</CardTitle>
                <CardDescription>
                  Sei sicuro di voler rifiutare "{selectedItem?.name}"?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo del rifiuto (opzionale)
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    rows={3}
                    placeholder="Es. Non sicuro, richiede modifiche, ecc..."
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectModal(false)
                      setRejectReason('')
                      setSelectedItem(null)
                    }}
                  >
                    Annulla
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleReject}
                  >
                    Conferma Rifiuto
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

