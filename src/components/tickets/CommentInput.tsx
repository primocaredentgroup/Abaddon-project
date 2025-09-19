'use client'

import React, { useState, useRef } from 'react'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

interface CommentInputProps {
  onSubmit: (content: string) => Promise<void>
  placeholder?: string
  disabled?: boolean
  maxLength?: number
}

export const CommentInput: React.FC<CommentInputProps> = ({
  onSubmit,
  placeholder = "Scrivi un commento...",
  disabled = false,
  maxLength = 1000,
}) => {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedContent = content.trim()
    if (!trimmedContent) {
      setError('Il commento non può essere vuoto')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await onSubmit(trimmedContent)
      setContent('')
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (error) {
      console.error('Error submitting comment:', error)
      setError('Errore durante l\'invio del commento')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleChange = (value: string) => {
    setContent(value)
    setError('')
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  const canSubmit = content.trim().length > 0 && !isSubmitting && !disabled

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSubmitting}
          className={`min-h-[80px] resize-none ${error ? 'border-red-500' : ''}`}
          maxLength={maxLength}
        />
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-gray-500">
            {content.length}/{maxLength} caratteri
            {!disabled && (
              <span className="ml-2">• Ctrl+Enter per inviare</span>
            )}
          </div>
          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Future: Add attachment button, formatting options, etc. */}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setContent('')}
            disabled={!content || isSubmitting}
          >
            Cancella
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit}
            className="min-w-[80px]"
          >
            {isSubmitting ? 'Invio...' : 'Invia'}
          </Button>
        </div>
      </div>
    </form>
  )
}


