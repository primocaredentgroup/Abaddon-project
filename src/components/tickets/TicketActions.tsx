'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TicketStatus } from '@/types'
import { StatusBadge, getNextStatuses } from './StatusBadge'
import { StatusSelect } from './StatusSelect'
import { AssigneeSelect } from './AssigneeSelect'
import { CategorySelect } from './CategorySelect'
import { ClinicSelect } from './ClinicSelect'

interface TicketActionsProps {
  ticketId: string
  currentStatus: TicketStatus
  currentAssigneeId?: string
  currentCategoryId?: string
  currentClinicId?: string
  creatorId: string
  currentUserId: string
  onStatusChange: (status: TicketStatus) => Promise<void>
  onAssigneeChange: (assigneeId?: string) => Promise<void>
  onCategoryChange?: (categoryId: string) => Promise<void>
  onClinicChange?: (clinicId: string) => Promise<void>
  canManage?: boolean
  canEdit?: boolean
  className?: string
}

export const TicketActions: React.FC<TicketActionsProps> = ({
  ticketId,
  currentStatus,
  currentAssigneeId,
  currentCategoryId,
  currentClinicId,
  creatorId,
  currentUserId,
  onStatusChange,
  onAssigneeChange,
  onCategoryChange,
  onClinicChange,
  canManage = false,
  canEdit = false,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'assignee' | 'category' | 'clinic' | 'quick'>('quick')

  const isCreator = creatorId === currentUserId
  const isAssignee = currentAssigneeId === currentUserId
  const canChangeStatus = canManage || isCreator || isAssignee
  const canChangeAssignee = canManage

  // Quick action buttons
  const getQuickActions = () => {
    const actions = []

    if (currentStatus === 'open' && canChangeStatus) {
      actions.push({
        label: 'Prendi in carico',
        action: async () => {
          if (!isAssignee) {
            await onAssigneeChange(currentUserId)
          }
          await onStatusChange('in_progress')
        },
        color: 'blue',
        icon: '👤',
      })
    }

    if (currentStatus === 'in_progress' && canChangeStatus) {
      actions.push({
        label: 'Chiudi ticket',
        action: () => onStatusChange('closed'),
        color: 'green',
        icon: '✅',
      })

      if (canChangeStatus) {
        actions.push({
          label: 'Riapri',
          action: () => onStatusChange('open'),
          color: 'orange',
          icon: '🔄',
        })
      }
    }

    if (currentStatus === 'closed' && canChangeStatus) {
      actions.push({
        label: 'Riapri ticket',
        action: () => onStatusChange('open'),
        color: 'orange',
        icon: '🔄',
      })
    }

    if (!currentAssigneeId && canChangeAssignee) {
      actions.push({
        label: 'Assegna a me',
        action: () => onAssigneeChange(currentUserId),
        color: 'purple',
        icon: '🙋‍♂️',
      })
    }

    return actions
  }

  const quickActions = getQuickActions()

  if (!canChangeStatus && !canChangeAssignee) {
    return (
      <div className={`text-center text-gray-500 ${className}`}>
        <StatusBadge status={currentStatus} showIcon />
        <div className="text-sm mt-2">
          Non hai i permessi per modificare questo ticket
        </div>
      </div>
    )
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('quick')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'quick'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Azioni Rapide
          </button>
          {canChangeStatus && (
            <button
              onClick={() => setActiveTab('status')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'status'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Stato
            </button>
          )}
          {canChangeAssignee && (
            <button
              onClick={() => setActiveTab('assignee')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'assignee'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Assegnazione
            </button>
          )}
          {canManage && onCategoryChange && (
            <button
              onClick={() => setActiveTab('category')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'category'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Categoria
            </button>
          )}
          {canManage && onClinicChange && (
            <button
              onClick={() => setActiveTab('clinic')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'clinic'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Clinica
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'quick' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">
                  Stato Attuale
                </h4>
                <StatusBadge status={currentStatus} showIcon />
              </div>

              {quickActions.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {quickActions.map((action, index) => (
                    <Button
                      key={index}
                      onClick={action.action}
                      variant="outline"
                      size="sm"
                      className="justify-start"
                    >
                      <span className="mr-2">{action.icon}</span>
                      {action.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">
                  Nessuna azione rapida disponibile
                </div>
              )}
            </div>
          )}

          {activeTab === 'status' && canChangeStatus && (
            <StatusSelect
              value={currentStatus}
              onChange={onStatusChange}
              showConfirmation={true}
            />
          )}

          {activeTab === 'assignee' && canChangeAssignee && (
            <AssigneeSelect
              ticketId={ticketId}
              value={currentAssigneeId}
              showSearch={true}
              showUnassign={true}
              onAssigneeChanged={() => {
                // Il componente gestisce internamente la chiamata a Convex
                // Non serve più usare onAssigneeChange
              }}
            />
          )}

          {activeTab === 'category' && canManage && onCategoryChange && (
            <CategorySelect
              value={currentCategoryId}
              onChange={onCategoryChange}
              clinicId={currentClinicId}
            />
          )}

          {activeTab === 'clinic' && canManage && onClinicChange && (
            <ClinicSelect
              value={currentClinicId}
              onChange={onClinicChange}
            />
          )}
        </div>

        {/* Permissions Info */}
        <div className="pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <div>Le tue autorizzazioni:</div>
            <div className="flex flex-wrap gap-2">
              {isCreator && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                  Creatore
                </span>
              )}
              {isAssignee && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                  Assegnatario
                </span>
              )}
              {canManage && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                  Gestione
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}


