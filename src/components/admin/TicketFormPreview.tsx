'use client'

import React, { useState, useMemo } from 'react'
import { CategoryAttribute } from '@/types'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { DynamicAttributeField } from '@/components/tickets/DynamicAttributeField'

interface TicketFormPreviewProps {
  categoryId?: string
  attributes: (Partial<CategoryAttribute> & { id: string })[]
  categoryName?: string
}

export const TicketFormPreview: React.FC<TicketFormPreviewProps> = ({
  attributes,
  categoryName = 'Categoria Esempio',
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({
    title: 'Esempio di ticket',
    description: 'Questa è una descrizione di esempio per mostrare come apparirà il form.',
  })

  // Convert partial attributes to full attributes for preview
  const previewAttributes = useMemo(() => {
    return attributes
      .filter(attr => attr.showInCreation && attr.type && attr.name && attr.slug)
      .map(attr => ({
        _id: attr.id,
        categoryId: 'preview',
        name: attr.name!,
        slug: attr.slug!,
        type: attr.type!,
        required: attr.required || false,
        showInCreation: true,
        showInList: attr.showInList || false,
        order: attr.order || 0,
        config: attr.config || {},
        conditions: attr.conditions,
        clinicId: 'preview',
        isActive: true,
        _creationTime: Date.now(),
      }))
      .sort((a, b) => a.order - b.order)
  }, [attributes])

  // Filter attributes based on conditions
  const visibleAttributes = useMemo(() => {
    return previewAttributes.filter(attr => {
      if (!attr.conditions) return true
      
      const fieldValue = formData[attr.conditions.field]
      return evaluateCondition(fieldValue, attr.conditions)
    })
  }, [previewAttributes, formData])

  const handleAttributeChange = (slug: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [slug]: value,
    }))
  }

  const handleBasicFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Anteprima Form Creazione Ticket
        </h3>
        <span className="text-sm text-gray-500">
          {visibleAttributes.length} campi visibili
        </span>
      </div>

      <Card className="p-6 bg-gray-50">
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          {/* Basic fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Titolo <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.title}
                onChange={(value) => handleBasicFieldChange('title', value)}
                placeholder="Inserisci il titolo del ticket..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrizione <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={formData.description}
                onChange={(value) => handleBasicFieldChange('description', value)}
                placeholder="Descrivi il problema o la richiesta..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria <span className="text-red-500">*</span>
              </label>
              <div className="p-3 bg-white border border-gray-300 rounded-md text-gray-700">
                {categoryName}
              </div>
            </div>
          </div>

          {/* Dynamic attributes */}
          {visibleAttributes.length > 0 && (
            <div className="border-t pt-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">
                Informazioni Aggiuntive
              </h4>
              <div className="space-y-4">
                {visibleAttributes.map((attribute) => (
                  <DynamicAttributeField
                    key={attribute._id}
                    attribute={attribute}
                    value={formData[attribute.slug]}
                    onChange={(value) => handleAttributeChange(attribute.slug, value)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Form actions */}
          <div className="border-t pt-6 flex justify-end space-x-3">
            <Button variant="outline">
              Annulla
            </Button>
            <Button type="submit">
              Crea Ticket
            </Button>
          </div>
        </form>
      </Card>

      {/* Preview info */}
      <div className="text-sm text-gray-600 space-y-2">
        <div className="flex justify-between">
          <span>Campi totali configurati:</span>
          <span className="font-medium">{previewAttributes.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Campi obbligatori:</span>
          <span className="font-medium text-red-600">
            {previewAttributes.filter(attr => attr.required).length + 2} {/* +2 for title and description */}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Campi con condizioni:</span>
          <span className="font-medium text-blue-600">
            {previewAttributes.filter(attr => attr.conditions).length}
          </span>
        </div>
        {previewAttributes.some(attr => attr.conditions) && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-sm text-blue-800">
              <strong>Nota:</strong> Alcuni campi sono condizionali e appariranno solo quando vengono soddisfatte determinate condizioni.
              Prova a modificare i valori sopra per vedere i campi condizionali in azione.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper function to evaluate conditions (simplified version)
function evaluateCondition(fieldValue: any, condition: any): boolean {
  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value
    case 'not_equals':
      return fieldValue !== condition.value
    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(condition.value)
    case 'greater_than':
      return Number(fieldValue) > Number(condition.value)
    case 'less_than':
      return Number(fieldValue) < Number(condition.value)
    default:
      return true
  }
}


