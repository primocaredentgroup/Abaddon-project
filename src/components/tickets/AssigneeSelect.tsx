'use client'

import React, { useState, useMemo } from 'react'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useAuth } from '@/hooks/useAuth'

interface AssigneeSelectProps {
  ticketId: string
  value?: string
  disabled?: boolean
  showSearch?: boolean
  showUnassign?: boolean
  className?: string
  onAssigneeChanged?: () => void // Callback quando l'assegnazione cambia
}

export const AssigneeSelect: React.FC<AssigneeSelectProps> = ({
  ticketId,
  value,
  disabled = false,
  showSearch = true,
  showUnassign = true,
  className = '',
  onAssigneeChanged,
}) => {
  const [isChanging, setIsChanging] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')

  // Get current user
  const { user } = useAuth()
  
  // Get available agents for assignment using the new Convex function
  const availableAgents = useQuery(
    api.users.getAvailableAgents, 
    { 
      clinicId: user?.clinic?._id,
      userEmail: user?.email 
    }
  )

  // Mutation per cambiare l'assegnatario
  const changeAssignee = useMutation(api.tickets.changeAssignee)

  // Filter agents based on search term
  const filteredAgents = useMemo(() => {
    if (!availableAgents) return []
    if (!searchTerm) return availableAgents
    
    const term = searchTerm.toLowerCase()
    return availableAgents.filter(agent =>
      agent.name.toLowerCase().includes(term) ||
      agent.email.toLowerCase().includes(term)
    )
  }, [availableAgents, searchTerm])

  const currentAssignee = availableAgents?.find(agent => agent._id === value)

  const handleAssigneeChange = async (assigneeId: string) => {
    if (assigneeId === value) return

    setIsChanging(true)
    setError('')

    try {
      await changeAssignee({
        ticketId,
        newAssigneeId: assigneeId,
        userEmail: user?.email
      })
      
      // Chiama il callback se fornito
      onAssigneeChanged?.()
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
      await changeAssignee({
        ticketId,
        newAssigneeId: undefined, // Rimuovi assegnazione
        userEmail: user?.email
      })
      
      // Chiama il callback se fornito
      onAssigneeChanged?.()
    } catch (error) {
      console.error('Error unassigning:', error)
      setError('Errore durante la rimozione assegnazione')
    } finally {
      setIsChanging(false)
    }
  }

  if (!availableAgents) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Caricamento agenti...
      </div>
    )
  }

  if (availableAgents.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Nessun agente disponibile per l'assegnazione
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

        {/* Agent selection */}
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
          {filteredAgents.length === 0 ? (
            <div className="p-3 text-sm text-gray-500 text-center">
              {searchTerm ? 'Nessun agente trovato' : 'Nessun agente disponibile'}
            </div>
          ) : (
            filteredAgents.map((agent) => (
              <button
                key={agent._id}
                onClick={() => handleAssigneeChange(agent._id)}
                disabled={disabled || isChanging || agent._id === value}
                className={`w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 transition-colors ${
                  agent._id === value ? 'bg-blue-50 cursor-not-allowed' : ''
                } ${disabled || isChanging ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                  agent._id === value ? 'bg-blue-500' : 'bg-gray-400'
                }`}>
                  {agent.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {agent.name}
                    {agent._id === value && <span className="text-blue-600 ml-2">(Attuale)</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {agent.email} • {agent.role?.name}
                  </div>
                  {agent.clinic && (
                    <div className="text-xs text-gray-400 truncate">
                      {agent.clinic.name}
                    </div>
                  )}
                </div>
                {agent._id === user?.id && (
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
      {user && !value && (
        <div className="pt-2 border-t border-gray-200">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAssigneeChange(user.id)}
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


