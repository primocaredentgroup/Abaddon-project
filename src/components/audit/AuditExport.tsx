'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

interface AuditExportProps {
  className?: string
}

export const AuditExport: React.FC<AuditExportProps> = ({
  className = '',
}) => {
  const [isExporting, setIsExporting] = useState(false)
  const [exportConfig, setExportConfig] = useState({
    entityType: '',
    dateFrom: '',
    dateTo: '',
    format: 'csv' as 'csv' | 'json',
  })

  // Get stats for export preview
  const stats = useQuery(
    api.auditLogs?.getStats,
    {
      entityType: exportConfig.entityType || undefined,
      dateFrom: exportConfig.dateFrom ? new Date(exportConfig.dateFrom).getTime() : undefined,
      dateTo: exportConfig.dateTo ? new Date(exportConfig.dateTo).getTime() : undefined,
    }
  )

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      // In a real implementation, this would call a Convex function
      // that returns the audit data, then format it for download
      
      // For now, we'll simulate the export
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Create mock data for demonstration
      const mockData = [
        {
          timestamp: new Date().toISOString(),
          user: 'Mario Rossi',
          action: 'created',
          entityType: 'ticket',
          entityId: 'ticket-123',
          changes: 'Creato nuovo ticket "Problema stampante"',
        },
        // Add more mock data...
      ]

      if (exportConfig.format === 'csv') {
        downloadCSV(auditData)
      } else {
        downloadJSON(auditData)
      }
    } catch (error) {
      console.error('Export error:', error)
      alert('Errore durante l\'esportazione')
    } finally {
      setIsExporting(false)
    }
  }

  const downloadCSV = (data: any[]) => {
    if (data.length === 0) return

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => 
          `"${String(row[header]).replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `audit-log-${Date.now()}.csv`)
  }

  const downloadJSON = (data: any[]) => {
    const jsonContent = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
    downloadBlob(blob, `audit-log-${Date.now()}.json`)
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  const getPreviewText = () => {
    if (!stats) return 'Caricamento...'
    
    let text = `${stats.total} record totali`
    
    if (exportConfig.entityType) {
      text += ` per ${exportConfig.entityType}`
    }
    
    if (exportConfig.dateFrom || exportConfig.dateTo) {
      text += ' nel periodo'
      if (exportConfig.dateFrom) {
        text += ` dal ${new Date(exportConfig.dateFrom).toLocaleDateString('it-IT')}`
      }
      if (exportConfig.dateTo) {
        text += ` al ${new Date(exportConfig.dateTo).toLocaleDateString('it-IT')}`
      }
    }
    
    return text
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Esporta Dati Audit
          </h3>
          <p className="text-sm text-gray-600">
            Esporta i log di audit per analisi esterne o archiviazione
          </p>
        </div>

        {/* Export Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo di Entità
            </label>
            <Select
              value={exportConfig.entityType}
              onValueChange={(value) => 
                setExportConfig(prev => ({ ...prev, entityType: value }))
              }
            >
              <option value="">Tutte le entità</option>
              <option value="ticket">Ticket</option>
              <option value="user">Utenti</option>
              <option value="category">Categorie</option>
              <option value="clinic">Cliniche</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Formato
            </label>
            <Select
              value={exportConfig.format}
              onValueChange={(value) => 
                setExportConfig(prev => ({ ...prev, format: value as 'csv' | 'json' }))
              }
            >
              <option value="csv">CSV (Excel)</option>
              <option value="json">JSON</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Inizio
            </label>
            <Input
              type="date"
              value={exportConfig.dateFrom}
              onChange={(value) => 
                setExportConfig(prev => ({ ...prev, dateFrom: value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Fine
            </label>
            <Input
              type="date"
              value={exportConfig.dateTo}
              onChange={(value) => 
                setExportConfig(prev => ({ ...prev, dateTo: value }))
              }
            />
          </div>
        </div>

        {/* Preview */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Anteprima Esportazione
          </h4>
          <div className="text-sm text-blue-800">
            {getPreviewText()}
          </div>
        </div>

        {/* Export Actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            I dati esportati includeranno timestamp, utente, azione e dettagli delle modifiche
          </div>
          <Button
            onClick={handleExport}
            disabled={isExporting || !stats || stats.total === 0}
          >
            {isExporting ? 'Esportando...' : 'Esporta Dati'}
          </Button>
        </div>

        {/* Export Formats Info */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Formati Disponibili
          </h4>
          <div className="space-y-2 text-sm text-gray-600">
            <div>
              <strong>CSV:</strong> Formato compatibile con Excel e altri fogli di calcolo.
              Ideale per analisi e reporting.
            </div>
            <div>
              <strong>JSON:</strong> Formato strutturato per sviluppatori e integrazioni.
              Mantiene la struttura completa dei dati.
            </div>
          </div>
        </div>

        {/* Data Retention Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="text-sm text-yellow-800">
            <strong>Nota sulla Conservazione:</strong> I dati di audit vengono conservati
            per un periodo limitato. Esporta regolarmente i dati per archiviazione a lungo termine.
          </div>
        </div>
      </div>
    </Card>
  )
}


