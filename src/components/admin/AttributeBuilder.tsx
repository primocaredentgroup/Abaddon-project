'use client'

import React, { useState, useCallback } from 'react'
import { CategoryAttribute, AttributeType, AttributeConfig, AttributeCondition } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { AttributeCard } from './AttributeCard'
import { AttributeTypeSelector } from './AttributeTypeSelector'
import { ConditionBuilder } from './ConditionBuilder'
import { TicketFormPreview } from './TicketFormPreview'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

interface AttributeBuilderProps {
  categoryId: string
  categoryName?: string
  initialAttributes?: CategoryAttribute[]
  onSave: (attributes: (Partial<CategoryAttribute> & { id: string })[], deletedIds?: string[]) => Promise<void>
}

type EditingAttribute = Partial<CategoryAttribute> & {
  id: string
  isNew?: boolean
}

export const AttributeBuilder: React.FC<AttributeBuilderProps> = ({
  categoryId,
  categoryName,
  initialAttributes = [],
  onSave,
}) => {
  // Convert initial attributes to editing format
  const [attributes, setAttributes] = useState<EditingAttribute[]>(() =>
    initialAttributes.map((attr, index) => ({
      ...attr,
      id: attr._id || `temp-${index}`,
      order: attr.order || index,
    }))
  )

  const [editingAttribute, setEditingAttribute] = useState<EditingAttribute | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [deletedAttributeIds, setDeletedAttributeIds] = useState<string[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setAttributes((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        const newItems = arrayMove(items, oldIndex, newIndex)
        // Update order property
        return newItems.map((item, index) => ({
          ...item,
          order: index,
        }))
      })
    }
  }, [])

  const handleAddAttribute = () => {
    const newAttribute: EditingAttribute = {
      id: `new-${Date.now()}`,
      name: '',
      slug: '',
      type: 'text' as AttributeType,
      required: false,
      showInCreation: true,
      showInList: false,
      order: attributes.length,
      config: {},
      isNew: true,
    }
    setEditingAttribute(newAttribute)
    setIsModalOpen(true)
  }

  const handleEditAttribute = (attribute: EditingAttribute) => {
    setEditingAttribute(attribute)
    setIsModalOpen(true)
  }

  const handleDeleteAttribute = (id: string) => {
    // Se l'attributo ha un _id (esiste nel DB), aggiungerlo alla lista degli eliminati
    const attrToDelete = attributes.find(attr => attr.id === id)
    
    if (attrToDelete?._id && !id.startsWith('new-')) {
      setDeletedAttributeIds(prev => [...prev, id])
    }
    
    // Rimuovere dall'interfaccia
    setAttributes(prev => prev.filter(attr => attr.id !== id))
  }

  const handleSaveAttribute = (updatedAttribute: EditingAttribute) => {
    setAttributes(prev => {
      const existingIndex = prev.findIndex(attr => attr.id === updatedAttribute.id)
      if (existingIndex >= 0) {
        // Update existing
        const newAttributes = [...prev]
        newAttributes[existingIndex] = { ...updatedAttribute, isNew: false }
        return newAttributes
      } else {
        // Add new
        return [...prev, { ...updatedAttribute, isNew: false }]
      }
    })
    setEditingAttribute(null)
    setIsModalOpen(false)
  }

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      // 🔧 Mappa gli attributi nel formato corretto per il salvataggio
      const attributesToSave = attributes.map(attr => ({
        ...attr,
        _id: attr.id.startsWith('new-') ? undefined : attr.id, // Se è un ID temporaneo, rimuovilo
        isNew: attr.isNew || attr.id.startsWith('new-'), // Marca come nuovo se è un ID temporaneo
      }))
      
      // Passa anche gli ID degli attributi da eliminare
      await onSave(attributesToSave, deletedAttributeIds)
      
      // Reset della lista degli eliminati dopo il salvataggio
      setDeletedAttributeIds([])
    } catch (error) {
      console.error('Error saving attributes:', error)
      alert('Errore nel salvataggio degli attributi')
    } finally {
      setIsSaving(false)
    }
  }

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  }

  const availableFieldsForConditions = attributes
    .filter(attr => attr.slug && attr.type)
    .map(attr => ({
      slug: attr.slug!,
      name: attr.name || attr.slug!,
      type: attr.type!,
    }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Configurazione Attributi
          </h2>
          {categoryName && (
            <p className="text-gray-600 mt-1">
              Categoria: {categoryName}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
          >
            {previewMode ? 'Nascondi Anteprima' : 'Mostra Anteprima'}
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={isSaving}
          >
            {isSaving ? 'Salvataggio...' : 'Salva Tutto'}
          </Button>
        </div>
      </div>

      <div className={`grid ${previewMode ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>
        {/* Builder Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Attributi ({attributes.length})</h3>
            <Button onClick={handleAddAttribute}>
              Aggiungi Attributo
            </Button>
          </div>

          {attributes.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">
              <div className="space-y-2">
                <p>Nessun attributo configurato</p>
                <p className="text-sm">Aggiungi il primo attributo per iniziare</p>
                <Button onClick={handleAddAttribute} className="mt-4">
                  Aggiungi Primo Attributo
                </Button>
              </div>
            </Card>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={attributes.map(attr => attr.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {attributes.map((attribute, index) => (
                    <AttributeCard
                      key={attribute.id}
                      attribute={attribute}
                      index={index}
                      onEdit={handleEditAttribute}
                      onDelete={handleDeleteAttribute}
                      isEditing={editingAttribute?.id === attribute.id}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Preview Panel */}
        {previewMode && (
          <div className="border-l pl-6">
            <TicketFormPreview
              categoryId={categoryId}
              categoryName={categoryName}
              attributes={attributes}
            />
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingAttribute && (
        <AttributeEditModal
          attribute={editingAttribute}
          availableFields={availableFieldsForConditions}
          onSave={handleSaveAttribute}
          onCancel={() => {
            setEditingAttribute(null)
            setIsModalOpen(false)
          }}
          onSlugGenerate={generateSlug}
        />
      )}
    </div>
  )
}

// Attribute Edit Modal Component
interface AttributeEditModalProps {
  attribute: EditingAttribute
  availableFields: { slug: string; name: string; type: string }[]
  onSave: (attribute: EditingAttribute) => void
  onCancel: () => void
  onSlugGenerate: (name: string) => string
}

const AttributeEditModal: React.FC<AttributeEditModalProps> = ({
  attribute,
  availableFields,
  onSave,
  onCancel,
  onSlugGenerate,
}) => {
  const [formData, setFormData] = useState<EditingAttribute>(attribute)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleFieldChange = (field: keyof EditingAttribute, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))

    // Auto-generate slug when name changes
    if (field === 'name' && typeof value === 'string') {
      const slug = onSlugGenerate(value)
      setFormData(prev => ({
        ...prev,
        slug,
      }))
    }

    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }))
    }
  }

  const handleTypeChange = (type: AttributeType) => {
    setFormData(prev => ({
      ...prev,
      type,
      config: {}, // Reset config when type changes
    }))
  }

  const handleConfigChange = (config: AttributeConfig) => {
    setFormData(prev => ({
      ...prev,
      config,
    }))
  }

  const handleConditionChange = (conditions: AttributeCondition | undefined) => {
    setFormData(prev => ({
      ...prev,
      conditions,
    }))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name?.trim()) {
      newErrors.name = 'Il nome è obbligatorio'
    }

    if (!formData.slug?.trim()) {
      newErrors.slug = 'Lo slug è obbligatorio'
    }

    if (!formData.type) {
      newErrors.type = 'Il tipo è obbligatorio'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h3 className="text-lg font-medium">
            {attribute.isNew ? 'Nuovo Attributo' : 'Modifica Attributo'}
          </h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Nome <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="Nome dell'attributo"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <div className="text-sm text-red-600 mt-1">{errors.name}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Slug <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.slug || ''}
                onChange={(e) => handleFieldChange('slug', e.target.value)}
                placeholder="slug_attributo"
                className={errors.slug ? 'border-red-500' : ''}
              />
              {errors.slug && (
                <div className="text-sm text-red-600 mt-1">{errors.slug}</div>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.required || false}
                onChange={(e) => handleFieldChange('required', e.target.checked)}
              />
              <span className="text-sm">Obbligatorio</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.showInCreation || false}
                onChange={(e) => handleFieldChange('showInCreation', e.target.checked)}
              />
              <span className="text-sm">Mostra in creazione</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.showInList || false}
                onChange={(e) => handleFieldChange('showInList', e.target.checked)}
              />
              <span className="text-sm">Mostra in lista</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={(formData as any).agentOnly || false}
                onChange={(e) => handleFieldChange('agentOnly' as any, e.target.checked)}
              />
              <span className="text-sm">Solo per agenti</span>
            </label>
          </div>

          {/* Type Configuration */}
          <div>
            <h4 className="font-medium mb-3">Configurazione Tipo</h4>
            <AttributeTypeSelector
              selectedType={formData.type || ''}
              config={formData.config || {}}
              onTypeChange={handleTypeChange}
              onConfigChange={handleConfigChange}
              showPreview={false}
            />
          </div>

          {/* Conditions */}
          <div>
            <h4 className="font-medium mb-3">Condizioni di Visibilità</h4>
            <ConditionBuilder
              condition={formData.conditions}
              availableFields={availableFields.filter(field => field.slug !== formData.slug)}
              onChange={handleConditionChange}
            />
          </div>
        </div>

        <div className="p-6 border-t flex justify-end space-x-3">
          <Button variant="outline" onClick={onCancel}>
            Annulla
          </Button>
          <Button onClick={handleSave}>
            Salva Attributo
          </Button>
        </div>
      </div>
    </div>
  )
}


