import { useState, useCallback } from 'react'
import { useErrorToast, useSuccessToast } from '@/components/ui/Toast'

interface UseAsyncOperationOptions {
  onSuccess?: (result: any) => void
  onError?: (error: Error) => void
  successMessage?: string
  errorMessage?: string
  showSuccessToast?: boolean
  showErrorToast?: boolean
}

interface UseAsyncOperationReturn<T> {
  isLoading: boolean
  error: Error | null
  execute: (...args: any[]) => Promise<T | undefined>
  reset: () => void
}

export function useAsyncOperation<T = any>(
  operation: (...args: any[]) => Promise<T>,
  options: UseAsyncOperationOptions = {}
): UseAsyncOperationReturn<T> {
  const {
    onSuccess,
    onError,
    successMessage,
    errorMessage,
    showSuccessToast = true,
    showErrorToast = true,
  } = options

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const successToast = useSuccessToast()
  const errorToast = useErrorToast()

  const execute = useCallback(async (...args: any[]): Promise<T | undefined> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await operation(...args)
      
      onSuccess?.(result)
      
      if (showSuccessToast && successMessage) {
        successToast(successMessage)
      }
      
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      
      onError?.(error)
      
      if (showErrorToast) {
        const message = errorMessage || error.message || 'Si è verificato un errore'
        errorToast('Errore', message)
      }
      
      return undefined
    } finally {
      setIsLoading(false)
    }
  }, [operation, onSuccess, onError, successMessage, errorMessage, showSuccessToast, showErrorToast, successToast, errorToast])

  const reset = useCallback(() => {
    setIsLoading(false)
    setError(null)
  }, [])

  return {
    isLoading,
    error,
    execute,
    reset,
  }
}

// Specialized hooks for common operations
export function useTicketOperation(options: UseAsyncOperationOptions = {}) {
  return useAsyncOperation(async () => {}, {
    successMessage: 'Operazione completata con successo',
    errorMessage: 'Errore durante l\'operazione sul ticket',
    ...options,
  })
}

export function useFormSubmit<T = any>(
  submitFunction: (data: T) => Promise<any>,
  options: UseAsyncOperationOptions = {}
) {
  return useAsyncOperation(submitFunction, {
    successMessage: 'Dati salvati con successo',
    errorMessage: 'Errore durante il salvataggio',
    ...options,
  })
}

export function useDataFetch<T = any>(
  fetchFunction: () => Promise<T>,
  options: UseAsyncOperationOptions = {}
) {
  return useAsyncOperation(fetchFunction, {
    errorMessage: 'Errore durante il caricamento dei dati',
    showSuccessToast: false, // Usually don't show success for data fetching
    ...options,
  })
}

// Hook for handling multiple async operations
export function useAsyncOperations() {
  const [operations, setOperations] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, Error | null>>({})

  const startOperation = useCallback((key: string) => {
    setOperations(prev => ({ ...prev, [key]: true }))
    setErrors(prev => ({ ...prev, [key]: null }))
  }, [])

  const finishOperation = useCallback((key: string, error?: Error) => {
    setOperations(prev => ({ ...prev, [key]: false }))
    if (error) {
      setErrors(prev => ({ ...prev, [key]: error }))
    }
  }, [])

  const isLoading = useCallback((key?: string) => {
    if (key) return operations[key] || false
    return Object.values(operations).some(Boolean)
  }, [operations])

  const getError = useCallback((key: string) => {
    return errors[key] || null
  }, [errors])

  const reset = useCallback((key?: string) => {
    if (key) {
      setOperations(prev => ({ ...prev, [key]: false }))
      setErrors(prev => ({ ...prev, [key]: null }))
    } else {
      setOperations({})
      setErrors({})
    }
  }, [])

  return {
    startOperation,
    finishOperation,
    isLoading,
    getError,
    reset,
  }
}

// Hook for retry logic
export function useRetryableOperation<T = any>(
  operation: (...args: any[]) => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
) {
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  const { execute, isLoading, error, reset } = useAsyncOperation(operation, {
    showErrorToast: false, // Handle toasts manually for retries
  })

  const executeWithRetry = useCallback(async (...args: any[]): Promise<T | undefined> => {
    setRetryCount(0)
    
    const attemptOperation = async (attempt: number): Promise<T | undefined> => {
      try {
        const result = await execute(...args)
        setRetryCount(0)
        setIsRetrying(false)
        return result
      } catch (err) {
        if (attempt < maxRetries) {
          setRetryCount(attempt + 1)
          setIsRetrying(true)
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
          
          return attemptOperation(attempt + 1)
        } else {
          setIsRetrying(false)
          throw err
        }
      }
    }

    return attemptOperation(1)
  }, [execute, maxRetries, retryDelay])

  const resetRetry = useCallback(() => {
    setRetryCount(0)
    setIsRetrying(false)
    reset()
  }, [reset])

  return {
    execute: executeWithRetry,
    isLoading: isLoading || isRetrying,
    error,
    retryCount,
    isRetrying,
    reset: resetRetry,
  }
}


