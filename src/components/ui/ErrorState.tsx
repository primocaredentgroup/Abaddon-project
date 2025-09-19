'use client'

import React from 'react'
import { Button } from './Button'
import { Card } from './Card'

interface ErrorStateProps {
  type?: 'network' | 'permission' | 'not-found' | 'validation' | 'generic'
  title?: string
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  showDetails?: boolean
  details?: string
  fullScreen?: boolean
  className?: string
}

const ERROR_CONFIGS = {
  network: {
    icon: '🌐',
    title: 'Problema di Connessione',
    message: 'Non riesco a connettermi al server. Controlla la tua connessione internet.',
    actionLabel: 'Riprova',
  },
  permission: {
    icon: '🔒',
    title: 'Accesso Negato',
    message: 'Non hai i permessi necessari per visualizzare questo contenuto.',
    actionLabel: 'Torna Indietro',
  },
  'not-found': {
    icon: '🔍',
    title: 'Non Trovato',
    message: 'Il contenuto che stai cercando non esiste o è stato rimosso.',
    actionLabel: 'Torna alla Home',
  },
  validation: {
    icon: '⚠️',
    title: 'Dati Non Validi',
    message: 'Alcuni dati inseriti non sono corretti. Controlla e riprova.',
    actionLabel: 'Correggi',
  },
  generic: {
    icon: '❌',
    title: 'Errore',
    message: 'Si è verificato un errore imprevisto.',
    actionLabel: 'Riprova',
  },
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  type = 'generic',
  title,
  message,
  action,
  secondaryAction,
  showDetails = false,
  details,
  fullScreen = false,
  className = '',
}) => {
  const [showDetailsState, setShowDetailsState] = React.useState(false)
  
  const config = ERROR_CONFIGS[type]
  const displayTitle = title || config.title
  const displayMessage = message || config.message
  const displayIcon = config.icon

  const content = (
    <div className={`text-center space-y-4 ${className}`}>
      {/* Icon */}
      <div className="text-6xl">
        {displayIcon}
      </div>

      {/* Title and Message */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">
          {displayTitle}
        </h3>
        <p className="text-gray-600 max-w-md mx-auto">
          {displayMessage}
        </p>
      </div>

      {/* Error Details */}
      {(showDetails || details) && (
        <div className="space-y-2">
          {!showDetailsState ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetailsState(true)}
              className="text-gray-500"
            >
              Mostra Dettagli Tecnici
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-left max-w-lg mx-auto">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                  {details || 'Nessun dettaglio disponibile'}
                </pre>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetailsState(false)}
                className="text-gray-500"
              >
                Nascondi Dettagli
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-3">
        {action && (
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="outline" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
        {!action && (
          <Button onClick={() => window.location.reload()}>
            {config.actionLabel}
          </Button>
        )}
      </div>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="p-8 max-w-lg w-full">
          {content}
        </Card>
      </div>
    )
  }

  return (
    <Card className="p-8">
      {content}
    </Card>
  )
}

// Specific error components
export const NetworkError: React.FC<Omit<ErrorStateProps, 'type'>> = (props) => (
  <ErrorState type="network" {...props} />
)

export const PermissionError: React.FC<Omit<ErrorStateProps, 'type'>> = (props) => (
  <ErrorState type="permission" {...props} />
)

export const NotFoundError: React.FC<Omit<ErrorStateProps, 'type'>> = (props) => (
  <ErrorState type="not-found" {...props} />
)

export const ValidationError: React.FC<Omit<ErrorStateProps, 'type'>> = (props) => (
  <ErrorState type="validation" {...props} />
)

// Error boundary component
interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<any> },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ComponentType<any> }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo })
    
    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Send to error reporting service if configured
    if (typeof window !== 'undefined' && (window as any).errorReporting) {
      (window as any).errorReporting.captureException(error, {
        extra: errorInfo,
      })
    }
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback
      
      if (FallbackComponent) {
        return <FallbackComponent error={this.state.error} />
      }

      return (
        <ErrorState
          type="generic"
          title="Qualcosa è andato storto"
          message="Si è verificato un errore imprevisto. La pagina verrà ricaricata automaticamente."
          action={{
            label: 'Ricarica Pagina',
            onClick: () => window.location.reload(),
          }}
          secondaryAction={{
            label: 'Torna alla Home',
            onClick: () => window.location.href = '/',
          }}
          showDetails={true}
          details={this.state.error?.stack}
          fullScreen={true}
        />
      )
    }

    return this.props.children
  }
}

// Hook for handling async errors
export const useErrorHandler = () => {
  const handleError = React.useCallback((error: Error | string, context?: string) => {
    const errorMessage = typeof error === 'string' ? error : error.message
    const errorDetails = typeof error === 'string' ? undefined : error.stack
    
    console.error(`Error${context ? ` in ${context}` : ''}:`, error)
    
    // You could integrate with a toast system here
    // showErrorToast(errorMessage, errorDetails)
    
    // Or with an error reporting service
    if (typeof window !== 'undefined' && (window as any).errorReporting) {
      (window as any).errorReporting.captureException(
        typeof error === 'string' ? new Error(error) : error,
        { extra: { context } }
      )
    }
  }, [])

  return { handleError }
}


