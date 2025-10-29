'use client'

import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { useTicketStatuses } from '@/hooks/useTicketStatuses'
import { Id } from '../../../convex/_generated/dataModel'

interface StatusBadgeProps {
  // 🆕 Nuovo: accetta ticketStatusId (preferito)
  ticketStatusId?: Id<'ticketStatuses'>
  // 🔄 DEPRECATED: accetta ancora lo slug per retrocompatibilità
  status?: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  ticketStatusId,
  status,
  size = 'md',
  showIcon = false,
  className = '',
}) => {
  const { getStatusById, getStatusBySlug, isLoading } = useTicketStatuses()

  // 🆕 Cerca lo stato per ID (priorità)
  let statusData = ticketStatusId ? getStatusById(ticketStatusId) : undefined

  // 🔄 Fallback: cerca per slug se ID non presente (DEPRECATED)
  if (!statusData && status) {
    statusData = getStatusBySlug(status)
  }

  // Loading state
  if (isLoading) {
    return (
      <Badge color="gray" size={size} className={className}>
        ...
      </Badge>
    )
  }

  // Stato non trovato
  if (!statusData) {
    return (
      <Badge color="gray" size={size} className={className}>
        Sconosciuto
      </Badge>
    )
  }

  // Mappa i colori hex a colori Badge
  let badgeColor: 'red' | 'yellow' | 'green' | 'blue' | 'gray' = 'gray'
  
  if (statusData.color.includes('ef4444') || statusData.color.includes('f87171')) {
    badgeColor = 'red'
  } else if (statusData.color.includes('f59e0b') || statusData.color.includes('fbbf24')) {
    badgeColor = 'yellow'
  } else if (statusData.color.includes('22c55e') || statusData.color.includes('10b981')) {
    badgeColor = 'green'
  } else if (statusData.color.includes('3b82f6') || statusData.color.includes('60a5fa')) {
    badgeColor = 'blue'
  }

  return (
    <Badge
      color={badgeColor}
      size={size}
      className={className}
      title={statusData.description}
    >
      {showIcon && statusData.icon && <span className="mr-1">{statusData.icon}</span>}
      {statusData.name}
    </Badge>
  )
}

// 🆕 Utility function to get status data by ID
export const getStatusData = (ticketStatusId: Id<'ticketStatuses'> | undefined) => {
  // Questa funzione deve essere usata dentro un componente con useTicketStatuses
  // Per ora manteniamo solo per compatibilità
  return null
}


