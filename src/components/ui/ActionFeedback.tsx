'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './Button'
import { LoadingState } from './LoadingState'

interface ActionFeedbackProps {
  children: React.ReactNode
  isLoading?: boolean
  success?: boolean
  error?: string | null
  loadingText?: string
  successText?: string
  successDuration?: number
  disabled?: boolean
  className?: string
  onClick?: () => void | Promise<void>
}

export const ActionFeedback: React.FC<ActionFeedbackProps> = ({
  children,
  isLoading = false,
  success = false,
  error = null,
  loadingText = 'Caricamento...',
  successText = 'Completato!',
  successDuration = 2000,
  disabled = false,
  className = '',
  onClick,
}) => {
  const [showSuccess, setShowSuccess] = useState(false)
  const [internalLoading, setInternalLoading] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)

  // Handle success state timing
  useEffect(() => {
    if (success) {
      setShowSuccess(true)
      const timer = setTimeout(() => {
        setShowSuccess(false)
      }, successDuration)
      return () => clearTimeout(timer)
    }
  }, [success, successDuration])

  const handleClick = async () => {
    if (!onClick || disabled || isLoading || internalLoading) return

    setInternalLoading(true)
    setInternalError(null)

    try {
      await onClick()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore durante l\'operazione'
      setInternalError(errorMessage)
    } finally {
      setInternalLoading(false)
    }
  }

  const currentLoading = isLoading || internalLoading
  const currentError = error || internalError
  const currentSuccess = success || showSuccess

  if (currentLoading) {
    return (
      <div className={`flex items-center justify-center space-x-2 ${className}`}>
        <LoadingState size="sm" />
        <span className="text-sm text-gray-600">{loadingText}</span>
      </div>
    )
  }

  if (currentSuccess) {
    return (
      <div className={`flex items-center justify-center space-x-2 text-green-600 ${className}`}>
        <span className="text-lg">✅</span>
        <span className="text-sm font-medium">{successText}</span>
      </div>
    )
  }

  if (currentError) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center space-x-2 text-red-600">
          <span className="text-lg">❌</span>
          <span className="text-sm">{currentError}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleClick}
          className="w-full"
        >
          Riprova
        </Button>
      </div>
    )
  }

  // Wrap children in clickable element if onClick is provided
  if (onClick) {
    return (
      <div onClick={handleClick} className={className}>
        {children}
      </div>
    )
  }

  return <div className={className}>{children}</div>
}

// Specialized button with built-in feedback
interface FeedbackButtonProps {
  children: React.ReactNode
  onClick: () => void | Promise<void>
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loadingText?: string
  successText?: string
  successDuration?: number
  showSuccessState?: boolean
  className?: string
}

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  disabled = false,
  loadingText = 'Caricamento...',
  successText = 'Completato!',
  successDuration = 2000,
  showSuccessState = true,
  className = '',
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    if (disabled || isLoading) return

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      await onClick()
      
      if (showSuccessState) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), successDuration)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore durante l\'operazione'
      setError(errorMessage)
      
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const getButtonContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center space-x-2">
          <LoadingState size="sm" type="spinner" />
          <span>{loadingText}</span>
        </div>
      )
    }

    if (success) {
      return (
        <div className="flex items-center space-x-2">
          <span>✅</span>
          <span>{successText}</span>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex items-center space-x-2">
          <span>❌</span>
          <span>Riprova</span>
        </div>
      )
    }

    return children
  }

  const getButtonVariant = () => {
    if (error) return 'outline'
    if (success) return 'default'
    return variant
  }

  return (
    <div className={className}>
      <Button
        variant={getButtonVariant()}
        size={size}
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={`transition-all duration-200 ${
          success ? 'bg-green-600 hover:bg-green-700 text-white' : ''
        } ${error ? 'border-red-300 text-red-600 hover:border-red-400' : ''}`}
      >
        {getButtonContent()}
      </Button>
      
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  )
}

// Progress feedback for multi-step operations
interface ProgressFeedbackProps {
  steps: string[]
  currentStep: number
  isLoading?: boolean
  error?: string | null
  className?: string
}

export const ProgressFeedback: React.FC<ProgressFeedbackProps> = ({
  steps,
  currentStep,
  isLoading = false,
  error = null,
  className = '',
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            error ? 'bg-red-500' : 'bg-blue-600'
          }`}
          style={{
            width: `${((currentStep + 1) / steps.length) * 100}%`,
          }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isFuture = index > currentStep

          return (
            <div
              key={index}
              className={`flex items-center space-x-3 ${
                isCompleted ? 'text-green-600' : 
                isCurrent ? 'text-blue-600' : 
                'text-gray-400'
              }`}
            >
              <div className="flex-shrink-0">
                {isCompleted && '✅'}
                {isCurrent && (isLoading ? <LoadingState size="sm" /> : '🔄')}
                {isFuture && '⏳'}
                {error && isCurrent && '❌'}
              </div>
              <span className={`text-sm ${isCurrent ? 'font-medium' : ''}`}>
                {step}
              </span>
            </div>
          )
        })}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="text-sm text-red-800">
            <strong>Errore:</strong> {error}
          </div>
        </div>
      )}
    </div>
  )
}


