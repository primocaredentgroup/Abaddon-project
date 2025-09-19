'use client'

import React from 'react'

interface ChatMessageProps {
  author: {
    _id: string
    name: string
    email: string
  } | null
  timestamp: number
  isInitial?: boolean
  children: React.ReactNode
  className?: string
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  author,
  timestamp,
  isInitial = false,
  children,
  className = '',
}) => {
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString('it-IT', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    } else {
      return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }

  const getAuthorInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }

  const getAuthorColor = (id: string) => {
    // Generate a consistent color based on user ID
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-orange-500',
      'bg-teal-500',
      'bg-red-500',
    ]
    
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <div className={`flex space-x-3 ${isInitial ? 'border-l-4 border-l-blue-500 pl-4' : ''} ${className}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {author ? (
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAuthorColor(author._id)}`}
            title={author.name}
          >
            {getAuthorInitials(author.name)}
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-gray-600 text-xs">?</span>
          </div>
        )}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center space-x-2 mb-1">
          <span className="text-sm font-medium text-gray-900">
            {author?.name || 'Utente sconosciuto'}
          </span>
          {isInitial && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              Creatore
            </span>
          )}
          <span className="text-xs text-gray-500">
            {formatTimestamp(timestamp)}
          </span>
        </div>

        {/* Content */}
        <div className={`text-sm text-gray-700 ${isInitial ? 'bg-blue-50 p-3 rounded-md' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  )
}


