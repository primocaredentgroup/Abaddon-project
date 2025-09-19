'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/Input'

interface EditableTitleProps {
  value: string
  onChange: (value: string) => Promise<void>
  disabled?: boolean
  className?: string
}

export const EditableTitle: React.FC<EditableTitleProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleStartEdit = () => {
    if (!disabled) {
      setIsEditing(true)
      setError('')
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValue(value)
    setError('')
  }

  const handleSave = async () => {
    const trimmedValue = editValue.trim()
    
    if (!trimmedValue) {
      setError('Il titolo non può essere vuoto')
      return
    }

    if (trimmedValue === value) {
      setIsEditing(false)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await onChange(trimmedValue)
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating title:', error)
      setError('Errore durante il salvataggio')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className="space-y-2">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={setEditValue}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className={error ? 'border-red-500' : ''}
          maxLength={200}
          placeholder="Inserisci il titolo..."
        />
        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Salvataggio...' : 'Salva'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="text-sm bg-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-400 disabled:opacity-50"
          >
            Annulla
          </button>
        </div>
      </div>
    )
  }

  return (
    <h1
      onClick={handleStartEdit}
      className={`text-xl font-semibold cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${className}`}
      title={disabled ? 'Non puoi modificare questo titolo' : 'Clicca per modificare'}
    >
      {value}
    </h1>
  )
}


