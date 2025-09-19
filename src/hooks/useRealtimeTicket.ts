import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

interface UseRealtimeTicketOptions {
  ticketId: string
  onTicketUpdate?: (ticket: any) => void
  onNewComment?: (comment: any) => void
  onStatusChange?: (oldStatus: string, newStatus: string) => void
  onAssignmentChange?: (oldAssignee: string | null, newAssignee: string | null) => void
}

interface RealtimeTicketState {
  ticket: any
  comments: any[]
  isLoading: boolean
  error: string | null
  lastUpdate: number
}

export function useRealtimeTicket(options: UseRealtimeTicketOptions): RealtimeTicketState {
  const { ticketId, onTicketUpdate, onNewComment, onStatusChange, onAssignmentChange } = options
  
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  const [error, setError] = useState<string | null>(null)
  const [previousTicket, setPreviousTicket] = useState<any>(null)
  const [previousComments, setPreviousComments] = useState<any[]>([])

  // Real-time queries
  // TODO: Uncomment when Convex functions are generated
  const ticket = null // useQuery(api.tickets?.getById, { ticketId: ticketId as any })
  const comments = null // useQuery(api.comments?.getByTicket, { ticketId: ticketId as any })

  // Temporarily set loading to false since we're using mock data
  const isLoading = false // ticket === undefined || comments === undefined

  // Handle ticket updates
  useEffect(() => {
    if (ticket && previousTicket) {
      // Check for status changes
      if ((ticket as any).status !== (previousTicket as any).status) {
        onStatusChange?.((previousTicket as any).status, (ticket as any).status)
      }

      // Check for assignment changes
      if ((ticket as any).assigneeId !== (previousTicket as any).assigneeId) {
        onAssignmentChange?.((previousTicket as any).assigneeId, (ticket as any).assigneeId)
      }

      // General update callback
      onTicketUpdate?.(ticket)
      setLastUpdate(Date.now())
    }

    if (ticket) {
      setPreviousTicket(ticket)
    }
  }, [ticket, previousTicket, onTicketUpdate, onStatusChange, onAssignmentChange])

  // Handle new comments
  useEffect(() => {
    if (comments && previousComments.length > 0) {
      const newComments = (comments as any[]).filter(
        (comment: any) => !previousComments.some((prev: any) => prev._id === comment._id)
      )

      newComments.forEach((comment: any) => {
        onNewComment?.(comment)
      })

      if (newComments.length > 0) {
        setLastUpdate(Date.now())
      }
    }

    if (comments) {
      setPreviousComments(comments)
    }
  }, [comments, previousComments, onNewComment])

  // Handle errors
  useEffect(() => {
    // TODO: Re-enable error handling when Convex functions are available
    // if (ticket === null) {
    //   setError('Ticket non trovato o accesso negato')
    // } else if (comments === null) {
    //   setError('Errore nel caricamento dei commenti')
    // } else {
    //   setError(null)
    // }
    setError(null) // Temporarily disable error handling
  }, [ticket, comments])

  return {
    ticket: ticket || null,
    comments: comments || [],
    isLoading,
    error,
    lastUpdate,
  }
}
