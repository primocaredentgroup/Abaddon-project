'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { CreateTicketData, CategoryAttribute, ValidationError } from '@/types'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CategorySelect } from './CategorySelect'
import { VisibilityToggle } from './VisibilityToggle'
import { DynamicAttributeField } from './DynamicAttributeField'
import { useQuery, useMutation } from 'convex/react'
import { useAttributeValidation } from '@/hooks/useAttributeValidation'
import { api } from '../../../convex/_generated/api'

interface DynamicTicketFormProps {
  onSubmit: (ticket: CreateTicketData) => Promise<void>
  onCancel?: () => void
  initialData?: Partial<CreateTicketData>
  disabled?: boolean
}

export const DynamicTicketForm: React.FC<DynamicTicketFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  disabled = false,
}) => {
  const [formData, setFormData] = useState<CreateTicketData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    categoryId: initialData?.categoryId || '',
    attributes: initialData?.attributes || {},
    visibility: initialData?.visibility || 'private',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [autoSaveData, setAutoSaveData] = useState<string>('')

  const { validateAttribute, validateAllAttributes } = useAttributeValidation()

  // Get current user and clinic settings
  const currentUser = useQuery(api.users.getCurrentUser, {})
  const clinicSettings = currentUser ? useQuery(api.clinics.getById, { clinicId: currentUser.clinicId }) : null

  // Get category attributes when category is selected
  const categoryAttributes = useQuery(
    api.categoryAttributes.getByCategory,
    formData.categoryId 
      ? { 
          categoryId: formData.categoryId as any,
          showInCreation: true 
        }
      : "skip"
  )

  // Evaluate conditions for dynamic visibility
  const visibleAttributes = useMemo(() => {
    if (!categoryAttributes) return []

    return categoryAttributes.filter(attr => {
      if (!attr.conditions) return true
      
      const fieldValue = formData.attributes[attr.conditions.field]
      return evaluateCondition(fieldValue, attr.conditions)
    })
  }, [categoryAttributes, formData.attributes])

  // Auto-save functionality
  useEffect(() => {
    if (formData.title || formData.description || Object.keys(formData.attributes).length > 0) {
      const saveData = JSON.stringify(formData)
      setAutoSaveData(saveData)
      localStorage.setItem('ticket-form-draft', saveData)
    }
  }, [formData])

  // Load auto-saved data on mount
  useEffect(() => {
    if (!initialData) {
      const saved = localStorage.getItem('ticket-form-draft')
      if (saved) {
        try {
          const parsedData = JSON.parse(saved)
          setFormData(prev => ({ ...prev, ...parsedData }))
        } catch (error) {
          console.error('Error loading auto-saved data:', error)
        }
      }
    }
  }, [initialData])

  const handleFieldChange = (field: keyof CreateTicketData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))

    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }))
    }

    // Reset attributes when category changes
    if (field === 'categoryId') {
      setFormData(prev => ({
        ...prev,
        attributes: {},
      }))
    }
  }

  const handleAttributeChange = (slug: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [slug]: value,
      },
    }))

    // Clear attribute error
    if (errors[`attr_${slug}`]) {
      setErrors(prev => ({
        ...prev,
        [`attr_${slug}`]: '',
      }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate basic fields
    if (!formData.title.trim()) {
      newErrors.title = 'Il titolo è obbligatorio'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'La descrizione è obbligatoria'
    }

    if (!formData.categoryId) {
      newErrors.categoryId = 'La categoria è obbligatoria'
    }

    // Validate dynamic attributes
    if (visibleAttributes.length > 0) {
      const attributeErrors = validateAllAttributes(visibleAttributes, formData.attributes)
      attributeErrors.forEach(error => {
        newErrors[`attr_${error.field}`] = error.message
      })
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
      
      // Clear auto-saved data on successful submission
      localStorage.removeItem('ticket-form-draft')
      setAutoSaveData('')
    } catch (error) {
      console.error('Error submitting ticket:', error)
      setErrors(prev => ({
        ...prev,
        submit: 'Errore durante la creazione del ticket. Riprova.',
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClearDraft = () => {
    if (confirm('Sei sicuro di voler cancellare la bozza salvata?')) {
      localStorage.removeItem('ticket-form-draft')
      setAutoSaveData('')
      setFormData({
        title: '',
        description: '',
        categoryId: '',
        attributes: {},
        visibility: 'private',
      })
    }
  }

  const canShowVisibilityToggle = clinicSettings?.settings?.allowPublicTickets

  return (
    <div className="max-w-4xl mx-auto">
      {/* Auto-save indicator */}
      {autoSaveData && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
          <div className="text-sm text-blue-800">
            <strong>Bozza salvata automaticamente</strong> - I tuoi dati sono al sicuro
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearDraft}
            className="text-blue-600"
          >
            Cancella bozza
          </Button>
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header */}
          <div className="border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Nuovo Ticket
            </h2>
            <p className="text-gray-600 mt-1">
              Compila i campi sottostanti per creare un nuovo ticket
            </p>
          </div>

          {/* Basic fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Titolo <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.title}
                onChange={(value) => handleFieldChange('title', value)}
                placeholder="Inserisci un titolo chiaro e descrittivo..."
                disabled={disabled}
                className={errors.title ? 'border-red-500' : ''}
                maxLength={200}
              />
              {errors.title && (
                <div className="text-sm text-red-600 mt-1">{errors.title}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrizione <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={formData.description}
                onChange={(value) => handleFieldChange('description', value)}
                placeholder="Descrivi dettagliatamente il problema o la richiesta..."
                disabled={disabled}
                className={errors.description ? 'border-red-500' : ''}
                rows={4}
                maxLength={2000}
              />
              {errors.description && (
                <div className="text-sm text-red-600 mt-1">{errors.description}</div>
              )}
              <div className="text-xs text-gray-500 text-right mt-1">
                {formData.description.length}/2000 caratteri
              </div>
            </div>

            <CategorySelect
              value={formData.categoryId}
              onChange={(categoryId) => handleFieldChange('categoryId', categoryId)}
              required
              disabled={disabled}
            />
            {errors.categoryId && (
              <div className="text-sm text-red-600">{errors.categoryId}</div>
            )}
          </div>

          {/* Dynamic attributes */}
          {visibleAttributes.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Informazioni Aggiuntive
              </h3>
              <div className="space-y-4">
                {visibleAttributes.map((attribute) => (
                  <DynamicAttributeField
                    key={attribute._id}
                    attribute={attribute}
                    value={formData.attributes[attribute.slug]}
                    onChange={(value) => handleAttributeChange(attribute.slug, value)}
                    error={errors[`attr_${attribute.slug}`]}
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Visibility settings */}
          {canShowVisibilityToggle && (
            <div className="border-t pt-6">
              <VisibilityToggle
                value={formData.visibility}
                onChange={(visibility) => handleFieldChange('visibility', visibility)}
                disabled={disabled}
              />
            </div>
          )}

          {/* Submit error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="text-sm text-red-800">{errors.submit}</div>
            </div>
          )}

          {/* Form actions */}
          <div className="border-t pt-6 flex justify-end space-x-3">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Annulla
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || disabled}
              className="min-w-[120px]"
            >
              {isSubmitting ? 'Creazione...' : 'Crea Ticket'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// Helper function to evaluate conditions
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


