'use client'

import React, { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useAuth } from '@/hooks/useAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { hasFullAccess } from '@/lib/permissions'
import { 
  Shield,
  Users,
  Bot,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Settings,
  TrendingUp,
  Activity,
  UserPlus,
  Eye,
  Check,
  X,
  Building2
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function AdminDashboard() {
  const { user, isLoading: userLoading } = useAuth()
  
  // Estrai clinicId in modo sicuro
  const clinicId = (user as any)?.clinicId || (user as any)?.clinic?._id
  
  // Queries per le statistiche
  const allUsers = useQuery(api.users.getAllUsers, {})
  const allRoles = useQuery(api.roles.getAllRoles, { includeSystem: true })
  const triggers = useQuery(
    api.triggers.getTriggersByClinic,
    clinicId ? { clinicId } : "skip"
  )
  const agentConfig = useQuery(
    api.agent.getAgentConfig,
    clinicId ? { clinicId } : "skip"
  )
  
  // Query per trigger in attesa di approvazione
  const pendingTriggers = triggers?.filter(t => t.requiresApproval && !t.isApproved) || []
  
  // Mutations per approvare/rifiutare trigger
  const approveTrigger = useMutation(api.triggers.approveTrigger)
  const rejectTrigger = useMutation(api.triggers.rejectTrigger)
  
  // Statistiche calcolate
  const stats = {
    totalUsers: allUsers?.length || 0,
    activeUsers: allUsers?.filter(u => u.isActive).length || 0,
    totalRoles: allRoles?.length || 0,
    totalTriggers: triggers?.length || 0,
    activeTriggers: triggers?.filter(t => t.isActive).length || 0,
    pendingApprovals: pendingTriggers.length,
    agentEnabled: agentConfig?.isEnabled || false
  }
  
  // Handler per approvare trigger
  const handleApproveTrigger = async (triggerId: string) => {
    try {
      await approveTrigger({ triggerId })
      toast.success('Trigger approvato con successo!')
    } catch (error) {
      console.error('Errore approvazione trigger:', error)
      toast.error('Errore durante l\'approvazione del trigger')
    }
  }
  
  // Handler per rifiutare trigger
  const handleRejectTrigger = async (triggerId: string, reason?: string) => {
    try {
      await rejectTrigger({ 
        triggerId, 
        reason: reason || 'Trigger rifiutato dall\'amministratore' 
      })
      toast.success('Trigger rifiutato')
    } catch (error) {
      console.error('Errore rifiuto trigger:', error)
      toast.error('Errore durante il rifiuto del trigger')
    }
  }
  
  // Controllo permessi
  if (userLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Activity className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
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
            <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
            <p className="text-gray-600">Solo gli amministratori possono accedere a questa sezione.</p>
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
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard Amministratore</h1>
                <p className="text-gray-600">Centro di controllo del sistema</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Benvenuto,</p>
            <p className="text-lg font-semibold text-gray-900">{user.name}</p>
          </div>
        </div>
        
        {/* Statistiche Principali */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Utenti */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Utenti Totali</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {stats.activeUsers} attivi
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Ruoli */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Ruoli</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalRoles}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Ruoli configurati
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Shield className="h-8 w-8 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Trigger */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Trigger</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalTriggers}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {stats.activeTriggers} attivi
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Zap className="h-8 w-8 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Agente AI */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Ermes AI</p>
                  <div className="flex items-center gap-2">
                    {stats.agentEnabled ? (
                      <>
                        <CheckCircle className="h-6 w-6 text-green-500" />
                        <p className="text-2xl font-bold text-green-600">Attivo</p>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-6 w-6 text-red-500" />
                        <p className="text-2xl font-bold text-red-600">Inattivo</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-3 bg-pink-100 rounded-lg">
                  <Bot className="h-8 w-8 text-pink-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Trigger in attesa di approvazione */}
        {pendingTriggers.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <CardTitle className="text-orange-900">
                    Trigger in Attesa di Approvazione
                  </CardTitle>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  {pendingTriggers.length} in attesa
                </Badge>
              </div>
              <CardDescription className="text-orange-700">
                I seguenti trigger richiedono la tua approvazione prima di essere attivati
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingTriggers.map((trigger) => (
                  <div 
                    key={trigger._id}
                    className="bg-white p-4 rounded-lg border border-orange-200 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-orange-500" />
                        <h4 className="font-semibold text-gray-900">{trigger.name}</h4>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <span className="font-medium">Quando:</span>{' '}
                          <Badge variant="outline" className="ml-1">
                            {trigger.conditions?.type || 'Non definito'}
                          </Badge>
                          {trigger.conditions?.value && (
                            <span className="ml-1">= {trigger.conditions.value}</span>
                          )}
                        </p>
                        <p>
                          <span className="font-medium">Allora:</span>{' '}
                          <Badge variant="outline" className="ml-1">
                            {trigger.actions?.type || 'Non definito'}
                          </Badge>
                          {trigger.actions?.value && (
                            <span className="ml-1">= {trigger.actions.value}</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          Creato da: {trigger.creator?.name || 'Sconosciuto'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-600 hover:bg-green-50"
                        onClick={() => handleApproveTrigger(trigger._id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approva
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-600 hover:bg-red-50"
                        onClick={() => handleRejectTrigger(trigger._id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Rifiuta
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Sezioni Principali */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gestione Utenti */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <CardTitle>Gestione Utenti</CardTitle>
              </div>
              <CardDescription>
                Gestisci gli utenti del sistema, i loro ruoli e permessi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Utenti Totali</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.totalUsers}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-300" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-green-50 rounded text-center">
                    <p className="text-xs text-gray-600">Attivi</p>
                    <p className="text-lg font-bold text-green-600">{stats.activeUsers}</p>
                  </div>
                  <div className="p-2 bg-gray-100 rounded text-center">
                    <p className="text-xs text-gray-600">Inattivi</p>
                    <p className="text-lg font-bold text-gray-600">
                      {stats.totalUsers - stats.activeUsers}
                    </p>
                  </div>
                </div>
                <Link href="/users" className="block">
                  <Button className="w-full" variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizza Tutti gli Utenti
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
          
          {/* Gestione Ruoli e Permessi */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-600" />
                <CardTitle>Ruoli e Permessi</CardTitle>
              </div>
              <CardDescription>
                Configura i ruoli e i permessi del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Ruoli Configurati</p>
                    <p className="text-2xl font-bold text-purple-600">{stats.totalRoles}</p>
                  </div>
                  <Shield className="h-8 w-8 text-purple-300" />
                </div>
                <div className="space-y-2">
                  {allRoles?.slice(0, 3).map((role) => (
                    <div 
                      key={role._id} 
                      className="flex items-center justify-between p-2 bg-purple-50 rounded"
                    >
                      <span className="text-sm font-medium text-gray-900">{role.name}</span>
                      {role.isSystem && (
                        <Badge variant="secondary" className="text-xs">Sistema</Badge>
                      )}
                    </div>
                  ))}
                </div>
                <Link href="/roles" className="block">
                  <Button className="w-full" variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizza Tutti i Ruoli
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
          
          {/* Configurazione Agente AI */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-pink-600" />
                <CardTitle>Ermes AI</CardTitle>
              </div>
              <CardDescription>
                Configura l'assistente intelligente AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Stato Agente</p>
                    <div className="flex items-center gap-2 mt-1">
                      {stats.agentEnabled ? (
                        <>
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                          <p className="text-lg font-bold text-green-600">Operativo</p>
                        </>
                      ) : (
                        <>
                          <div className="h-2 w-2 bg-red-500 rounded-full" />
                          <p className="text-lg font-bold text-red-600">Disattivato</p>
                        </>
                      )}
                    </div>
                  </div>
                  <Bot className="h-8 w-8 text-pink-300" />
                </div>
                {agentConfig && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-pink-50 rounded">
                      <span className="text-gray-600">Ricerca Ticket</span>
                      <span className="font-medium">
                        {agentConfig.settings?.canSearchTickets ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-pink-50 rounded">
                      <span className="text-gray-600">Suggerimenti AI</span>
                      <span className="font-medium">
                        {agentConfig.settings?.canSuggestCategories ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                )}
                <Link href="/admin/agent-config" className="block">
                  <Button className="w-full" variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Configura Ermes AI
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
          
          {/* Gestione Trigger */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                <CardTitle>Automazioni e Trigger</CardTitle>
              </div>
              <CardDescription>
                Gestisci i trigger automatici del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Trigger Totali</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.totalTriggers}</p>
                  </div>
                  <Zap className="h-8 w-8 text-yellow-300" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-green-50 rounded text-center">
                    <p className="text-xs text-gray-600">Attivi</p>
                    <p className="text-lg font-bold text-green-600">{stats.activeTriggers}</p>
                  </div>
                  <div className="p-2 bg-gray-100 rounded text-center">
                    <p className="text-xs text-gray-600">Inattivi</p>
                    <p className="text-lg font-bold text-gray-600">
                      {stats.totalTriggers - stats.activeTriggers}
                    </p>
                  </div>
                  <div className="p-2 bg-orange-50 rounded text-center">
                    <p className="text-xs text-gray-600">In attesa</p>
                    <p className="text-lg font-bold text-orange-600">{stats.pendingApprovals}</p>
                  </div>
                </div>
                <Link href="/automation/triggers" className="block">
                  <Button className="w-full" variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizza Tutti i Trigger
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Azioni Rapide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Azioni Rapide
            </CardTitle>
            <CardDescription>
              Accesso rapido alle funzionalità amministrative
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link href="/users">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2">
                  <UserPlus className="h-6 w-6" />
                  <span className="text-sm">Nuovo Utente</span>
                </Button>
              </Link>
              <Link href="/roles">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2">
                  <Shield className="h-6 w-6" />
                  <span className="text-sm">Gestisci Ruoli</span>
                </Button>
              </Link>
              <Link href="/admin/agent-config">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2">
                  <Bot className="h-6 w-6" />
                  <span className="text-sm">Config. Ermes</span>
                </Button>
              </Link>
              <Link href="/automation/triggers">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2">
                  <Zap className="h-6 w-6" />
                  <span className="text-sm">Gestisci Trigger</span>
                </Button>
              </Link>
              <Link href="/admin/domain-societies">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2">
                  <Building2 className="h-6 w-6" />
                  <span className="text-sm">Domini Società</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

