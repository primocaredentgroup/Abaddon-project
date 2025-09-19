import { useEffect, useState, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

interface PresenceUser {
  _id: string
  name: string
  email: string
  lastSeen: number
  isActive: boolean
}

interface UsePresenceOptions {
  ticketId?: string
  updateInterval?: number
}

interface UsePresenceReturn {
  activeUsers: PresenceUser[]
  updatePresence: () => void
  isOnline: boolean
}

export function usePresence(options: UsePresenceOptions = {}): UsePresenceReturn {
  const { ticketId, updateInterval = 30000 } = options // 30 seconds default
  
  const [isOnline, setIsOnline] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(Date.now())

  // Get current user
  const currentUser = useQuery(api.users.getCurrentUser, {})
  
  // Get active users for the ticket (if specified)
  const activeUsers = useQuery(
    api.presence.getActiveUsers,
    ticketId ? { ticketId: ticketId as any } : "skip"
  )

  // Mutation to update user presence
  const updateUserPresence = useMutation(api.presence.updatePresence)

  // Update presence function
  const updatePresence = useCallback(async () => {
    if (!currentUser) return

    try {
      await updateUserPresence({
        ticketId: ticketId as any,
        isActive: true,
      })
      setLastUpdate(Date.now())
      setIsOnline(true)
    } catch (error) {
      console.error('Failed to update presence:', error)
      setIsOnline(false)
    }
  }, [currentUser, ticketId, updateUserPresence])

  // Set up presence updates
  useEffect(() => {
    if (!currentUser) return

    // Initial presence update
    updatePresence()

    // Set up interval for regular updates
    const interval = setInterval(updatePresence, updateInterval)

    // Update presence when user becomes active
    const handleActivity = () => updatePresence()
    
    // Listen for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Update presence when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup
    return () => {
      clearInterval(interval)
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      // Mark as inactive when unmounting
      if (currentUser) {
        updateUserPresence({
          ticketId: ticketId as any,
          isActive: false,
        }).catch(console.error)
      }
    }
  }, [currentUser, ticketId, updateInterval, updatePresence, updateUserPresence])

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      updatePresence()
    }
    
    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [updatePresence])

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentUser) {
        // Use navigator.sendBeacon for reliable offline update
        const data = JSON.stringify({
          userId: currentUser._id,
          ticketId,
          isActive: false,
        })
        
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/presence/update', data)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [currentUser, ticketId])

  return {
    activeUsers: activeUsers || [],
    updatePresence,
    isOnline,
  }
}


