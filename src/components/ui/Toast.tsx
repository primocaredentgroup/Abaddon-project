'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Button } from './Button'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
  maxToasts?: number
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  maxToasts = 5,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    }

    setToasts(prev => {
      const updated = [newToast, ...prev].slice(0, maxToasts)
      return updated
    })

    // Auto remove toast after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }

    return id
  }, [maxToasts])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const clearToasts = useCallback(() => {
    setToasts([])
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: () => void
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  const handleRemove = () => {
    setIsRemoving(true)
    setTimeout(onRemove, 150) // Wait for exit animation
  }

  const getToastStyles = () => {
    const baseStyles = "relative flex items-start space-x-3 p-4 rounded-lg shadow-lg border transition-all duration-150 ease-in-out transform"
    
    let colorStyles = ""
    switch (toast.type) {
      case 'success':
        colorStyles = "bg-green-50 border-green-200 text-green-800"
        break
      case 'error':
        colorStyles = "bg-red-50 border-red-200 text-red-800"
        break
      case 'warning':
        colorStyles = "bg-yellow-50 border-yellow-200 text-yellow-800"
        break
      case 'info':
        colorStyles = "bg-blue-50 border-blue-200 text-blue-800"
        break
    }

    let animationStyles = ""
    if (isRemoving) {
      animationStyles = "opacity-0 translate-x-full scale-95"
    } else if (isVisible) {
      animationStyles = "opacity-100 translate-x-0 scale-100"
    } else {
      animationStyles = "opacity-0 translate-x-full scale-95"
    }

    return `${baseStyles} ${colorStyles} ${animationStyles}`
  }

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'info':
        return 'ℹ️'
      default:
        return '📢'
    }
  }

  return (
    <div className={getToastStyles()}>
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <span className="text-lg">{getIcon()}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">
          {toast.title}
        </div>
        {toast.message && (
          <div className="text-sm opacity-90 mt-1">
            {toast.message}
          </div>
        )}
        {toast.action && (
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={toast.action.onClick}
              className="text-xs"
            >
              {toast.action.label}
            </Button>
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={handleRemove}
        className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Chiudi notifica"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}

// Convenience hooks
export const useSuccessToast = () => {
  const { addToast } = useToast()
  return useCallback((title: string, message?: string, action?: Toast['action']) => {
    return addToast({ type: 'success', title, message, action })
  }, [addToast])
}

export const useErrorToast = () => {
  const { addToast } = useToast()
  return useCallback((title: string, message?: string, action?: Toast['action']) => {
    return addToast({ type: 'error', title, message, action, duration: 0 }) // Errors don't auto-dismiss
  }, [addToast])
}

export const useWarningToast = () => {
  const { addToast } = useToast()
  return useCallback((title: string, message?: string, action?: Toast['action']) => {
    return addToast({ type: 'warning', title, message, action })
  }, [addToast])
}

export const useInfoToast = () => {
  const { addToast } = useToast()
  return useCallback((title: string, message?: string, action?: Toast['action']) => {
    return addToast({ type: 'info', title, message, action })
  }, [addToast])
}


