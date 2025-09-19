'use client'

import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { TicketStatus } from '@/types'

interface StatusBadgeProps {
  status: TicketStatus
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

const STATUS_CONFIG = {
  open: {
    label: 'Aperto',
    color: 'red' as const,
    icon: '🔴',
    description: 'Ticket appena creato, in attesa di essere preso in carico',
  },
  in_progress: {
    label: 'In Lavorazione',
    color: 'yellow' as const,
    icon: '🟡',
    description: 'Ticket assegnato e in lavorazione',
  },
  closed: {
    label: 'Chiuso',
    color: 'green' as const,
    icon: '🟢',
    description: 'Ticket risolto e chiuso',
  },
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = false,
  className = '',
}) => {
  const config = STATUS_CONFIG[status]

  if (!config) {
    return (
      <Badge color="gray" size={size} className={className}>
        Sconosciuto
      </Badge>
    )
  }

  return (
    <Badge
      color={config.color}
      size={size}
      className={className}
      title={config.description}
    >
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  )
}

// Utility function to get status config
export const getStatusConfig = (status: TicketStatus) => {
  return STATUS_CONFIG[status] || {
    label: 'Sconosciuto',
    color: 'gray' as const,
    icon: '❓',
    description: 'Stato non riconosciuto',
  }
}

// Utility function to get next possible statuses
export const getNextStatuses = (currentStatus: TicketStatus): TicketStatus[] => {
  switch (currentStatus) {
    case 'open':
      return ['in_progress', 'closed']
    case 'in_progress':
      return ['open', 'closed']
    case 'closed':
      return [] // Closed tickets cannot change status
    default:
      return []
  }
}

// Utility function to check if status transition is valid
export const isValidStatusTransition = (from: TicketStatus, to: TicketStatus): boolean => {
  const nextStatuses = getNextStatuses(from)
  return nextStatuses.includes(to)
}


