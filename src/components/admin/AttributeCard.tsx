'use client'

import React, { useState } from 'react'
import { CategoryAttribute, AttributeType } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface AttributeCardProps {
  attribute: Partial<CategoryAttribute> & { id: string }
  index: number
  onEdit: (attribute: Partial<CategoryAttribute> & { id: string }) => void
  onDelete: (id: string) => void
  isEditing?: boolean
}

const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  text: 'Testo',
  number: 'Numero',
  date: 'Data',
  select: 'Selezione',
  multiselect: 'Selezione multipla',
  boolean: 'Sì/No',
}

export const AttributeCard: React.FC<AttributeCardProps> = ({
  attribute,
  index,
  onEdit,
  onDelete,
  isEditing = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: attribute.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const getTypeColor = (type?: AttributeType) => {
    switch (type) {
      case 'text': return 'blue'
      case 'number': return 'green'
      case 'date': return 'purple'
      case 'select': return 'orange'
      case 'multiselect': return 'orange'
      case 'boolean': return 'gray'
      default: return 'gray'
    }
  }

  const getConfigSummary = () => {
    if (!attribute.config) return ''

    const parts: string[] = []

    if (attribute.config.options?.length) {
      parts.push(`${attribute.config.options.length} opzioni`)
    }

    if (attribute.config.min !== undefined || attribute.config.max !== undefined) {
      if (attribute.type === 'text') {
        parts.push(`${attribute.config.min || 0}-${attribute.config.max || '∞'} caratteri`)
      } else if (attribute.type === 'number') {
        parts.push(`${attribute.config.min || '-∞'}-${attribute.config.max || '∞'}`)
      }
    }

    if (attribute.config.unit) {
      parts.push(`unità: ${attribute.config.unit}`)
    }

    return parts.join(', ')
  }

  const hasCondition = attribute.conditions?.field

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`mb-3 ${isDragging ? 'z-50' : ''}`}
    >
      <Card className={`p-4 border-l-4 ${isEditing ? 'border-l-blue-500 bg-blue-50' : 'border-l-gray-300'} hover:shadow-md transition-shadow`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            {/* Drag handle */}
            <div
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
              </svg>
            </div>

            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="font-medium text-gray-900">
                  {attribute.name || 'Nuovo Attributo'}
                </h4>
                {attribute.required && (
                  <Badge variant="outline" className="text-red-600 border-red-600">
                    Obbligatorio
                  </Badge>
                )}
                {(attribute as any).agentOnly && (
                  <Badge variant="outline" className="text-purple-600 border-purple-600">
                    Solo Agenti
                  </Badge>
                )}
                {hasCondition && (
                  <Badge variant="outline" className="text-blue-600 border-blue-600">
                    Condizionale
                  </Badge>
                )}
              </div>

              <div className="flex items-center space-x-2 text-sm text-gray-600">
                {attribute.type && (
                  <Badge color={getTypeColor(attribute.type)}>
                    {ATTRIBUTE_TYPE_LABELS[attribute.type]}
                  </Badge>
                )}
                <span>#{index + 1}</span>
                {attribute.slug && (
                  <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                    {attribute.slug}
                  </span>
                )}
              </div>

              {(attribute.showInCreation || attribute.showInList || (attribute as any).agentOnly) && (
                <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                  {attribute.showInCreation && (
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                      Creazione
                    </span>
                  )}
                  {attribute.showInList && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      Lista
                    </span>
                  )}
                  {(attribute as any).agentOnly && (
                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      👤 Solo Agenti
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Nascondi' : 'Dettagli'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(attribute)}
            >
              Modifica
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(attribute.id)
              }}
              className="text-red-600 hover:text-red-700 hover:border-red-300"
            >
              Elimina
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
            {attribute.config && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-1">Configurazione</h5>
                <div className="text-sm text-gray-600">
                  {getConfigSummary() || 'Nessuna configurazione speciale'}
                </div>
              </div>
            )}

            {hasCondition && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-1">Condizione</h5>
                <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                  Mostra quando "{attribute.conditions?.field}" {attribute.conditions?.operator} "{attribute.conditions?.value}"
                </div>
              </div>
            )}

            {attribute.config?.options && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-1">Opzioni</h5>
                <div className="flex flex-wrap gap-1">
                  {attribute.config.options.slice(0, 5).map((option, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                    >
                      {option}
                    </span>
                  ))}
                  {attribute.config.options.length > 5 && (
                    <span className="text-xs text-gray-500">
                      +{attribute.config.options.length - 5} altre
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}


