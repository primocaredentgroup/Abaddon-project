'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/Textarea'

interface EditableDescriptionProps {
  value: string
  onChange: (value: string) => Promise<void>
  disabled?: boolean
  className?: string
}

export const EditableDescription: React.FC<EditableDescriptionProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
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
      setError('La descrizione non può essere vuota')
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
      console.error('Error updating description:', error)
      setError('Errore durante il salvataggio')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
    // Allow Ctrl+Enter to save
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleSave()
    }
  }

  const formatDescription = (text: string) => {
    // Simple formatting: preserve line breaks and make it readable
    return text.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ))
  }

  if (isEditing) {
    return (
      <div className="space-y-2">
        <Textarea
          ref={textareaRef}
          value={editValue}
          onChange={setEditValue}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className={error ? 'border-red-500' : ''}
          rows={6}
          maxLength={2000}
          placeholder="Inserisci la descrizione..."
        />
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {editValue.length}/2000 caratteri • Ctrl+Enter per salvare
          </div>
          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}
        </div>
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
    <div
      onClick={handleStartEdit}
      className={`prose prose-sm max-w-none cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${className}`}
      title={disabled ? 'Non puoi modificare questa descrizione' : 'Clicca per modificare'}
    >
      {formatDescription(value)}
    </div>
  )
}


