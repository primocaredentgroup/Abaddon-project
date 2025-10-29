'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useRole } from '@/providers/RoleProvider';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Bell, Check, CheckCheck, X, ExternalLink } from 'lucide-react';

export function NotificationBell() {
  const { user } = useRole();
  const [isOpen, setIsOpen] = useState(false);

  // Query notifiche
  const notifications = useQuery(
    api.notifications.getUserNotifications,
    user?.email ? { userEmail: user.email, unreadOnly: false } : "skip"
  );

  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    user?.email ? { userEmail: user.email } : "skip"
  );

  // Mutations
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const deleteNotification = useMutation(api.notifications.deleteNotification);

  const handleMarkAsRead = async (notificationId: string) => {
    if (!user?.email) return;
    
    try {
      await markAsRead({
        notificationId: notificationId as any,
        userEmail: user.email
      });
    } catch (error) {
      console.error('Errore nel segnare notifica come letta:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.email) return;
    
    try {
      await markAllAsRead({ userEmail: user.email });
    } catch (error) {
      console.error('Errore nel segnare tutte come lette:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    if (!user?.email) return;
    
    try {
      await deleteNotification({
        notificationId: notificationId as any,
        userEmail: user.email
      });
    } catch (error) {
      console.error('Errore nell\'eliminare notifica:', error);
    }
  };

  const handleNotificationClick = (notification: any) => {
    // Segna come letta
    if (!notification.isRead) {
      handleMarkAsRead(notification._id);
    }
    
    // Naviga all'URL se presente
    if (notification.relatedUrl) {
      window.location.href = notification.relatedUrl;
    }
    
    setIsOpen(false);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Adesso';
    if (minutes < 60) return `${minutes}m fa`;
    if (hours < 24) return `${hours}h fa`;
    if (days < 7) return `${days}g fa`;
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'kb_suggestion':
        return '💡';
      case 'kb_comment':
      case 'kb_comment_reply':
        return '💬';
      case 'ticket_assigned':
        return '🎫';
      default:
        return '🔔';
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="h-5 w-5" />
        {(unreadCount ?? 0) > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount! > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Notifiche</h3>
              <div className="flex items-center gap-2">
                {(unreadCount ?? 0) > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    title="Segna tutte come lette"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Lista Notifiche */}
            <div className="overflow-y-auto flex-1">
              {notifications && notifications.length > 0 ? (
                <div className="divide-y">
                  {notifications.map((notification: any) => (
                    <div
                      key={notification._id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm text-gray-900">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(notification._creationTime)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(notification._id);
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                              title="Elimina"
                            >
                              <X className="h-3 w-3 text-gray-500" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {!notification.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(notification._id);
                                }}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Segna letta
                              </Button>
                            )}
                            {notification.relatedUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleNotificationClick(notification)}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Apri
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p className="font-medium">Nessuna notifica</p>
                  <p className="text-sm mt-1">Sei aggiornato!</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}



