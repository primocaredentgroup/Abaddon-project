'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'

interface PerformanceMetrics {
  renderTime: number
  memoryUsage: number
  componentMounts: number
  reRenders: number
  lastUpdate: number
}

interface PerformanceMonitorProps {
  enabled?: boolean
  componentName?: string
  logToConsole?: boolean
  showOverlay?: boolean
  children: React.ReactNode
}

const performanceStore = new Map<string, PerformanceMetrics>()

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  enabled = process.env.NODE_ENV === 'development',
  componentName = 'Unknown',
  logToConsole = false,
  showOverlay = false,
  children,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    componentMounts: 0,
    reRenders: 0,
    lastUpdate: Date.now(),
  })

  const renderStartRef = useRef<number>(0)
  const mountCountRef = useRef(0)
  const renderCountRef = useRef(0)
  const observerRef = useRef<PerformanceObserver | null>(null)

  // Measure render time
  const measureRenderStart = useCallback(() => {
    if (!enabled) return
    renderStartRef.current = performance.now()
  }, [enabled])

  const measureRenderEnd = useCallback(() => {
    if (!enabled || renderStartRef.current === 0) return
    
    const renderTime = performance.now() - renderStartRef.current
    renderCountRef.current += 1

    setMetrics(prev => {
      const newMetrics = {
        ...prev,
        renderTime,
        reRenders: renderCountRef.current,
        lastUpdate: Date.now(),
      }
      
      performanceStore.set(componentName, newMetrics)
      
      if (logToConsole) {
        console.log(`[Performance] ${componentName}:`, {
          renderTime: `${renderTime.toFixed(2)}ms`,
          reRenders: renderCountRef.current,
          mounts: mountCountRef.current,
        })
      }
      
      return newMetrics
    })

    renderStartRef.current = 0
  }, [enabled, componentName, logToConsole])

  // Monitor memory usage
  const updateMemoryUsage = useCallback(() => {
    if (!enabled || !(performance as any).memory) return

    const memory = (performance as any).memory
    const memoryUsage = memory.usedJSHeapSize / (1024 * 1024) // MB

    setMetrics(prev => ({
      ...prev,
      memoryUsage,
      lastUpdate: Date.now(),
    }))
  }, [enabled])

  // Setup performance observer
  useEffect(() => {
    if (!enabled) return

    try {
      observerRef.current = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach(entry => {
          if (entry.entryType === 'measure' && entry.name.includes(componentName)) {
            console.log(`[Performance] ${entry.name}: ${entry.duration.toFixed(2)}ms`)
          }
        })
      })

      observerRef.current.observe({ entryTypes: ['measure', 'navigation', 'paint'] })
    } catch (error) {
      console.warn('Performance Observer not supported:', error)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [enabled, componentName])

  // Track component mounts
  useEffect(() => {
    if (!enabled) return

    mountCountRef.current += 1
    setMetrics(prev => ({
      ...prev,
      componentMounts: mountCountRef.current,
    }))

    // Update memory usage periodically
    const memoryInterval = setInterval(updateMemoryUsage, 1000)

    return () => {
      clearInterval(memoryInterval)
    }
  }, [enabled, updateMemoryUsage])

  // Measure render performance
  useEffect(() => {
    measureRenderStart()
    
    // Use setTimeout to measure after render
    const timeoutId = setTimeout(measureRenderEnd, 0)
    
    return () => {
      clearTimeout(timeoutId)
    }
  })

  if (!enabled) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      {children}
      
      {showOverlay && (
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-3 rounded-lg text-xs font-mono z-50">
          <div className="font-semibold mb-2">{componentName}</div>
          <div>Render: {metrics.renderTime.toFixed(2)}ms</div>
          <div>Re-renders: {metrics.reRenders}</div>
          <div>Mounts: {metrics.componentMounts}</div>
          {metrics.memoryUsage > 0 && (
            <div>Memory: {metrics.memoryUsage.toFixed(1)}MB</div>
          )}
          <div className="text-gray-400 text-xs mt-1">
            {new Date(metrics.lastUpdate).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  )
}

// Hook for performance monitoring
export function usePerformanceMonitor(componentName: string, enabled = true) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const renderCountRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    renderCountRef.current += 1
    
    const currentMetrics = performanceStore.get(componentName)
    if (currentMetrics) {
      setMetrics(currentMetrics)
    }

    // Mark component render
    performance.mark(`${componentName}-render-start`)
    
    return () => {
      performance.mark(`${componentName}-render-end`)
      
      try {
        performance.measure(
          `${componentName}-render`,
          `${componentName}-render-start`,
          `${componentName}-render-end`
        )
      } catch (error) {
        // Ignore measurement errors
      }
    }
  })

  return metrics
}

// Utility to get all performance metrics
export function getAllPerformanceMetrics(): Record<string, PerformanceMetrics> {
  return Object.fromEntries(performanceStore.entries())
}

// Utility to clear performance metrics
export function clearPerformanceMetrics(componentName?: string) {
  if (componentName) {
    performanceStore.delete(componentName)
  } else {
    performanceStore.clear()
  }
}

// React DevTools Profiler wrapper
export const ProfilerWrapper: React.FC<{
  id: string
  onRender?: (id: string, phase: string, actualDuration: number) => void
  children: React.ReactNode
}> = ({ id, onRender, children }) => {
  const handleRender = useCallback(
    (
      id: string,
      phase: 'mount' | 'update',
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      if (onRender) {
        onRender(id, phase, actualDuration)
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Profiler] ${id} (${phase}):`, {
          actualDuration: `${actualDuration.toFixed(2)}ms`,
          baseDuration: `${baseDuration.toFixed(2)}ms`,
          startTime: `${startTime.toFixed(2)}ms`,
          commitTime: `${commitTime.toFixed(2)}ms`,
        })
      }
    },
    [onRender]
  )

  return (
    <React.Profiler id={id} onRender={handleRender}>
      {children}
    </React.Profiler>
  )
}

// Performance budget checker
export function usePerformanceBudget(
  budget: { renderTime?: number; memoryUsage?: number },
  componentName: string
) {
  const [violations, setViolations] = useState<string[]>([])

  useEffect(() => {
    const metrics = performanceStore.get(componentName)
    if (!metrics) return

    const newViolations: string[] = []

    if (budget.renderTime && metrics.renderTime > budget.renderTime) {
      newViolations.push(
        `Render time exceeded: ${metrics.renderTime.toFixed(2)}ms > ${budget.renderTime}ms`
      )
    }

    if (budget.memoryUsage && metrics.memoryUsage > budget.memoryUsage) {
      newViolations.push(
        `Memory usage exceeded: ${metrics.memoryUsage.toFixed(1)}MB > ${budget.memoryUsage}MB`
      )
    }

    setViolations(newViolations)

    if (newViolations.length > 0 && process.env.NODE_ENV === 'development') {
      console.warn(`[Performance Budget] ${componentName}:`, newViolations)
    }
  }, [budget, componentName])

  return violations
}


