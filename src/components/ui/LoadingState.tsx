'use client'

import React from 'react'
import { Card } from './Card'

interface LoadingStateProps {
  type?: 'spinner' | 'skeleton' | 'dots' | 'pulse'
  size?: 'sm' | 'md' | 'lg'
  message?: string
  fullScreen?: boolean
  className?: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'spinner',
  size = 'md',
  message,
  fullScreen = false,
  className = '',
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4'
      case 'lg':
        return 'w-8 h-8'
      default:
        return 'w-6 h-6'
    }
  }

  const renderSpinner = () => (
    <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${getSizeClasses()}`} />
  )

  const renderDots = () => (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`bg-blue-600 rounded-full animate-pulse ${
            size === 'sm' ? 'w-1 h-1' : size === 'lg' ? 'w-3 h-3' : 'w-2 h-2'
          }`}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1s',
          }}
        />
      ))}
    </div>
  )

  const renderPulse = () => (
    <div className={`bg-blue-600 rounded-full animate-pulse ${getSizeClasses()}`} />
  )

  const renderSkeleton = () => (
    <div className="space-y-3 w-full max-w-sm">
      <div className="h-4 bg-gray-200 rounded animate-pulse" />
      <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
      <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
    </div>
  )

  const renderLoader = () => {
    switch (type) {
      case 'dots':
        return renderDots()
      case 'pulse':
        return renderPulse()
      case 'skeleton':
        return renderSkeleton()
      default:
        return renderSpinner()
    }
  }

  const content = (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className}`}>
      {renderLoader()}
      {message && (
        <div className={`text-gray-600 text-center ${
          size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'
        }`}>
          {message}
        </div>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        <Card className="p-8">
          {content}
        </Card>
      </div>
    )
  }

  return content
}

// Skeleton components for specific use cases
export const TicketSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Card className={`p-4 animate-pulse ${className}`}>
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-6 bg-gray-200 rounded w-16" />
      </div>
      <div className="h-3 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="flex items-center space-x-4">
        <div className="h-3 bg-gray-200 rounded w-20" />
        <div className="h-3 bg-gray-200 rounded w-24" />
      </div>
    </div>
  </Card>
)

export const FormSkeleton: React.FC<{ fields?: number; className?: string }> = ({ 
  fields = 3, 
  className = '' 
}) => (
  <div className={`space-y-4 animate-pulse ${className}`}>
    {[...Array(fields)].map((_, i) => (
      <div key={i} className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="h-10 bg-gray-200 rounded" />
      </div>
    ))}
    <div className="flex justify-end space-x-2 pt-4">
      <div className="h-10 bg-gray-200 rounded w-20" />
      <div className="h-10 bg-gray-200 rounded w-24" />
    </div>
  </div>
)

export const ListSkeleton: React.FC<{ items?: number; className?: string }> = ({ 
  items = 5, 
  className = '' 
}) => (
  <div className={`space-y-3 ${className}`}>
    {[...Array(items)].map((_, i) => (
      <Card key={i} className="p-4 animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </Card>
    ))}
  </div>
)

// Loading overlay for interactive elements
export const LoadingOverlay: React.FC<{
  isLoading: boolean
  children: React.ReactNode
  message?: string
}> = ({ isLoading, children, message = 'Caricamento...' }) => {
  if (!isLoading) return <>{children}</>

  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
        <LoadingState message={message} />
      </div>
    </div>
  )
}


