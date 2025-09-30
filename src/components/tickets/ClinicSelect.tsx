'use client'

import React, { useState, useMemo } from 'react'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useAuth } from '@/hooks/useAuth'

interface ClinicSelectProps {
  value?: string
  onChange: (clinicId: string) => Promise<void>
  disabled?: boolean
  className?: string
}

export const ClinicSelect: React.FC<ClinicSelectProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [isChanging, setIsChanging] = useState(false)
  const [error, setError] = useState('')

  const { user } = useAuth()
  
  // Get all clinics (for now, later we can filter by user permissions)
  const clinics = useQuery(api.clinics.list, {})

  const clinicOptions = useMemo(() => {
    if (!clinics) return []
    
    return clinics.map(clinic => ({
      value: clinic._id,
      label: clinic.name
    }))
  }, [clinics])

  const currentClinic = clinics?.find(clinic => clinic._id === value)

  const handleClinicChange = async (clinicId: string) => {
    if (clinicId === value) return

    setIsChanging(true)
    setError('')

    try {
      await onChange(clinicId)
    } catch (error) {
      console.error('Error changing clinic:', error)
      setError('Errore durante il cambio clinica')
    } finally {
      setIsChanging(false)
    }
  }

  if (!clinics) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Caricamento cliniche...
      </div>
    )
  }

  if (clinics.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Nessuna clinica disponibile
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Clinica
        </label>
        
        {/* Current clinic display */}
        {currentClinic && (
          <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-md mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-500 rounded-full" />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {currentClinic.name}
                </div>
                <div className="text-xs text-gray-500">
                  {currentClinic.address || 'Nessun indirizzo'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clinic selection */}
        <Select
          value={value || ''}
          onChange={handleClinicChange}
          disabled={disabled || isChanging}
          placeholder="Seleziona clinica"
          options={clinicOptions}
        />
      </div>

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}
    </div>
  )
}
