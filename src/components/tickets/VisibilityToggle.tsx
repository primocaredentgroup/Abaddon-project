'use client'

import React from 'react'

interface VisibilityToggleProps {
  value?: 'public' | 'private'
  onChange: (visibility: 'public' | 'private') => void
  disabled?: boolean
  showDescription?: boolean
}

export const VisibilityToggle: React.FC<VisibilityToggleProps> = ({
  value = 'private',
  onChange,
  disabled = false,
  showDescription = true,
}) => {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Visibilità Ticket
        </h4>
        <div className="space-y-2">
          <label className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            value === 'private' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              type="radio"
              name="visibility"
              value="private"
              checked={value === 'private'}
              onChange={() => !disabled && onChange('private')}
              disabled={disabled}
              className="mt-0.5 text-blue-600"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Privato</div>
              {showDescription && (
                <div className="text-sm text-gray-600 mt-1">
                  Solo tu e gli agenti assegnati potete vedere questo ticket
                </div>
              )}
            </div>
          </label>

          <label className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            value === 'public' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              type="radio"
              name="visibility"
              value="public"
              checked={value === 'public'}
              onChange={() => !disabled && onChange('public')}
              disabled={disabled}
              className="mt-0.5 text-blue-600"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Pubblico</div>
              {showDescription && (
                <div className="text-sm text-gray-600 mt-1">
                  Tutti gli utenti della clinica possono vedere questo ticket
                </div>
              )}
            </div>
          </label>
        </div>
      </div>

      {value === 'public' && showDescription && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="text-sm text-yellow-800">
            <strong>Attenzione:</strong> I ticket pubblici sono visibili a tutti gli utenti della tua clinica.
            Assicurati che non contengano informazioni sensibili.
          </div>
        </div>
      )}
    </div>
  )
}


