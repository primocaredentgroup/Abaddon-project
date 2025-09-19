import { useState, useCallback } from 'react'
import { AttributeType, CategoryAttribute, ValidationError } from '@/types'

interface UseAttributeValidationReturn {
  validateAttribute: (attribute: CategoryAttribute, value: any) => ValidationError | null
  validateAllAttributes: (attributes: CategoryAttribute[], values: Record<string, any>) => ValidationError[]
  isValidating: boolean
}

export function useAttributeValidation(): UseAttributeValidationReturn {
  const [isValidating, setIsValidating] = useState(false)

  const validateAttribute = useCallback((attribute: CategoryAttribute, value: any): ValidationError | null => {
    // Check required fields
    if (attribute.required && (value === undefined || value === null || value === '')) {
      return {
        field: attribute.slug,
        message: `${attribute.name} è obbligatorio`,
      }
    }

    // Skip validation if value is empty and not required
    if (value === undefined || value === null || value === '') {
      return null
    }

    // Type-specific validation
    switch (attribute.type) {
      case 'text':
        if (typeof value !== 'string') {
          return { field: attribute.slug, message: 'Deve essere un testo' }
        }
        if (attribute.config.min && value.length < attribute.config.min) {
          return { field: attribute.slug, message: `Minimo ${attribute.config.min} caratteri` }
        }
        if (attribute.config.max && value.length > attribute.config.max) {
          return { field: attribute.slug, message: `Massimo ${attribute.config.max} caratteri` }
        }
        break

      case 'number':
        const num = Number(value)
        if (isNaN(num)) {
          return { field: attribute.slug, message: 'Deve essere un numero' }
        }
        if (attribute.config.min !== undefined && num < attribute.config.min) {
          return { field: attribute.slug, message: `Valore minimo: ${attribute.config.min}` }
        }
        if (attribute.config.max !== undefined && num > attribute.config.max) {
          return { field: attribute.slug, message: `Valore massimo: ${attribute.config.max}` }
        }
        break

      case 'date':
        if (typeof value !== 'string' && typeof value !== 'number') {
          return { field: attribute.slug, message: 'Deve essere una data valida' }
        }
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          return { field: attribute.slug, message: 'Deve essere una data valida' }
        }
        break

      case 'select':
        if (!attribute.config.options?.includes(value)) {
          return { field: attribute.slug, message: 'Valore non valido' }
        }
        break

      case 'multiselect':
        if (!Array.isArray(value)) {
          return { field: attribute.slug, message: 'Deve essere una lista' }
        }
        const invalidOptions = value.filter(v => !attribute.config.options?.includes(v))
        if (invalidOptions.length > 0) {
          return { field: attribute.slug, message: 'Contiene valori non validi' }
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean') {
          return { field: attribute.slug, message: 'Deve essere vero o falso' }
        }
        break
    }

    return null
  }, [])

  const validateAllAttributes = useCallback((
    attributes: CategoryAttribute[], 
    values: Record<string, any>
  ): ValidationError[] => {
    setIsValidating(true)
    
    const errors: ValidationError[] = []
    
    for (const attribute of attributes) {
      const value = values[attribute.slug]
      const error = validateAttribute(attribute, value)
      if (error) {
        errors.push(error)
      }
    }
    
    setIsValidating(false)
    return errors
  }, [validateAttribute])

  return {
    validateAttribute,
    validateAllAttributes,
    isValidating,
  }
}


