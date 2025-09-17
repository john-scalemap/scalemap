'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

export interface ErrorMessage {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  dismissible?: boolean
  autoHide?: number // milliseconds
}

interface ErrorContextType {
  errors: ErrorMessage[]
  addError: (error: Omit<ErrorMessage, 'id'>) => string
  removeError: (id: string) => void
  clearAllErrors: () => void
  showError: (message: string, title?: string) => string
  showWarning: (message: string, title?: string) => string
  showSuccess: (message: string, title?: string) => string
  showInfo: (message: string, title?: string) => string
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined)

export function useError() {
  const context = useContext(ErrorContext)

  // Return a safe default if context is undefined (e.g., during SSR)
  if (context === undefined) {
    // During SSR or if used outside provider, return safe defaults
    if (typeof window === 'undefined') {
      return {
        errors: [],
        addError: () => '',
        removeError: () => {},
        clearAllErrors: () => {},
        showError: () => '',
        showWarning: () => '',
        showSuccess: () => '',
        showInfo: () => ''
      }
    }
    throw new Error('useError must be used within an ErrorProvider')
  }
  return context
}

interface ErrorProviderProps {
  children: ReactNode
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const [errors, setErrors] = useState<ErrorMessage[]>([])

  const addError = useCallback((error: Omit<ErrorMessage, 'id'>): string => {
    const id = Math.random().toString(36).substring(2, 11)
    const newError: ErrorMessage = {
      ...error,
      id,
      dismissible: error.dismissible ?? true
    }

    setErrors(prev => [...prev, newError])

    // Auto-hide if specified
    if (error.autoHide) {
      setTimeout(() => {
        removeError(id)
      }, error.autoHide)
    }

    return id
  }, [])

  const removeError = useCallback((id: string) => {
    setErrors(prev => prev.filter(error => error.id !== id))
  }, [])

  const clearAllErrors = useCallback(() => {
    setErrors([])
  }, [])

  const showError = useCallback((message: string, title: string = 'Error') => {
    return addError({
      type: 'error',
      title,
      message,
      dismissible: true
    })
  }, [addError])

  const showWarning = useCallback((message: string, title: string = 'Warning') => {
    return addError({
      type: 'warning',
      title,
      message,
      dismissible: true,
      autoHide: 10000 // Auto-hide warnings after 10 seconds
    })
  }, [addError])

  const showSuccess = useCallback((message: string, title: string = 'Success') => {
    return addError({
      type: 'success',
      title,
      message,
      dismissible: true,
      autoHide: 5000 // Auto-hide success messages after 5 seconds
    })
  }, [addError])

  const showInfo = useCallback((message: string, title: string = 'Info') => {
    return addError({
      type: 'info',
      title,
      message,
      dismissible: true,
      autoHide: 8000 // Auto-hide info messages after 8 seconds
    })
  }, [addError])

  const contextValue: ErrorContextType = {
    errors,
    addError,
    removeError,
    clearAllErrors,
    showError,
    showWarning,
    showSuccess,
    showInfo
  }

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
    </ErrorContext.Provider>
  )
}

// Error display component
export function ErrorNotifications() {
  const [mounted, setMounted] = useState(false)
  const { errors, removeError } = useError()

  // Ensure this only renders on the client to avoid SSR issues
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || errors.length === 0) return null

  const getErrorStyles = (type: ErrorMessage['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  const getErrorIcon = (type: ErrorMessage['type']) => {
    switch (type) {
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'success': return '✅'
      case 'info': return 'ℹ️'
      default: return '📝'
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {errors.map((error) => (
        <div
          key={error.id}
          className={`border rounded-lg p-4 shadow-lg ${getErrorStyles(error.type)}`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-sm">{getErrorIcon(error.type)}</span>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium">{error.title}</h3>
              <p className="mt-1 text-sm">{error.message}</p>
              {error.action && (
                <div className="mt-2">
                  <button
                    onClick={error.action.onClick}
                    className="text-sm font-medium underline hover:no-underline"
                  >
                    {error.action.label}
                  </button>
                </div>
              )}
            </div>
            {error.dismissible && (
              <div className="ml-3 flex-shrink-0">
                <button
                  onClick={() => removeError(error.id)}
                  className="text-sm font-medium opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}