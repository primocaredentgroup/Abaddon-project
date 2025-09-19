'use client'

import React from 'react'
import { usePresence } from '@/hooks/usePresence'

interface ActiveUsersProps {
  ticketId?: string
  maxUsers?: number
  showNames?: boolean
  className?: string
}

export const ActiveUsers: React.FC<ActiveUsersProps> = ({
  ticketId,
  maxUsers = 5,
  showNames = false,
  className = '',
}) => {
  const { activeUsers, isOnline } = usePresence({ ticketId })

  if (!isOnline) {
    return (
      <div className={`flex items-center space-x-2 text-gray-500 ${className}`}>
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <span className="text-xs">Offline</span>
      </div>
    )
  }

  if (activeUsers.length === 0) {
    return (
      <div className={`flex items-center space-x-2 text-gray-500 ${className}`}>
        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        <span className="text-xs">Nessuno online</span>
      </div>
    )
  }

  const displayUsers = activeUsers.slice(0, maxUsers)
  const remainingCount = activeUsers.length - maxUsers

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }

  const getStatusColor = (lastSeen: number) => {
    const now = Date.now()
    const diff = now - lastSeen
    
    if (diff < 60000) return 'bg-green-500' // Last minute - active
    if (diff < 300000) return 'bg-yellow-500' // Last 5 minutes - away
    return 'bg-gray-400' // Inactive
  }

  const getStatusLabel = (lastSeen: number) => {
    const now = Date.now()
    const diff = now - lastSeen
    
    if (diff < 60000) return 'Attivo ora'
    if (diff < 300000) return 'Attivo di recente'
    return 'Non attivo'
  }

  if (showNames) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="text-xs font-medium text-gray-700">
          Utenti Attivi ({activeUsers.length})
        </div>
        <div className="space-y-1">
          {displayUsers.map((user) => (
            <div key={user._id} className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${getStatusColor(user.lastSeen)}`}
                title={getStatusLabel(user.lastSeen)}
              ></div>
              <span className="text-xs text-gray-600">{user.name}</span>
            </div>
          ))}
          {remainingCount > 0 && (
            <div className="text-xs text-gray-500">
              +{remainingCount} altri
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex -space-x-1">
        {displayUsers.map((user, index) => (
          <div
            key={user._id}
            className="relative"
            title={`${user.name} - ${getStatusLabel(user.lastSeen)}`}
            style={{ zIndex: displayUsers.length - index }}
          >
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white">
              {getInitials(user.name)}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${getStatusColor(user.lastSeen)}`}
            ></div>
          </div>
        ))}
        
        {remainingCount > 0 && (
          <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-xs font-medium border-2 border-white">
            +{remainingCount}
          </div>
        )}
      </div>
      
      <span className="text-xs text-gray-600">
        {activeUsers.length === 1 ? '1 utente attivo' : `${activeUsers.length} utenti attivi`}
      </span>
    </div>
  )
}


