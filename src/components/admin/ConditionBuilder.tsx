'use client'

import React from 'react'
import { AttributeCondition } from '@/types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface ConditionBuilderProps {
  condition?: AttributeCondition
  availableFields: { slug: string; name: string; type: string }[]
  onChange: (condition: AttributeCondition | undefined) => void
}

const OPERATORS = [
  { value: 'equals', label: 'è uguale a', types: ['text', 'number', 'date', 'select', 'boolean'] },
  { value: 'not_equals', label: 'è diverso da', types: ['text', 'number', 'date', 'select', 'boolean'] },
  { value: 'contains', label: 'contiene', types: ['text'] },
  { value: 'greater_than', label: 'è maggiore di', types: ['number', 'date'] },
  { value: 'less_than', label: 'è minore di', types: ['number', 'date'] },
]

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  condition,
  availableFields,
  onChange,
}) => {
  const selectedField = availableFields.find(f => f.slug === condition?.field)
  const availableOperators = OPERATORS.filter(op => 
    !selectedField || op.types.includes(selectedField.type)
  )

  const handleFieldChange = (fieldSlug: string) => {
    if (!fieldSlug) {
      onChange(undefined)
      return
    }

    const field = availableFields.find(f => f.slug === fieldSlug)
    if (!field) return

    // Reset operator and value when field changes
    onChange({
      field: fieldSlug,
      operator: 'equals',
      value: getDefaultValueForType(field.type),
    })
  }

  const handleOperatorChange = (operator: string) => {
    if (!condition) return

    onChange({
      ...condition,
      operator: operator as AttributeCondition['operator'],
    })
  }

  const handleValueChange = (value: any) => {
    if (!condition) return

    onChange({
      ...condition,
      value,
    })
  }

  const renderValueInput = () => {
    if (!condition || !selectedField) return null

    switch (selectedField.type) {
      case 'text':
        return (
          <Input
            value={condition.value || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Inserisci valore..."
          />
        )

      case 'number':
        return (
          <Input
            type="number"
            value={condition.value || ''}
            onChange={(e) => handleValueChange(e.target.value ? Number(e.target.value) : '')}
            placeholder="Inserisci numero..."
          />
        )

      case 'date':
        return (
          <Input
            type="date"
            value={condition.value ? new Date(condition.value).toISOString().split('T')[0] : ''}
            onChange={(e) => handleValueChange(e.target.value ? new Date(e.target.value).toISOString() : '')}
          />
        )

      case 'boolean':
        return (
          <select
            value={condition.value?.toString() || ''}
            onChange={(e) => handleValueChange(e.target.value === 'true')}
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleziona...</option>
            <option value="true">Vero</option>
            <option value="false">Falso</option>
          </select>
        )

      case 'select':
        // In a real implementation, you'd get the options from the field configuration
        return (
          <Input
            value={condition.value || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Inserisci valore..."
          />
        )

      default:
        return (
          <Input
            value={condition.value || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Inserisci valore..."
          />
        )
    }
  }

  const getConditionDescription = () => {
    if (!condition || !selectedField) return ''

    const field = selectedField.name
    const operator = OPERATORS.find(op => op.value === condition.operator)?.label || condition.operator
    const value = formatValueForDisplay(condition.value, selectedField.type)

    return `Mostra questo campo quando "${field}" ${operator} "${value}"`
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Condizione di Visibilità</h4>
          {condition && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange(undefined)}
            >
              Rimuovi Condizione
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Campo</label>
            <select
              value={condition?.field || ''}
              onChange={(e) => handleFieldChange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Nessuna condizione</option>
              {availableFields.map((field) => (
                <option key={field.slug} value={field.slug}>
                  {field.name}
                </option>
              ))}
            </select>
          </div>

          {condition && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Operatore</label>
                <select
                  value={condition.operator}
                  onChange={(e) => handleOperatorChange(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableOperators.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Valore</label>
                {renderValueInput()}
              </div>
            </>
          )}
        </div>

        {condition && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="text-sm text-blue-800">
              <strong>Regola:</strong> {getConditionDescription()}
            </div>
          </div>
        )}

        {!condition && (
          <div className="text-sm text-gray-500 italic">
            Questo campo sarà sempre visibile. Aggiungi una condizione per mostrarlo solo in determinati casi.
          </div>
        )}
      </div>
    </Card>
  )
}

function getDefaultValueForType(type: string): any {
  switch (type) {
    case 'text':
      return ''
    case 'number':
      return 0
    case 'boolean':
      return false
    case 'date':
      return new Date().toISOString()
    default:
      return ''
  }
}

function formatValueForDisplay(value: any, type: string): string {
  if (value === null || value === undefined) return ''

  switch (type) {
    case 'boolean':
      return value ? 'Vero' : 'Falso'
    case 'date':
      return new Date(value).toLocaleDateString('it-IT')
    default:
      return String(value)
  }
}


