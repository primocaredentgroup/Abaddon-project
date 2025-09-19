'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useNotifications } from '@/hooks/useNotifications'

interface NotificationDropdownProps {
  className?: string
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
  } = useNotifications()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNotificationClick = (notificationId: string, ticketId?: string) => {
    markAsRead(notificationId)
    
    if (ticketId) {
      // Navigate to ticket (you might want to use Next.js router here)
      window.location.href = `/tickets/${ticketId}`
    }
  }

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'Ora'
    if (minutes < 60) return `${minutes}m fa`
    if (hours < 24) return `${hours}h fa`
    return `${days}g fa`
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ticket_assigned':
        return '👤'
      case 'ticket_status_changed':
        return '📋'
      case 'new_comment':
        return '💬'
      case 'ticket_created':
        return '✨'
      default:
        return '📢'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'red'
      case 'medium': return 'orange'
      case 'low': return 'blue'
      default: return 'gray'
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        title="Notifiche"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Notifiche ({unreadCount} non lette)
            </h3>
            {notifications.length > 0 && (
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={markAllAsRead}
                    className="text-xs"
                  >
                    Segna tutte lette
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearAll}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Cancella tutto
                </Button>
              </div>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <div className="text-2xl mb-2">🔔</div>
                <div className="text-sm">Nessuna notifica</div>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification.id, notification.ticketId)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 text-lg">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {notification.title}
                        </h4>
                        <div className="flex items-center space-x-2">
                          <Badge
                            color={getPriorityColor(notification.priority)}
                            size="sm"
                          >
                            {notification.priority}
                          </Badge>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              clearNotification(notification.id)
                            }}
                            className="text-gray-400 hover:text-gray-600"
                            title="Rimuovi notifica"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(notification.timestamp)}
                        </span>
                        
                        {!notification.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              markAsRead(notification.id)
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Segna come letto
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 5 && (
            <div className="px-4 py-2 border-t border-gray-200 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Navigate to full notifications page
                  window.location.href = '/notifications'
                }}
              >
                Vedi tutte le notifiche
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


