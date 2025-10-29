'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'

/**
 * Hook per caricare gli stati dei ticket dalla tabella ticketStatuses
 * 
 * Ritorna:
 * - statuses: array di stati attivi ordinati per `order`
 * - isLoading: boolean che indica se sta caricando
 * - getStatusById: funzione per ottenere uno stato per ID
 * - getStatusBySlug: funzione per ottenere uno stato per slug
 * 
 * Esempio:
 * ```tsx
 * const { statuses, getStatusById } = useTicketStatuses()
 * 
 * // Dropdown
 * <select>
 *   {statuses.map(status => (
 *     <option key={status._id} value={status._id}>
 *       {status.name}
 *     </option>
 *   ))}
 * </select>
 * ```
 */

export interface TicketStatus {
  _id: Id<'ticketStatuses'>
  name: string
  slug: string
  description?: string
  color: string
  icon?: string
  order: number
  isSystem: boolean
  isActive: boolean
  isFinal: boolean
  _creationTime: number
}

export function useTicketStatuses() {
  // Carica solo stati attivi
  const statuses = useQuery(api.ticketStatuses.getActiveStatuses)

  const isLoading = statuses === undefined

  /**
   * Ottieni uno stato per ID
   */
  const getStatusById = (statusId: Id<'ticketStatuses'> | undefined): TicketStatus | undefined => {
    if (!statusId || !statuses) return undefined
    return statuses.find((s) => s._id === statusId)
  }

  /**
   * Ottieni uno stato per slug
   */
  const getStatusBySlug = (slug: string | undefined): TicketStatus | undefined => {
    if (!slug || !statuses) return undefined
    return statuses.find((s) => s.slug === slug)
  }

  /**
   * Ottieni il badge color per UI (compatibile con Tailwind)
   */
  const getStatusColor = (statusId: Id<'ticketStatuses'> | undefined): string => {
    const status = getStatusById(statusId)
    if (!status) return 'bg-gray-100 text-gray-800'

    // Converte hex color a classi Tailwind (approssimazione)
    const color = status.color.toLowerCase()
    
    // Rosso (#ef4444)
    if (color.includes('ef4444') || color.includes('f87171')) {
      return 'bg-red-100 text-red-800'
    }
    // Amber (#f59e0b)
    if (color.includes('f59e0b') || color.includes('fbbf24')) {
      return 'bg-amber-100 text-amber-800'
    }
    // Verde (#22c55e)
    if (color.includes('22c55e') || color.includes('10b981')) {
      return 'bg-green-100 text-green-800'
    }
    // Blu
    if (color.includes('3b82f6') || color.includes('60a5fa')) {
      return 'bg-blue-100 text-blue-800'
    }
    
    // Default grigio
    return 'bg-gray-100 text-gray-800'
  }

  return {
    statuses: statuses || [],
    isLoading,
    getStatusById,
    getStatusBySlug,
    getStatusColor,
  }
}

