'use client'

import React from 'react'
import { useTicketStatuses } from '@/hooks/useTicketStatuses'
import { Id } from '../../../convex/_generated/dataModel'

interface StatusSelectProps {
  value: Id<'ticketStatuses'> | undefined
  onChange: (statusId: Id<'ticketStatuses'>) => void
  disabled?: boolean
  className?: string
  includeAll?: boolean // Per filtri: mostra opzione "Tutti"
}

/**
 * Componente dropdown per selezionare uno stato ticket
 * Carica automaticamente gli stati dalla tabella ticketStatuses
 * 
 * Esempio:
 * ```tsx
 * const [selectedStatus, setSelectedStatus] = useState<Id<'ticketStatuses'>>()
 * 
 * <StatusSelect 
 *   value={selectedStatus} 
 *   onChange={setSelectedStatus}
 * />
 * ```
 */
export const StatusSelect: React.FC<StatusSelectProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  includeAll = false,
}) => {
  const { statuses, isLoading } = useTicketStatuses()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value
    if (newValue && newValue !== 'all') {
      onChange(newValue as Id<'ticketStatuses'>)
    }
  }

  if (isLoading) {
    return (
      <select disabled className={`${className} opacity-50`}>
        <option>Caricamento...</option>
      </select>
    )
  }

  return (
    <select
      value={value || 'all'}
      onChange={handleChange}
      disabled={disabled}
      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${className}`}
    >
      {includeAll && <option value="all">Tutti gli stati</option>}
      
      {statuses.map((status) => (
        <option key={status._id} value={status._id}>
          {status.name}
        </option>
      ))}
    </select>
  )
}

/**
 * Componente dropdown MULTI-SELECT per filtrare per più stati
 */
interface StatusMultiSelectProps {
  values: Id<'ticketStatuses'>[]
  onChange: (statusIds: Id<'ticketStatuses'>[]) => void
  disabled?: boolean
  className?: string
}

export const StatusMultiSelect: React.FC<StatusMultiSelectProps> = ({
  values,
  onChange,
  disabled = false,
  className = '',
}) => {
  const { statuses, isLoading } = useTicketStatuses()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions, (option) => option.value as Id<'ticketStatuses'>)
    onChange(selected)
  }

  if (isLoading) {
    return (
      <select disabled multiple className={`${className} opacity-50`}>
        <option>Caricamento...</option>
      </select>
    )
  }

  return (
    <select
      multiple
      value={values}
      onChange={handleChange}
      disabled={disabled}
      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${className}`}
    >
      {statuses.map((status) => (
        <option key={status._id} value={status._id}>
          {status.name}
        </option>
      ))}
    </select>
  )
}
