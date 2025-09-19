'use client'

import React from 'react'
import { Select } from '@/components/ui/Select'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

interface CategorySelectProps {
  value: string
  onChange: (categoryId: string) => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
}

export const CategorySelect: React.FC<CategorySelectProps> = ({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = "Seleziona categoria...",
}) => {
  const categories = useQuery(api.categories.getActiveByClinic, {})

  if (!categories) {
    return (
      <Select disabled>
        <option>Caricamento categorie...</option>
      </Select>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Categoria
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        className={!value && required ? 'border-red-300' : ''}
      >
        <option value="">{placeholder}</option>
        {categories.map((category) => (
          <option key={category._id} value={category._id}>
            {category.name}
            {category.description && (
              <span className="text-gray-500"> - {category.description}</span>
            )}
          </option>
        ))}
      </Select>
      {!value && required && (
        <div className="text-sm text-red-600 mt-1">
          La categoria è obbligatoria
        </div>
      )}
    </div>
  )
}


