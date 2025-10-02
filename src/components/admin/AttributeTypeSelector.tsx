'use client'

import React, { useState } from 'react'
import { AttributeType, AttributeConfig } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface AttributeTypeSelectorProps {
  selectedType: AttributeType | ''
  config: AttributeConfig
  onTypeChange: (type: AttributeType) => void
  onConfigChange: (config: AttributeConfig) => void
  showPreview?: boolean
}

const ATTRIBUTE_TYPES: { value: AttributeType; label: string; description: string }[] = [
  { value: 'text', label: 'Testo', description: 'Campo di testo libero' },
  { value: 'number', label: 'Numero', description: 'Campo numerico con validazione' },
  { value: 'date', label: 'Data', description: 'Selettore di data' },
  { value: 'select', label: 'Selezione', description: 'Menu a discesa con opzioni predefinite' },
  { value: 'multiselect', label: 'Selezione multipla', description: 'Checkbox multipli' },
  { value: 'boolean', label: 'Sì/No', description: 'Campo booleano vero/falso' },
]

export const AttributeTypeSelector: React.FC<AttributeTypeSelectorProps> = ({
  selectedType,
  config,
  onTypeChange,
  onConfigChange,
  showPreview = true,
}) => {
  const [options, setOptions] = useState<string[]>(config.options || [])
  const [newOption, setNewOption] = useState('')

  const handleTypeChange = (type: string) => {
    if (type && type !== selectedType) {
      onTypeChange(type as AttributeType)
      // Reset config when type changes
      onConfigChange({})
      setOptions([])
    }
  }

  const handleConfigChange = (key: keyof AttributeConfig, value: any) => {
    onConfigChange({
      ...config,
      [key]: value,
    })
  }

  const handleAddOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      const updatedOptions = [...options, newOption.trim()]
      setOptions(updatedOptions)
      handleConfigChange('options', updatedOptions)
      setNewOption('')
    }
  }

  const handleRemoveOption = (index: number) => {
    const updatedOptions = options.filter((_, i) => i !== index)
    setOptions(updatedOptions)
    handleConfigChange('options', updatedOptions)
  }

  const renderTypeConfiguration = () => {
    if (!selectedType) return null

    switch (selectedType) {
      case 'text':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Placeholder</label>
              <Input
                value={config.placeholder || ''}
                onChange={(e) => handleConfigChange('placeholder', e.target.value)}
                placeholder="Testo di esempio..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Lunghezza minima</label>
                <Input
                  type="number"
                  value={config.min || ''}
                  onChange={(e) => handleConfigChange('min', e.target.value ? Number(e.target.value) : undefined)}
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Lunghezza massima</label>
                <Input
                  type="number"
                  value={config.max || ''}
                  onChange={(e) => handleConfigChange('max', e.target.value ? Number(e.target.value) : undefined)}
                  min={1}
                />
              </div>
            </div>
          </div>
        )

      case 'number':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Placeholder</label>
              <Input
                value={config.placeholder || ''}
                onChange={(e) => handleConfigChange('placeholder', e.target.value)}
                placeholder="Inserisci un numero..."
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Valore minimo</label>
                <Input
                  type="number"
                  value={config.min || ''}
                  onChange={(e) => handleConfigChange('min', e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Valore massimo</label>
                <Input
                  type="number"
                  value={config.max || ''}
                  onChange={(e) => handleConfigChange('max', e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Unità di misura</label>
                <Input
                  value={config.unit || ''}
                  onChange={(e) => handleConfigChange('unit', e.target.value)}
                  placeholder="es. kg, cm, €"
                />
              </div>
            </div>
          </div>
        )

      case 'date':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Data minima</label>
                <Input
                  type="date"
                  value={config.minDate || ''}
                  onChange={(e) => handleConfigChange('minDate', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Data massima</label>
                <Input
                  type="date"
                  value={config.maxDate || ''}
                  onChange={(e) => handleConfigChange('maxDate', e.target.value)}
                />
              </div>
            </div>
          </div>
        )

      case 'select':
      case 'multiselect':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Opzioni</label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={option}
                      onChange={(e) => {
                        const updatedOptions = [...options]
                        updatedOptions[index] = e.target.value
                        setOptions(updatedOptions)
                        handleConfigChange('options', updatedOptions)
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveOption(index)}
                    >
                      Rimuovi
                    </Button>
                  </div>
                ))}
                <div className="flex items-center space-x-2">
                  <Input
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="Nuova opzione..."
                    className="flex-1"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddOption()}
                  />
                  <Button onClick={handleAddOption}>Aggiungi</Button>
                </div>
              </div>
            </div>
            {selectedType === 'multiselect' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Selezioni minime</label>
                  <Input
                    type="number"
                    value={config.minSelections || ''}
                    onChange={(e) => handleConfigChange('minSelections', e.target.value ? Number(e.target.value) : undefined)}
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Selezioni massime</label>
                  <Input
                    type="number"
                    value={config.maxSelections || ''}
                    onChange={(e) => handleConfigChange('maxSelections', e.target.value ? Number(e.target.value) : undefined)}
                    min={1}
                  />
                </div>
              </div>
            )}
          </div>
        )

      case 'boolean':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Etichetta per "Vero"</label>
                <Input
                  value={config.trueLabel || 'Sì'}
                  onChange={(e) => handleConfigChange('trueLabel', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Etichetta per "Falso"</label>
                <Input
                  value={config.falseLabel || 'No'}
                  onChange={(e) => handleConfigChange('falseLabel', e.target.value)}
                />
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const renderPreview = () => {
    if (!selectedType || !showPreview) return null

    const mockAttribute = {
      _id: 'preview',
      categoryId: 'preview',
      name: 'Anteprima Campo',
      slug: 'preview',
      type: selectedType,
      required: false,
      showInCreation: true,
      showInList: true,
      order: 0,
      config,
      clinicId: 'preview',
      isActive: true,
      _creationTime: Date.now(),
    }

    return (
      <Card className="p-4">
        <h4 className="font-medium mb-3">Anteprima</h4>
        <div className="border-2 border-dashed border-gray-200 p-4 rounded-md">
          {/* Preview would use DynamicAttributeField here */}
          <div className="text-sm text-gray-600">
            Anteprima del campo "{selectedType}" con configurazione corrente
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Tipo di Campo</label>
        <select 
          value={selectedType} 
          onChange={(e) => handleTypeChange(e.target.value as AttributeType)}
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Seleziona tipo...</option>
          {ATTRIBUTE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        {selectedType && (
          <div className="mt-2 text-sm text-gray-600">
            {ATTRIBUTE_TYPES.find(t => t.value === selectedType)?.description}
          </div>
        )}
      </div>

      {renderTypeConfiguration()}
      {renderPreview()}
    </div>
  )
}


