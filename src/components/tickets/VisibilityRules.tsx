'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useVisibilitySettings } from '@/hooks/useVisibilitySettings'

interface VisibilityRulesProps {
  className?: string
  showTitle?: boolean
  compact?: boolean
}

export const VisibilityRules: React.FC<VisibilityRulesProps> = ({
  className = '',
  showTitle = true,
  compact = false,
}) => {
  const { settings, canCreatePublicTickets, isLoading } = useVisibilitySettings()

  if (isLoading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        </div>
      </Card>
    )
  }

  if (!settings) {
    return null
  }

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Badge color={canCreatePublicTickets ? 'green' : 'red'} size="sm">
          {canCreatePublicTickets ? 'Pubblici abilitati' : 'Solo privati'}
        </Badge>
        {settings.requireApprovalForCategories && (
          <Badge color="orange" size="sm">
            Categorie con approvazione
          </Badge>
        )}
        <span className="text-xs text-gray-500">
          SLA: {settings.defaultSlaHours}h
        </span>
      </div>
    )
  }

  return (
    <Card className={`p-4 ${className}`}>
      {showTitle && (
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          Regole di Visibilità
        </h3>
      )}

      <div className="space-y-3">
        {/* Public Tickets Rule */}
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            {canCreatePublicTickets ? (
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            ) : (
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">
              Ticket Pubblici
            </div>
            <div className="text-xs text-gray-600">
              {canCreatePublicTickets ? (
                'Gli utenti possono creare ticket visibili a tutti nella clinica'
              ) : (
                'Tutti i ticket sono privati. Solo creatore, assegnatario e admin possono vederli'
              )}
            </div>
          </div>
          <Badge
            color={canCreatePublicTickets ? 'green' : 'red'}
            size="sm"
          >
            {canCreatePublicTickets ? 'Abilitati' : 'Disabilitati'}
          </Badge>
        </div>

        {/* Category Approval Rule */}
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className={`w-2 h-2 rounded-full ${
              settings.requireApprovalForCategories ? 'bg-orange-500' : 'bg-blue-500'
            }`}></div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">
              Approvazione Categorie
            </div>
            <div className="text-xs text-gray-600">
              {settings.requireApprovalForCategories ? (
                'Le nuove categorie richiedono approvazione admin'
              ) : (
                'Gli utenti possono creare nuove categorie liberamente'
              )}
            </div>
          </div>
          <Badge
            color={settings.requireApprovalForCategories ? 'orange' : 'blue'}
            size="sm"
          >
            {settings.requireApprovalForCategories ? 'Richiesta' : 'Libera'}
          </Badge>
        </div>

        {/* SLA Rule */}
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">
              SLA Predefinito
            </div>
            <div className="text-xs text-gray-600">
              Tempo standard per la risoluzione dei ticket
            </div>
          </div>
          <Badge color="purple" size="sm">
            {settings.defaultSlaHours}h
          </Badge>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <strong>Nota sulla Privacy:</strong> I ticket privati sono visibili solo al creatore,
          all'assegnatario e agli amministratori. I ticket pubblici sono visibili a tutti
          gli utenti della clinica.
        </div>
      </div>
    </Card>
  )
}


