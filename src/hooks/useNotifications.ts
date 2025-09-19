import { useEffect, useState, useCallback } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

interface Notification {
  id: string
  type: 'ticket_assigned' | 'ticket_status_changed' | 'new_comment' | 'ticket_created'
  title: string
  message: string
  ticketId?: string
  timestamp: number
  read: boolean
  priority: 'low' | 'medium' | 'high'
}

interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (notificationId: string) => void
  markAllAsRead: () => void
  clearNotification: (notificationId: string) => void
  clearAll: () => void
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [lastChecked, setLastChecked] = useState(Date.now() - 5 * 60 * 1000) // Last 5 minutes

  // Get current user for personalized notifications
  const currentUser = useQuery(api.users.getCurrentUser, {})
  
  // Get recent audit logs that might generate notifications
  const recentLogs = useQuery(
    api.auditLogs.getRecentByClinic, 
    { limit: 50 }
  )

  // Process audit logs into notifications
  useEffect(() => {
    if (!recentLogs || !currentUser) return

    const newNotifications: Notification[] = []

    recentLogs.forEach(log => {
      // Skip notifications for actions by current user
      if (log.userId === currentUser._id) return

      // Skip old logs
      if (log._creationTime < lastChecked) return

      let notification: Notification | null = null

      switch (log.action) {
        case 'assigned':
          if (log.changes?.assigneeId?.to === currentUser._id) {
            notification = {
              id: `${log._id}-assigned`,
              type: 'ticket_assigned',
              title: 'Ticket Assegnato',
              message: `Ti è stato assegnato il ticket "${log.entity?.title || 'Senza titolo'}"`,
              ticketId: log.entityId,
              timestamp: log._creationTime,
              read: false,
              priority: 'high',
            }
          }
          break

        case 'status_changed':
          // Notify if user is involved in the ticket
          if (log.entity && (
            log.entity.creatorId === currentUser._id ||
            log.entity.assigneeId === currentUser._id
          )) {
            const statusLabels = {
              open: 'Aperto',
              in_progress: 'In Lavorazione', 
              closed: 'Chiuso'
            }
            
            notification = {
              id: `${log._id}-status`,
              type: 'ticket_status_changed',
              title: 'Stato Ticket Cambiato',
              message: `Il ticket "${log.entity.title}" è ora "${statusLabels[log.changes?.status?.to] || log.changes?.status?.to}"`,
              ticketId: log.entityId,
              timestamp: log._creationTime,
              read: false,
              priority: log.changes?.status?.to === 'closed' ? 'medium' : 'low',
            }
          }
          break

        case 'comment_added':
          // Notify if user is involved in the ticket but didn't add the comment
          if (log.entity && (
            log.entity.creatorId === currentUser._id ||
            log.entity.assigneeId === currentUser._id
          )) {
            notification = {
              id: `${log._id}-comment`,
              type: 'new_comment',
              title: 'Nuovo Commento',
              message: `${log.user?.name || 'Qualcuno'} ha aggiunto un commento al ticket "${log.entity.title}"`,
              ticketId: log.entityId,
              timestamp: log._creationTime,
              read: false,
              priority: 'medium',
            }
          }
          break

        case 'created':
          // Notify agents of new tickets (TODO: add role-based filtering)
          if (log.entityType === 'ticket') {
            notification = {
              id: `${log._id}-created`,
              type: 'ticket_created',
              title: 'Nuovo Ticket',
              message: `${log.user?.name || 'Qualcuno'} ha creato un nuovo ticket: "${log.changes?.title || 'Senza titolo'}"`,
              ticketId: log.entityId,
              timestamp: log._creationTime,
              read: false,
              priority: 'medium',
            }
          }
          break
      }

      if (notification) {
        newNotifications.push(notification)
      }
    })

    // Merge with existing notifications, avoiding duplicates
    setNotifications(prev => {
      const existingIds = new Set(prev.map(n => n.id))
      const uniqueNew = newNotifications.filter(n => !existingIds.has(n.id))
      
      // Combine and sort by timestamp (newest first)
      const combined = [...prev, ...uniqueNew]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 100) // Keep only last 100 notifications
      
      return combined
    })

    // Update last checked time
    if (newNotifications.length > 0) {
      setLastChecked(Date.now())
    }
  }, [recentLogs, currentUser, lastChecked])

  // Request notification permission on first load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Show browser notifications for high priority items
  useEffect(() => {
    notifications
      .filter(n => !n.read && n.priority === 'high')
      .forEach(notification => {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            tag: notification.id, // Prevents duplicate notifications
          })
        }
      })
  }, [notifications])

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const clearNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
  }
}


