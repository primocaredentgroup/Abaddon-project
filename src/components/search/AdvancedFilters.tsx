'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { TicketStatus } from '@/types'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

interface SearchFilters {
  searchTerm?: string
  status?: TicketStatus[]
  categoryId?: string
  assigneeId?: string
  creatorId?: string
  visibility?: 'public' | 'private'
  dateFrom?: number
  dateTo?: number
  attributes?: Record<string, any>
}

interface AdvancedFiltersProps {
  filters: SearchFilters
  onChange: (filters: Partial<SearchFilters>) => void
  onClear: () => void
  className?: string
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Aperto', color: 'red' },
  { value: 'in_progress', label: 'In Lavorazione', color: 'yellow' },
  { value: 'closed', label: 'Chiuso', color: 'green' },
] as const

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onChange,
  onClear,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // Get data for filter options
  const categories = useQuery(api.categories?.getActiveByClinic, {})
  const users = useQuery(api.users?.getByClinic, {})

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'searchTerm') return false // Don't count search term
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ''
  }).length

  const handleStatusToggle = (status: TicketStatus) => {
    const currentStatuses = filters.status || []
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status]
    
    onChange({ status: newStatuses.length > 0 ? newStatuses : undefined })
  }

  const handleDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    const date = value ? new Date(value).getTime() : undefined
    onChange({ [field]: date })
  }

  const formatDateForInput = (timestamp?: number) => {
    if (!timestamp) return ''
    return new Date(timestamp).toISOString().split('T')[0]
  }

  return (
    <Card className={`${className}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-900">
              Filtri Avanzati
            </h3>
            {activeFilterCount > 0 && (
              <Badge color="blue" size="sm">
                {activeFilterCount} attivi
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {activeFilterCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={onClear}
                className="text-red-600 hover:text-red-700"
              >
                Cancella tutto
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Nascondi' : 'Mostra'} Filtri
            </Button>
          </div>
        </div>

        {/* Quick Filters (always visible) */}
        <div className="space-y-3">
          {/* Status filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stati
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => {
                const isSelected = filters.status?.includes(status.value as TicketStatus)
                return (
                  <button
                    key={status.value}
                    onClick={() => handleStatusToggle(status.value as TicketStatus)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Expanded Filters */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
            {/* Category filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria
              </label>
              <Select
                value={filters.categoryId || ''}
                onValueChange={(value) => onChange({ categoryId: value || undefined })}
              >
                <option value="">Tutte le categorie</option>
                {categories?.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Assignee filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assegnatario
              </label>
              <Select
                value={filters.assigneeId || ''}
                onValueChange={(value) => onChange({ assigneeId: value || undefined })}
              >
                <option value="">Tutti gli utenti</option>
                <option value="unassigned">Non assegnato</option>
                {users?.filter(user => user.isActive).map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Creator filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Creatore
              </label>
              <Select
                value={filters.creatorId || ''}
                onValueChange={(value) => onChange({ creatorId: value || undefined })}
              >
                <option value="">Tutti i creatori</option>
                {users?.filter(user => user.isActive).map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Visibility filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Visibilità
              </label>
              <Select
                value={filters.visibility || ''}
                onValueChange={(value) => onChange({ visibility: value as any || undefined })}
              >
                <option value="">Tutte le visibilità</option>
                <option value="public">Pubblici</option>
                <option value="private">Privati</option>
              </Select>
            </div>

            {/* Date range filters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data da
                </label>
                <Input
                  type="date"
                  value={formatDateForInput(filters.dateFrom)}
                  onChange={(value) => handleDateChange('dateFrom', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data a
                </label>
                <Input
                  type="date"
                  value={formatDateForInput(filters.dateTo)}
                  onChange={(value) => handleDateChange('dateTo', value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active filters summary */}
      {activeFilterCount > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="text-sm text-blue-800 mb-2">
              <strong>Filtri attivi:</strong>
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.status && filters.status.length > 0 && (
                <Badge color="blue" size="sm">
                  Stati: {filters.status.length}
                </Badge>
              )}
              {filters.categoryId && (
                <Badge color="blue" size="sm">
                  Categoria
                </Badge>
              )}
              {filters.assigneeId && (
                <Badge color="blue" size="sm">
                  Assegnatario
                </Badge>
              )}
              {filters.creatorId && (
                <Badge color="blue" size="sm">
                  Creatore
                </Badge>
              )}
              {filters.visibility && (
                <Badge color="blue" size="sm">
                  Visibilità
                </Badge>
              )}
              {(filters.dateFrom || filters.dateTo) && (
                <Badge color="blue" size="sm">
                  Periodo
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}


