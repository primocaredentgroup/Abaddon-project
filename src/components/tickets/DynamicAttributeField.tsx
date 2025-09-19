'use client'

import React from 'react'
import { CategoryAttribute } from '@/types'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

interface DynamicAttributeFieldProps {
  attribute: CategoryAttribute
  value: any
  onChange: (value: any) => void
  error?: string
  disabled?: boolean
}

export const DynamicAttributeField: React.FC<DynamicAttributeFieldProps> = ({
  attribute,
  value,
  onChange,
  error,
  disabled = false,
}) => {
  const handleChange = (newValue: any) => {
    if (!disabled) {
      onChange(newValue)
    }
  }

  const renderField = () => {
    switch (attribute.type) {
      case 'text':
        return (
          <div className="space-y-1">
            {attribute.config.max && attribute.config.max <= 200 ? (
              <Input
                value={value || ''}
                onChange={handleChange}
                placeholder={attribute.config.placeholder}
                disabled={disabled}
                className={error ? 'border-red-500' : ''}
                maxLength={attribute.config.max}
              />
            ) : (
              <Textarea
                value={value || ''}
                onChange={handleChange}
                placeholder={attribute.config.placeholder}
                disabled={disabled}
                className={error ? 'border-red-500' : ''}
                maxLength={attribute.config.max}
                rows={3}
              />
            )}
            {attribute.config.max && (
              <div className="text-xs text-gray-500 text-right">
                {(value || '').length}/{attribute.config.max}
              </div>
            )}
          </div>
        )

      case 'number':
        return (
          <div className="space-y-1">
            <Input
              type="number"
              value={value || ''}
              onChange={(val) => handleChange(val ? Number(val) : null)}
              placeholder={attribute.config.placeholder}
              disabled={disabled}
              className={error ? 'border-red-500' : ''}
              min={attribute.config.min}
              max={attribute.config.max}
              step={attribute.config.step || 1}
            />
            {attribute.config.unit && (
              <div className="text-xs text-gray-500">
                Unità: {attribute.config.unit}
              </div>
            )}
          </div>
        )

      case 'date':
        return (
          <Input
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ''}
            onChange={(val) => handleChange(val ? new Date(val).toISOString() : null)}
            disabled={disabled}
            className={error ? 'border-red-500' : ''}
            min={attribute.config.minDate}
            max={attribute.config.maxDate}
          />
        )

      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={handleChange}
            disabled={disabled}
          >
            <option value="">Seleziona...</option>
            {attribute.config.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        )

      case 'multiselect':
        return (
          <MultiSelectField
            options={attribute.config.options || []}
            value={value || []}
            onChange={handleChange}
            disabled={disabled}
            error={!!error}
            minSelections={attribute.config.minSelections}
            maxSelections={attribute.config.maxSelections}
          />
        )

      case 'boolean':
        return (
          <BooleanField
            value={value}
            onChange={handleChange}
            disabled={disabled}
            trueLabel={attribute.config.trueLabel || 'Sì'}
            falseLabel={attribute.config.falseLabel || 'No'}
          />
        )

      default:
        return (
          <div className="text-gray-500 italic">
            Tipo di campo non supportato: {attribute.type}
          </div>
        )
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {attribute.name}
        {attribute.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderField()}
      {error && (
        <div className="text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  )
}

// Multi-select component
interface MultiSelectFieldProps {
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  error?: boolean
  minSelections?: number
  maxSelections?: number
}

const MultiSelectField: React.FC<MultiSelectFieldProps> = ({
  options,
  value,
  onChange,
  disabled = false,
  error = false,
  minSelections,
  maxSelections,
}) => {
  const handleOptionToggle = (option: string) => {
    if (disabled) return

    const currentValue = value || []
    const isSelected = currentValue.includes(option)

    if (isSelected) {
      onChange(currentValue.filter(v => v !== option))
    } else {
      if (!maxSelections || currentValue.length < maxSelections) {
        onChange([...currentValue, option])
      }
    }
  }

  return (
    <div className={`border rounded-md p-3 space-y-2 ${error ? 'border-red-500' : 'border-gray-300'}`}>
      {options.map((option) => {
        const isSelected = (value || []).includes(option)
        const canSelect = !maxSelections || (value || []).length < maxSelections
        
        return (
          <label
            key={option}
            className={`flex items-center space-x-2 cursor-pointer ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleOptionToggle(option)}
              disabled={disabled || (!isSelected && !canSelect)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">{option}</span>
          </label>
        )
      })}
      {(minSelections || maxSelections) && (
        <div className="text-xs text-gray-500 mt-2">
          {minSelections && `Min: ${minSelections}`}
          {minSelections && maxSelections && ' - '}
          {maxSelections && `Max: ${maxSelections}`}
          {` (selezionate: ${(value || []).length})`}
        </div>
      )}
    </div>
  )
}

// Boolean field component
interface BooleanFieldProps {
  value: boolean | null | undefined
  onChange: (value: boolean) => void
  disabled?: boolean
  trueLabel: string
  falseLabel: string
}

const BooleanField: React.FC<BooleanFieldProps> = ({
  value,
  onChange,
  disabled = false,
  trueLabel,
  falseLabel,
}) => {
  return (
    <div className="flex space-x-4">
      <label className={`flex items-center space-x-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <input
          type="radio"
          checked={value === true}
          onChange={() => onChange(true)}
          disabled={disabled}
          className="text-blue-600"
        />
        <span className="text-sm">{trueLabel}</span>
      </label>
      <label className={`flex items-center space-x-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <input
          type="radio"
          checked={value === false}
          onChange={() => onChange(false)}
          disabled={disabled}
          className="text-blue-600"
        />
        <span className="text-sm">{falseLabel}</span>
      </label>
    </div>
  )
}


