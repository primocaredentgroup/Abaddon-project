'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

interface AuditLogViewerProps {
  entityType: string
  entityId: string
  title?: string
  className?: string
}

const ACTION_LABELS = {
  created: 'Creato',
  updated: 'Aggiornato',
  deleted: 'Eliminato',
  assigned: 'Assegnato',
  unassigned: 'Rimossa assegnazione',
  status_changed: 'Stato cambiato',
  comment_added: 'Commento aggiunto',
  comment_edited: 'Commento modificato',
  comment_deleted: 'Commento eliminato',
  settings_updated: 'Impostazioni aggiornate',
  public_tickets_toggled: 'Ticket pubblici modificati',
  public_tickets_disabled: 'Ticket pubblici disabilitati',
} as const

const ACTION_COLORS = {
  created: 'green',
  updated: 'blue',
  deleted: 'red',
  assigned: 'purple',
  unassigned: 'orange',
  status_changed: 'yellow',
  comment_added: 'blue',
  comment_edited: 'orange',
  comment_deleted: 'red',
  settings_updated: 'purple',
  public_tickets_toggled: 'blue',
  public_tickets_disabled: 'red',
} as const

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  entityType,
  entityId,
  title = 'Storico Modifiche',
  className = '',
}) => {
  const [limit, setLimit] = useState(20)
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({})

  const auditLogs = useQuery(
    api.auditLogs?.getByEntity,
    { 
      entityType, 
      entityId,
      limit 
    }
  )

  const toggleDetails = (logId: string) => {
    setShowDetails(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }))
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatChanges = (changes: any) => {
    if (!changes || typeof changes !== 'object') {
      return null
    }

    return Object.entries(changes).map(([key, value]) => {
      if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
        return (
          <div key={key} className="text-sm">
            <span className="font-medium capitalize">{key}:</span>
            <span className="text-red-600 line-through ml-2">
              {formatValue(value.from)}
            </span>
            <span className="mx-2">→</span>
            <span className="text-green-600">
              {formatValue(value.to)}
            </span>
          </div>
        )
      } else {
        return (
          <div key={key} className="text-sm">
            <span className="font-medium capitalize">{key}:</span>
            <span className="ml-2">{formatValue(value)}</span>
          </div>
        )
      }
    })
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'vuoto'
    if (typeof value === 'boolean') return value ? 'Sì' : 'No'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return '✨'
      case 'updated': return '✏️'
      case 'deleted': return '🗑️'
      case 'assigned': return '👤'
      case 'unassigned': return '👤'
      case 'status_changed': return '🔄'
      case 'comment_added': return '💬'
      case 'comment_edited': return '✏️'
      case 'comment_deleted': return '🗑️'
      case 'settings_updated': return '⚙️'
      case 'public_tickets_toggled': return '🔄'
      case 'public_tickets_disabled': return '🔒'
      default: return '📝'
    }
  }

  if (!auditLogs) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  const { logs, total, hasMore } = auditLogs

  if (logs.length === 0) {
    return (
      <Card className={`p-6 text-center ${className}`}>
        <div className="text-4xl mb-2">📋</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nessuno storico disponibile
        </h3>
        <p className="text-gray-600">
          Non ci sono ancora modifiche registrate per questo elemento.
        </p>
      </Card>
    )
  }

  return (
    <Card className={`${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            {title}
          </h3>
          <Badge color="blue">
            {total} modifiche
          </Badge>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {logs.map((log) => (
          <div key={log._id} className="p-4">
            <div className="flex items-start space-x-3">
              {/* Icon */}
              <div className="flex-shrink-0 mt-1">
                <span className="text-lg">
                  {getActionIcon(log.action)}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {log.user?.name || 'Utente sconosciuto'}
                  </span>
                  <Badge
                    color={ACTION_COLORS[log.action as keyof typeof ACTION_COLORS] || 'gray'}
                    size="sm"
                  >
                    {ACTION_LABELS[log.action as keyof typeof ACTION_LABELS] || log.action}
                  </Badge>
                </div>

                <div className="text-sm text-gray-600 mb-2">
                  {formatTimestamp(log._creationTime)}
                </div>

                {/* Changes preview */}
                {log.changes && (
                  <div className="mt-2">
                    {!showDetails[log._id] ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleDetails(log._id)}
                        className="text-xs"
                      >
                        Mostra dettagli
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <div className="bg-gray-50 rounded-md p-3 space-y-1">
                          {formatChanges(log.changes)}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleDetails(log._id)}
                          className="text-xs"
                        >
                          Nascondi dettagli
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="p-4 border-t border-gray-200 text-center">
          <Button
            variant="outline"
            onClick={() => setLimit(prev => prev + 20)}
          >
            Carica altre modifiche
          </Button>
        </div>
      )}

      {/* Summary */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-600">
        Visualizzando {logs.length} di {total} modifiche
      </div>
    </Card>
  )
}


