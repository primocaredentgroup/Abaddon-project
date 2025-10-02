'use client'

import React, { useState } from 'react'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { TicketStatus } from '@/types'
import { getStatusConfig, getNextStatuses, isValidStatusTransition } from './StatusBadge'

interface StatusSelectProps {
  value: TicketStatus
  onChange: (status: TicketStatus) => Promise<void>
  disabled?: boolean
  showConfirmation?: boolean
  className?: string
}

export const StatusSelect: React.FC<StatusSelectProps> = ({
  value,
  onChange,
  disabled = false,
  showConfirmation = true,
  className = '',
}) => {
  const [isChanging, setIsChanging] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null)
  const [error, setError] = useState('')

  const currentConfig = getStatusConfig(value)
  const nextStatuses = getNextStatuses(value)

  const handleStatusChange = (newStatus: string) => {
    const status = newStatus as TicketStatus
    
    if (status === value) return

    if (!isValidStatusTransition(value, status)) {
      setError('Transizione di stato non valida')
      return
    }

    if (showConfirmation) {
      setPendingStatus(status)
    } else {
      confirmStatusChange(status)
    }
  }

  const confirmStatusChange = async (status: TicketStatus) => {
    setIsChanging(true)
    setError('')

    try {
      await onChange(status)
      setPendingStatus(null)
    } catch (error) {
      console.error('Error changing status:', error)
      setError('Errore durante il cambio stato')
    } finally {
      setIsChanging(false)
    }
  }

  const cancelStatusChange = () => {
    setPendingStatus(null)
    setError('')
  }

  if (nextStatuses.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        {currentConfig.icon} {currentConfig.label}
        <div className="text-xs text-gray-400 mt-1">
          Nessuna transizione disponibile
        </div>
      </div>
    )
  }

  if (pendingStatus) {
    const pendingConfig = getStatusConfig(pendingStatus)
    
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="text-sm font-medium text-yellow-800 mb-2">
            Conferma Cambio Stato
          </div>
          <div className="text-sm text-yellow-700 mb-3">
            Vuoi cambiare lo stato da "{currentConfig.label}" a "{pendingConfig.label}"?
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              onClick={() => confirmStatusChange(pendingStatus)}
              disabled={isChanging}
            >
              {isChanging ? 'Cambiando...' : 'Conferma'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={cancelStatusChange}
              disabled={isChanging}
            >
              Annulla
            </Button>
          </div>
        </div>
        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Stato Ticket
        </label>
        <Select
          value={value}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={disabled || isChanging}
          options={[
            { value: value, label: `${currentConfig.icon} ${currentConfig.label} (Attuale)` },
            ...nextStatuses.map((status) => {
              const config = getStatusConfig(status)
              return {
                value: status,
                label: `${config.icon} ${config.label}`
              }
            })
          ]}
        />
      </div>

      {/* Status descriptions */}
      <div className="text-xs text-gray-500 space-y-1">
        <div className="font-medium">Transizioni disponibili:</div>
        {nextStatuses.map((status) => {
          const config = getStatusConfig(status)
          return (
            <div key={status} className="flex items-start space-x-1">
              <span>{config.icon}</span>
              <div>
                <span className="font-medium">{config.label}:</span>
                <span className="ml-1">{config.description}</span>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}
    </div>
  )
}


