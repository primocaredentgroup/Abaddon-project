'use client'

import React, { useState, useMemo } from 'react'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

interface AssigneeSelectProps {
  value?: string
  onChange: (assigneeId?: string) => Promise<void>
  disabled?: boolean
  showSearch?: boolean
  showUnassign?: boolean
  className?: string
}

export const AssigneeSelect: React.FC<AssigneeSelectProps> = ({
  value,
  onChange,
  disabled = false,
  showSearch = true,
  showUnassign = true,
  className = '',
}) => {
  const [isChanging, setIsChanging] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')

  // Get current user
  const currentUser = useQuery(api.users?.getCurrentUser, {})
  
  // Get clinic users (agents and admins who can be assigned tickets)
  // TODO: Filter by roles when role system is implemented
  const clinicUsers = useQuery(
    api.users?.getByClinic,
    currentUser ? { clinicId: currentUser.clinicId } : "skip"
  )

  // Filter users who can be assigned (exclude current user if they're not an agent/admin)
  const assignableUsers = useMemo(() => {
    if (!clinicUsers) return []
    
    // TODO: Add proper role filtering
    // For now, allow all active users to be assigned
    return clinicUsers.filter(user => user.isActive)
  }, [clinicUsers])

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return assignableUsers
    
    const term = searchTerm.toLowerCase()
    return assignableUsers.filter(user =>
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term)
    )
  }, [assignableUsers, searchTerm])

  const currentAssignee = assignableUsers.find(user => user._id === value)

  const handleAssigneeChange = async (assigneeId: string) => {
    if (assigneeId === value) return

    setIsChanging(true)
    setError('')

    try {
      await onChange(assigneeId || undefined)
    } catch (error) {
      console.error('Error changing assignee:', error)
      setError('Errore durante l\'assegnazione')
    } finally {
      setIsChanging(false)
    }
  }

  const handleUnassign = async () => {
    if (!value) return

    setIsChanging(true)
    setError('')

    try {
      await onChange(undefined)
    } catch (error) {
      console.error('Error unassigning:', error)
      setError('Errore durante la rimozione assegnazione')
    } finally {
      setIsChanging(false)
    }
  }

  if (!clinicUsers) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Caricamento utenti...
      </div>
    )
  }

  if (assignableUsers.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Nessun utente disponibile per l'assegnazione
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Assegnato a
        </label>
        
        {/* Current assignee display */}
        {currentAssignee ? (
          <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-md mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                {currentAssignee.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {currentAssignee.name}
                </div>
                <div className="text-xs text-gray-500">
                  {currentAssignee.email}
                </div>
              </div>
            </div>
            {showUnassign && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleUnassign}
                disabled={disabled || isChanging}
                className="text-red-600 hover:text-red-700"
              >
                {isChanging ? 'Rimuovendo...' : 'Rimuovi'}
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2 bg-gray-50 border border-gray-200 rounded-md mb-2 text-sm text-gray-500">
            Nessun assegnatario
          </div>
        )}

        {/* Search input */}
        {showSearch && (
          <Input
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Cerca utente per nome o email..."
            disabled={disabled || isChanging}
            className="mb-2"
          />
        )}

        {/* User selection */}
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
          {filteredUsers.length === 0 ? (
            <div className="p-3 text-sm text-gray-500 text-center">
              {searchTerm ? 'Nessun utente trovato' : 'Nessun utente disponibile'}
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user._id}
                onClick={() => handleAssigneeChange(user._id)}
                disabled={disabled || isChanging || user._id === value}
                className={`w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 transition-colors ${
                  user._id === value ? 'bg-blue-50 cursor-not-allowed' : ''
                } ${disabled || isChanging ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                  user._id === value ? 'bg-blue-500' : 'bg-gray-400'
                }`}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {user.name}
                    {user._id === value && <span className="text-blue-600 ml-2">(Attuale)</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {user.email}
                  </div>
                </div>
                {user._id === currentUser?._id && (
                  <div className="text-xs text-blue-600 font-medium">
                    Tu
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      {/* Quick actions */}
      {currentUser && !value && (
        <div className="pt-2 border-t border-gray-200">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAssigneeChange(currentUser._id)}
            disabled={disabled || isChanging}
            className="w-full"
          >
            {isChanging ? 'Assegnando...' : 'Assegna a me'}
          </Button>
        </div>
      )}
    </div>
  )
}


