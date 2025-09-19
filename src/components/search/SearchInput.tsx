'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface SearchSuggestion {
  type: 'ticket' | 'category' | 'user'
  id: string
  title: string
  subtitle?: string
}

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch?: (value: string) => void
  suggestions?: SearchSuggestion[]
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void
  onSuggestionRequest?: (term: string) => void
  placeholder?: string
  disabled?: boolean
  showSuggestions?: boolean
  className?: string
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onSearch,
  suggestions = [],
  onSuggestionSelect,
  onSuggestionRequest,
  placeholder = "Cerca ticket, categorie, utenti...",
  disabled = false,
  showSuggestions = true,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        inputRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle input change
  const handleInputChange = (newValue: string) => {
    onChange(newValue)
    setSelectedIndex(-1)
    
    if (newValue.length >= 2 && showSuggestions) {
      onSuggestionRequest?.(newValue)
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }

  // Handle search
  const handleSearch = () => {
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      onSuggestionSelect?.(suggestions[selectedIndex])
    } else {
      onSearch?.(value)
    }
    setIsOpen(false)
  }

  // Handle key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSearch()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
        
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
        
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          onSuggestionSelect?.(suggestions[selectedIndex])
        } else {
          onSearch?.(value)
        }
        setIsOpen(false)
        break
        
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    onSuggestionSelect?.(suggestion)
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  // Get icon for suggestion type
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'ticket': return '🎫'
      case 'category': return '📂'
      case 'user': return '👤'
      default: return '🔍'
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (value.length >= 2 && suggestions.length > 0) {
              setIsOpen(true)
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-12"
        />
        <Button
          onClick={handleSearch}
          disabled={disabled}
          className="ml-2"
          size="sm"
        >
          🔍
        </Button>
      </div>

      {/* Suggestions dropdown */}
      {isOpen && showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${suggestion.id}`}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                index === selectedIndex ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <span className="text-lg">
                {getSuggestionIcon(suggestion.type)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {suggestion.title}
                </div>
                {suggestion.subtitle && (
                  <div className="text-xs text-gray-500 truncate">
                    {suggestion.subtitle}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400">
                {suggestion.type}
              </div>
            </button>
          ))}
          
          {/* Search option */}
          <button
            onClick={() => {
              onSearch?.(value)
              setIsOpen(false)
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-t border-gray-100 ${
              selectedIndex === -1 ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
            }`}
          >
            <span className="text-lg">🔍</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                Cerca "{value}"
              </div>
              <div className="text-xs text-gray-500">
                Ricerca generale
              </div>
            </div>
          </button>
        </div>
      )}

      {/* No suggestions message */}
      {isOpen && showSuggestions && value.length >= 2 && suggestions.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 text-center text-gray-500 text-sm"
        >
          Nessun suggerimento trovato
        </div>
      )}
    </div>
  )
}


