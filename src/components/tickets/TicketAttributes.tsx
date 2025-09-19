'use client'

import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

interface TicketAttributesProps {
  ticketId: string
  showInList?: boolean
  className?: string
}

export const TicketAttributes: React.FC<TicketAttributesProps> = ({
  ticketId,
  showInList = true,
  className = '',
}) => {
  const attributes = useQuery(
    api.ticketAttributes.getFormattedByTicket,
    { 
      ticketId: ticketId as any,
      showInList 
    }
  )

  if (!attributes || attributes.length === 0) {
    return null
  }

  const getAttributeColor = (type: string) => {
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

  const formatAttributeValue = (value: any, formattedValue: string, type: string) => {
    // If we have a formatted value, use it
    if (formattedValue) {
      return formattedValue
    }

    // Fallback formatting
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">Non specificato</span>
    }

    switch (type) {
      case 'boolean':
        return value ? 'Sì' : 'No'
      case 'multiselect':
        return Array.isArray(value) ? value.join(', ') : String(value)
      default:
        return String(value)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-medium text-gray-700">
        Dettagli Aggiuntivi
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {attributes.map((attribute) => (
          <div
            key={attribute.id}
            className="flex items-start justify-between p-3 bg-gray-50 rounded-md"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium text-gray-900">
                  {attribute.name}
                </span>
                <Badge
                  color={getAttributeColor(attribute.type)}
                  size="sm"
                >
                  {attribute.type}
                </Badge>
              </div>
              <div className="text-sm text-gray-700">
                {formatAttributeValue(attribute.value, attribute.formattedValue, attribute.type)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


