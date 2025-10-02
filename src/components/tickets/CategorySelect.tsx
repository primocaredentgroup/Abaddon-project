'use client'

import React, { useState, useMemo } from 'react'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useAuth } from '@/hooks/useAuth'

interface CategorySelectProps {
  value?: string
  onChange: (categoryId: string) => Promise<void>
  disabled?: boolean
  className?: string
  clinicId?: string
}

export const CategorySelect: React.FC<CategorySelectProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  clinicId,
}) => {
  const [isChanging, setIsChanging] = useState(false)
  const [error, setError] = useState('')

  const { user } = useAuth()
  
  // Get categories for the clinic
  const categories = useQuery(
    api.categories.getPublicCategories,
    clinicId ? { clinicId } : "skip"
  )

  const categoryOptions = useMemo(() => {
    if (!categories) return []
    
    return categories.map(category => ({
      value: category._id,
      label: category.name
    }))
  }, [categories])

  const currentCategory = categories?.find(cat => cat._id === value)

  const handleCategoryChange = async (categoryId: string) => {
    if (categoryId === value) return

    setIsChanging(true)
    setError('')

    try {
      await onChange(categoryId)
    } catch (error) {
      console.error('Error changing category:', error)
      setError('Errore durante il cambio categoria')
    } finally {
      setIsChanging(false)
    }
  }

  if (!categories) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Caricamento categorie...
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Nessuna categoria disponibile
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Categoria
        </label>
        
        {/* Current category display */}
        {currentCategory && (
          <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-md mb-2">
            <div className="flex items-center space-x-2">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: currentCategory.color || '#6B7280' }}
              />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {currentCategory.name}
                </div>
                <div className="text-xs text-gray-500">
                  {currentCategory.description || 'Nessuna descrizione'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category selection */}
        <Select
          value={value || ''}
          onChange={(e) => handleCategoryChange(e.target.value)}
          disabled={disabled || isChanging}
          placeholder="Seleziona categoria"
          options={categoryOptions}
        />
      </div>

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}
    </div>
  )
}