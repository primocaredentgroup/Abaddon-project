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
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { 
  Settings, 
  Bot, 
  Search, 
  Lightbulb, 
  Plus, 
  Users, 
  Building2,
  AlertTriangle,
  CheckCircle,
  Save,
  RefreshCw 
} from 'lucide-react'
import { toast } from 'sonner'

export default function AgentConfigPage() {
  const { user, isLoading: userLoading } = useAuth()
  const [isUpdating, setIsUpdating] = useState(false)

  // State per le configurazioni
  const [config, setConfig] = useState({
    canSearchTickets: true,
    canSuggestCategories: true,
    canCreateTickets: true,
    canAccessUserData: false,
    canAccessClinicsData: false,
    temperature: 0.8,
    maxTokens: 2048,
    systemPrompt: `Sei un assistente intelligente per un sistema di gestione ticket healthcare.
Puoi aiutare gli utenti a:
- Cercare ticket per ID, titolo o descrizione
- Suggerire la categoria più appropriata per un nuovo ticket
- Creare ticket nella categoria suggerita
- Navigare nell'applicazione

Rispondi sempre in italiano e sii professionale ma amichevole.`
  })

  // Estrai clinicId in modo sicuro (potrebbe essere user.clinicId o user.clinic._id)
  const clinicId = (user as any)?.clinicId || (user as any)?.clinic?._id
  
  // Query per ottenere la configurazione corrente
  const agentConfig = useQuery(
    "agent:getAgentConfig",
    clinicId ? { clinicId } : "skip"
  )

  // Mutation per aggiornare la configurazione
  // NOTA: Usando versione Simple per sviluppo (senza controllo autenticazione)
  const updateConfig = useMutation(api.agent.updateAgentConfig)
  const initializeConfig = useMutation(api.agent.initializeAgentConfig)

  // Carica la configurazione esistente quando disponibile
  React.useEffect(() => {
    if (agentConfig?.settings) {
      setConfig(agentConfig.settings)
    }
  }, [agentConfig])

  const handleSave = async () => {
    // Prova sia _id che id per compatibilità
    const userId = user?._id || (user as any)?.id
    
    if (!clinicId || !userId) {
      toast.error('❌ Clinica o utente non trovato')
      return
    }

    setIsUpdating(true)
    try {
      await updateConfig({
        clinicId: clinicId,
        userId: userId,
        settings: config,
      })
      toast.success('✅ Configurazione Ermes AI salvata con successo!', {
        duration: 4000,
      })
    } catch (error) {
      console.error('Errore salvataggio configurazione:', error)
      toast.error('❌ Errore durante il salvataggio della configurazione')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleInitialize = async () => {
    if (!clinicId) return

    setIsUpdating(true)
    try {
      await initializeConfig({ clinicId: clinicId })
      toast.success('Agent inizializzato!')
    } catch (error) {
      console.error('Errore inizializzazione:', error)
      toast.error('Errore durante l\'inizializzazione')
    } finally {
      setIsUpdating(false)
    }
  }

  const resetToDefaults = () => {
    setConfig({
      canSearchTickets: true,
      canSuggestCategories: true,
      canCreateTickets: true,
      canAccessUserData: false,
      canAccessClinicsData: false,
      temperature: 0.8,
      maxTokens: 2048,
      systemPrompt: `Sei un assistente intelligente per un sistema di gestione ticket healthcare.
Puoi aiutare gli utenti a:
- Cercare ticket per ID, titolo o descrizione
- Suggerire la categoria più appropriata per un nuovo ticket
- Creare ticket nella categoria suggerita
- Navigare nell'applicazione

Rispondi sempre in italiano e sii professionale ma amichevole.`
    })
    toast.info('Configurazione ripristinata ai valori predefiniti')
  }

  if (userLoading) {
    return (
      <AppLayout>
        <LoadingState message="Caricamento utente..." />
      </AppLayout>
    )
  }

  if (!user) {
    return (
      <AppLayout>
        <ErrorState 
          title="Accesso Negato"
          message="Devi essere autenticato per accedere a questa pagina."
        />
      </AppLayout>
    )
  }

  // Controlla i permessi di amministratore
  if (!hasFullAccess(user.role)) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
            <p className="text-gray-600">Solo gli amministratori possono configurare l'Agent AI.</p>
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
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                Configurazione Ermes AI
              </h2>
            </div>
            <p className="text-gray-600">
              Configura le funzionalità e i permessi dell'assistente intelligente per la tua clinica
            </p>
          </div>

          <div className="mt-4 flex md:ml-4 md:mt-0 gap-2">
            <Button
              onClick={resetToDefaults}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Reset
            </Button>
            {!agentConfig && (
              <Button
                onClick={handleInitialize}
                disabled={isUpdating}
                className="flex items-center gap-2"
              >
                <Plus size={16} />
                Inizializza
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isUpdating}
              className="flex items-center gap-2"
            >
              <Save size={16} />
              {isUpdating ? 'Salvataggio...' : 'Salva'}
            </Button>
          </div>
        </div>

        {/* Status Agent */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="h-8 w-8 text-gray-400" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Stato Ermes</h3>
                <p className="text-sm text-gray-600">
                  Stato attuale dell'assistente Ermes AI per la clinica
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {agentConfig?.isEnabled ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <Badge variant="success">Attivo</Badge>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <Badge variant="destructive">Inattivo</Badge>
                </>
              )}
            </div>
          </div>
          
          {agentConfig && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-600">Ultima Modifica</p>
                <p className="font-semibold">
                  {agentConfig.lastUpdatedBy ? 'Configurato' : 'Mai configurato'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Funzioni Attive</p>
                <p className="font-semibold">
                  {Object.values(config).filter(v => v === true).length}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Temperatura AI</p>
                <p className="font-semibold">{config.temperature}</p>
              </div>
            </div>
          )}
        </Card>

        {/* Configurazione Funzionalità */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Funzionalità Ermes
          </h3>
          
          <div className="space-y-4">
            {/* Ricerca Ticket */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-blue-500" />
                <div>
                  <h4 className="font-medium text-gray-900">Ricerca Ticket</h4>
                  <p className="text-sm text-gray-600">
                    Permetti a Ermes di cercare ticket per ID, titolo e descrizione
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.canSearchTickets}
                  onChange={(e) => setConfig(prev => ({ ...prev, canSearchTickets: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Suggerimenti Categorie */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <div>
                  <h4 className="font-medium text-gray-900">Suggerimenti Categorie</h4>
                  <p className="text-sm text-gray-600">
                    Abilita Ermes a suggerire categorie basate su AI
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.canSuggestCategories}
                  onChange={(e) => setConfig(prev => ({ ...prev, canSuggestCategories: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Creazione Ticket */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Plus className="h-5 w-5 text-green-500" />
                <div>
                  <h4 className="font-medium text-gray-900">Creazione Ticket</h4>
                  <p className="text-sm text-gray-600">
                    Permetti a Ermes di creare ticket automaticamente
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.canCreateTickets}
                  onChange={(e) => setConfig(prev => ({ ...prev, canCreateTickets: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Accesso Dati Utenti */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-purple-500" />
                <div>
                  <h4 className="font-medium text-gray-900">Accesso Dati Utenti</h4>
                  <p className="text-sm text-gray-600">
                    Abilita Ermes ad accedere a informazioni degli utenti
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.canAccessUserData}
                  onChange={(e) => setConfig(prev => ({ ...prev, canAccessUserData: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Accesso Dati Cliniche */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-orange-500" />
                <div>
                  <h4 className="font-medium text-gray-900">Accesso Dati Cliniche</h4>
                  <p className="text-sm text-gray-600">
                    Abilita Ermes ad accedere a dati di più cliniche
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.canAccessClinicsData}
                  onChange={(e) => setConfig(prev => ({ ...prev, canAccessClinicsData: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* Configurazione AI */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Parametri AI
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature (0-1)
              </label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  temperature: parseFloat(e.target.value) || 0 
                }))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Creatività delle risposte (0 = conservativo, 1 = creativo)
              </p>
            </div>

            {/* Max Tokens */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Tokens
              </label>
              <Input
                type="number"
                min="100"
                max="4000"
                value={config.maxTokens}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  maxTokens: parseInt(e.target.value) || 2048 
                }))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lunghezza massima delle risposte
              </p>
            </div>
          </div>
        </Card>

        {/* System Prompt */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Prompt di Sistema
          </h3>
          <Textarea
            value={config.systemPrompt}
            onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
            rows={8}
            className="w-full"
            placeholder="Inserisci le istruzioni per l'agent..."
          />
          <p className="text-sm text-gray-500 mt-2">
            Definisce il comportamento e la personalità di Ermes AI. Sii specifico sui compiti e il tono da utilizzare.
          </p>
        </Card>
      </div>
    </AppLayout>
  )
}
