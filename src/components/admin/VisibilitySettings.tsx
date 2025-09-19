'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'

interface VisibilitySettingsProps {
  clinicId?: string
  className?: string
}

export const VisibilitySettings: React.FC<VisibilitySettingsProps> = ({
  clinicId,
  className = '',
}) => {
  const [isChanging, setIsChanging] = useState(false)
  const [error, setError] = useState('')
  const [confirmAction, setConfirmAction] = useState<{
    action: 'enable' | 'disable'
    message: string
  } | null>(null)

  // Queries
  const visibilitySettings = useQuery(
    api.clinics?.getVisibilitySettings,
    clinicId ? { clinicId: clinicId as any } : {}
  )

  // Mutations
  const togglePublicTickets = useMutation(api.clinics?.togglePublicTickets)
  const updateSettings = useMutation(api.clinics?.updateVisibilitySettings)

  if (!visibilitySettings) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </Card>
    )
  }

  const handleTogglePublicTickets = (enabled: boolean) => {
    if (!enabled && visibilitySettings.allowPublicTickets) {
      // Disabling public tickets
      setConfirmAction({
        action: 'disable',
        message: 'Disabilitando i ticket pubblici, tutti i ticket attualmente pubblici diventeranno privati. Questa azione non può essere annullata.',
      })
    } else if (enabled && !visibilitySettings.allowPublicTickets) {
      // Enabling public tickets
      setConfirmAction({
        action: 'enable',
        message: 'Abilitando i ticket pubblici, gli utenti potranno creare ticket visibili a tutti nella clinica.',
      })
    }
  }

  const confirmToggle = async () => {
    if (!confirmAction) return

    setIsChanging(true)
    setError('')

    try {
      await togglePublicTickets({
        clinicId: clinicId as any,
        enabled: confirmAction.action === 'enable',
      })
      setConfirmAction(null)
    } catch (error) {
      console.error('Error toggling public tickets:', error)
      setError('Errore durante il cambio impostazioni')
    } finally {
      setIsChanging(false)
    }
  }

  const cancelToggle = () => {
    setConfirmAction(null)
    setError('')
  }

  const handleSettingsChange = async (newSettings: Partial<typeof visibilitySettings>) => {
    setIsChanging(true)
    setError('')

    try {
      await updateSettings({
        clinicId: clinicId as any,
        ...newSettings,
      })
    } catch (error) {
      console.error('Error updating settings:', error)
      setError('Errore durante l\'aggiornamento delle impostazioni')
    } finally {
      setIsChanging(false)
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Public Tickets Setting */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Ticket Pubblici
            </h3>
            <p className="text-sm text-gray-600">
              Controlla se gli utenti possono creare ticket visibili a tutti nella clinica
            </p>
          </div>
          <Badge
            color={visibilitySettings.allowPublicTickets ? 'green' : 'red'}
            className="ml-4"
          >
            {visibilitySettings.allowPublicTickets ? 'Abilitati' : 'Disabilitati'}
          </Badge>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Stato Attuale: {visibilitySettings.allowPublicTickets ? 'Abilitati' : 'Disabilitati'}
            </h4>
            <div className="text-sm text-gray-600">
              {visibilitySettings.allowPublicTickets ? (
                <>
                  Gli utenti possono scegliere di rendere i loro ticket pubblici.
                  I ticket pubblici sono visibili a tutti gli utenti della clinica.
                </>
              ) : (
                <>
                  Tutti i ticket sono privati per default.
                  Solo il creatore, l'assegnatario e gli amministratori possono vedere i ticket.
                </>
              )}
            </div>
          </div>

          {!confirmAction ? (
            <div className="flex space-x-3">
              <Button
                onClick={() => handleTogglePublicTickets(!visibilitySettings.allowPublicTickets)}
                disabled={isChanging}
                variant={visibilitySettings.allowPublicTickets ? 'outline' : 'default'}
              >
                {visibilitySettings.allowPublicTickets ? 'Disabilita' : 'Abilita'} Ticket Pubblici
              </Button>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="text-yellow-600">⚠️</span>
                </div>
                <div className="ml-3 flex-1">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">
                    Conferma Azione
                  </h4>
                  <p className="text-sm text-yellow-700 mb-4">
                    {confirmAction.message}
                  </p>
                  <div className="flex space-x-3">
                    <Button
                      size="sm"
                      onClick={confirmToggle}
                      disabled={isChanging}
                    >
                      {isChanging ? 'Applicando...' : 'Conferma'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelToggle}
                      disabled={isChanging}
                    >
                      Annulla
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Category Approval Setting */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Approvazione Categorie
            </h3>
            <p className="text-sm text-gray-600">
              Richiedi approvazione admin per creare nuove categorie
            </p>
          </div>
          <Badge
            color={visibilitySettings.requireApprovalForCategories ? 'orange' : 'blue'}
            className="ml-4"
          >
            {visibilitySettings.requireApprovalForCategories ? 'Richiesta' : 'Non Richiesta'}
          </Badge>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="text-sm text-gray-600">
              {visibilitySettings.requireApprovalForCategories ? (
                <>
                  Le nuove categorie devono essere approvate da un amministratore prima di essere utilizzate.
                </>
              ) : (
                <>
                  Gli utenti possono creare nuove categorie liberamente.
                </>
              )}
            </div>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={() => handleSettingsChange({
                requireApprovalForCategories: !visibilitySettings.requireApprovalForCategories
              })}
              disabled={isChanging || !!confirmAction}
              variant="outline"
            >
              {visibilitySettings.requireApprovalForCategories ? 'Disabilita' : 'Abilita'} Approvazione
            </Button>
          </div>
        </div>
      </Card>

      {/* SLA Settings */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            SLA Predefinito
          </h3>
          <p className="text-sm text-gray-600">
            Ore predefinite per la risoluzione dei ticket
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="text-sm text-gray-600">
              <strong>Attuale:</strong> {visibilitySettings.defaultSlaHours} ore
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[4, 8, 24, 48, 72].map((hours) => (
              <Button
                key={hours}
                size="sm"
                variant={visibilitySettings.defaultSlaHours === hours ? 'default' : 'outline'}
                onClick={() => handleSettingsChange({ defaultSlaHours: hours })}
                disabled={isChanging || !!confirmAction}
              >
                {hours}h
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Help Section */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="text-lg font-medium text-blue-900 mb-3">
          💡 Suggerimenti per la Configurazione
        </h3>
        <div className="space-y-2 text-sm text-blue-800">
          <div>
            <strong>Ticket Pubblici:</strong> Utili per segnalazioni generali o annunci che tutti devono vedere.
          </div>
          <div>
            <strong>Ticket Privati:</strong> Ideali per questioni sensibili o personali.
          </div>
          <div>
            <strong>Approvazione Categorie:</strong> Mantiene l'organizzazione e previene categorie duplicate.
          </div>
          <div>
            <strong>SLA:</strong> Imposta aspettative chiare sui tempi di risposta.
          </div>
        </div>
      </Card>
    </div>
  )
}


