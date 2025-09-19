'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

interface AuditStatsProps {
  entityType?: string
  dateFrom?: number
  dateTo?: number
  className?: string
}

export const AuditStats: React.FC<AuditStatsProps> = ({
  entityType,
  dateFrom,
  dateTo,
  className = '',
}) => {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'custom'>('week')

  // Calculate date range based on selection
  const getDateRange = () => {
    const now = Date.now()
    switch (timeRange) {
      case 'day':
        return { from: now - 24 * 60 * 60 * 1000, to: now }
      case 'week':
        return { from: now - 7 * 24 * 60 * 60 * 1000, to: now }
      case 'month':
        return { from: now - 30 * 24 * 60 * 60 * 1000, to: now }
      case 'custom':
        return { from: dateFrom, to: dateTo }
      default:
        return { from: now - 7 * 24 * 60 * 60 * 1000, to: now }
    }
  }

  const { from, to } = getDateRange()

  const stats = useQuery(
    api.auditLogs?.getStats,
    {
      entityType,
      dateFrom: from,
      dateTo: to,
    }
  )

  const recentLogs = useQuery(
    api.auditLogs?.getRecentByClinic,
    {
      limit: 10,
      entityType,
    }
  )

  if (!stats || !recentLogs) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      created: 'Creazioni',
      updated: 'Modifiche',
      deleted: 'Eliminazioni',
      assigned: 'Assegnazioni',
      status_changed: 'Cambi stato',
      comment_added: 'Commenti',
      settings_updated: 'Impostazioni',
    }
    return labels[action] || action
  }

  const getTopActions = () => {
    return Object.entries(stats.byAction)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
  }

  const getTopUsers = () => {
    return Object.entries(stats.byUser)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Time range selector */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Statistiche Audit
          </h3>
          <div className="flex space-x-2">
            {(['day', 'week', 'month'] as const).map((range) => (
              <Button
                key={range}
                size="sm"
                variant={timeRange === range ? 'default' : 'outline'}
                onClick={() => setTimeRange(range)}
              >
                {range === 'day' && 'Oggi'}
                {range === 'week' && 'Settimana'}
                {range === 'month' && 'Mese'}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {stats.total}
            </div>
            <div className="text-sm text-gray-600">
              Azioni totali
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {Object.keys(stats.byUser).length}
            </div>
            <div className="text-sm text-gray-600">
              Utenti attivi
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Object.keys(stats.byAction).length}
            </div>
            <div className="text-sm text-gray-600">
              Tipi di azione
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Actions */}
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Azioni Più Frequenti
          </h3>
          <div className="space-y-3">
            {getTopActions().map(([action, count]) => (
              <div key={action} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge color="blue" size="sm">
                    {getActionLabel(action)}
                  </Badge>
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {count}
                </div>
              </div>
            ))}
            {getTopActions().length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">
                Nessuna azione nel periodo selezionato
              </div>
            )}
          </div>
        </Card>

        {/* Top Users */}
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Utenti Più Attivi
          </h3>
          <div className="space-y-3">
            {getTopUsers().map(([userId, count]) => {
              const user = recentLogs.find(log => log.userId === userId)?.user
              return (
                <div key={userId} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                      {user?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="text-sm text-gray-900">
                      {user?.name || 'Utente sconosciuto'}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {count}
                  </div>
                </div>
              )
            })}
            {getTopUsers().length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">
                Nessuna attività nel periodo selezionato
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Attività Recente
        </h3>
        <div className="space-y-3">
          {recentLogs.slice(0, 10).map((log) => (
            <div key={log._id} className="flex items-center space-x-3 py-2">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm">
                {log.user?.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900">
                  <span className="font-medium">{log.user?.name || 'Utente'}</span>
                  {' '}
                  <span className="text-gray-600">{getActionLabel(log.action).toLowerCase()}</span>
                  {log.entity && (
                    <span className="text-gray-600">
                      {' '}{log.entityType} "{log.entity.title || log.entityId.slice(-8)}"
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(log._creationTime).toLocaleString('it-IT')}
                </div>
              </div>
            </div>
          ))}
          {recentLogs.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-8">
              Nessuna attività recente
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}


