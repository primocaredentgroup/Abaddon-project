'use client'

import React, { useState, useEffect } from 'react'
import { Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

interface SLACountdownProps {
  slaDeadline?: number // Timestamp Unix in millisecondi
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

/**
 * Componente SLA Countdown
 * 
 * Mostra il tempo rimanente fino alla scadenza SLA
 * Si aggiorna automaticamente ogni minuto
 * 
 * Props:
 * - slaDeadline: timestamp Unix quando scade (o undefined se no SLA)
 * - size: dimensione badge (sm/md/lg)
 * - showIcon: mostra icona
 */
export function SLACountdown({ 
  slaDeadline, 
  size = 'md',
  showIcon = true 
}: SLACountdownProps) {
  const [currentTime, setCurrentTime] = useState(Date.now())

  // Aggiorna il tempo corrente ogni minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 60000) // Ogni 60 secondi

    return () => clearInterval(interval)
  }, [])

  // Se no SLA
  if (!slaDeadline) {
    return (
      <Badge 
        variant="default"
        className="text-gray-600 bg-gray-100 border-gray-300"
      >
        {showIcon && <Clock className="h-3 w-3 mr-1" />}
        <span className={getSizeClass(size)}>SLA assente</span>
      </Badge>
    )
  }

  const remaining = slaDeadline - currentTime
  const isBreached = remaining <= 0

  // Calcola tempo rimanente/scaduto
  const { timeString, status } = calculateTimeDisplay(remaining)

  // Colori e icone in base allo stato
  const { color, bgColor, icon: Icon } = getStatusStyle(status, isBreached)

  return (
    <Badge 
      variant="default"
      className={`${color} ${bgColor} border-opacity-50`}
    >
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      <span className={getSizeClass(size)}>{timeString}</span>
    </Badge>
  )
}

/**
 * Calcola il display del tempo (formato leggibile)
 */
function calculateTimeDisplay(remaining: number): { 
  timeString: string; 
  status: 'ok' | 'warning' | 'critical' | 'breached' 
} {
  const absRemaining = Math.abs(remaining)
  
  const days = Math.floor(absRemaining / (1000 * 60 * 60 * 24))
  const hours = Math.floor((absRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((absRemaining % (1000 * 60 * 60)) / (1000 * 60))

  // Se scaduto
  if (remaining <= 0) {
    let timeString = ''
    if (days > 0) {
      timeString = `Scaduto da ${days}g ${hours}h`
    } else if (hours > 0) {
      timeString = `Scaduto da ${hours}h ${minutes}m`
    } else {
      timeString = `Scaduto da ${minutes}m`
    }
    return { timeString, status: 'breached' }
  }

  // Tempo rimanente
  let timeString = ''
  if (days > 0) {
    timeString = `${days}g ${hours}h`
  } else if (hours > 0) {
    timeString = `${hours}h ${minutes}m`
  } else {
    timeString = `${minutes}m`
  }

  // Determina stato in base a % tempo rimasto
  if (hours < 2) {
    return { timeString: `Scade tra ${timeString}`, status: 'critical' }
  } else if (hours < 12) {
    return { timeString: `Scade tra ${timeString}`, status: 'warning' }
  } else {
    return { timeString: `Scade tra ${timeString}`, status: 'ok' }
  }
}

/**
 * Ritorna stile e icona in base allo stato
 */
function getStatusStyle(
  status: 'ok' | 'warning' | 'critical' | 'breached',
  isBreached: boolean
): { 
  color: string; 
  bgColor: string; 
  icon: React.ComponentType<{ className?: string }> 
} {
  if (isBreached) {
    return {
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      icon: XCircle,
    }
  }

  switch (status) {
    case 'critical':
      return {
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        icon: AlertTriangle,
      }
    case 'warning':
      return {
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        icon: Clock,
      }
    case 'ok':
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        icon: CheckCircle,
      }
    default:
      return {
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        icon: Clock,
      }
  }
}

/**
 * Dimensione testo in base al size
 */
function getSizeClass(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'text-xs'
    case 'md':
      return 'text-sm'
    case 'lg':
      return 'text-base'
    default:
      return 'text-sm'
  }
}


