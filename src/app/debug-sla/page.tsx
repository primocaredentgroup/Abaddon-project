'use client'

import React, { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Bug, Search } from 'lucide-react'

/**
 * 🔍 Pagina di debug per testare le regole SLA
 * 
 * Questa pagina ti aiuta a capire perché una regola SLA non viene applicata
 */
export default function DebugSLAPage() {
  const [slaRuleId, setSlaRuleId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priority, setPriority] = useState(1)
  
  // Query per ottenere tutte le regole SLA (per mostrare gli ID)
  const allRules = useQuery(api.slaRules.getAllSLARules, {})
  
  // Categorie disponibili
  const categories = useQuery(api.categories.getCategoriesByClinic, { isActive: true })
  
  // Query di debug per la regola specifica (sempre chiamata, ma skip se non c'è ID)
  const ruleDebug = useQuery(
    api.debugSlaRule.debugSLARule, 
    slaRuleId ? { ruleId: slaRuleId as any } : "skip"
  )
  
  // Query di debug per il matching (sempre chiamata, ma skip se non c'è ID)
  const matchingDebug = useQuery(
    api.debugSlaRule.debugTicketSLAMatching,
    categoryId ? { categoryId: categoryId as any, priority: priority } : "skip"
  )
  
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center">
          <Bug className="h-8 w-8 mr-3 text-purple-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Debug Regole SLA
            </h1>
            <p className="text-gray-600 mt-2">
              Scopri perché una regola SLA non viene applicata ai ticket
            </p>
          </div>
        </div>
        
        {/* Sezione 1: Debug Regola Specifica */}
        <Card>
          <CardHeader>
            <CardTitle>1. Ispeziona Regola SLA Specifica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleziona una regola SLA:
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                value={slaRuleId}
                onChange={(e) => setSlaRuleId(e.target.value)}
              >
                <option value="">-- Seleziona una regola --</option>
                {allRules?.map((rule) => (
                  <option key={rule._id} value={rule._id}>
                    {rule.name} ({rule.isActive ? 'Attiva' : 'Inattiva'})
                  </option>
                ))}
              </select>
            </div>
            
            {ruleDebug && (
              <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Risultati Debug:</h3>
                <pre className="bg-white p-4 rounded border overflow-x-auto text-sm">
                  {JSON.stringify(ruleDebug, null, 2)}
                </pre>
                
                <div className="mt-4 space-y-2">
                  <p><strong>Nome:</strong> {ruleDebug.name}</p>
                  <p><strong>Target Hours:</strong> {ruleDebug.targetHours}</p>
                  <p><strong>Attiva:</strong> {ruleDebug.isActive ? '✅ Sì' : '❌ No'}</p>
                  <p><strong>Numero Categorie:</strong> {ruleDebug.categoriesLength}</p>
                  <p><strong>Tipo Categorie:</strong> {ruleDebug.categoriesType}</p>
                  
                  {ruleDebug.categoriesInConditions && ruleDebug.categoriesInConditions.length > 0 && (
                    <div>
                      <p className="font-semibold mt-2">ID Categorie nella regola:</p>
                      <ul className="list-disc list-inside ml-4">
                        {ruleDebug.categoriesInConditions.map((catId: string, index: number) => (
                          <li key={index} className="font-mono text-sm">{catId}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Sezione 2: Test Matching */}
        <Card>
          <CardHeader>
            <CardTitle>2. Test Matching Categoria → Regole SLA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleziona una categoria (simula creazione ticket):
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">-- Seleziona una categoria --</option>
                {categories?.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priorità Ticket:
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value))}
              >
                <option value="1">1 - Molto Bassa</option>
                <option value="2">2 - Bassa</option>
                <option value="3">3 - Media</option>
                <option value="4">4 - Alta</option>
                <option value="5">5 - Urgente</option>
              </select>
            </div>
            
            {matchingDebug && (
              <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Risultati Matching:</h3>
                
                <div className="bg-white p-4 rounded border mb-4">
                  <p><strong>Categoria Ticket:</strong> <code className="font-mono text-sm">{matchingDebug.ticketCategoryId}</code></p>
                  <p><strong>Priorità Ticket:</strong> {matchingDebug.ticketPriority}</p>
                  <p><strong>Regole SLA Controllate:</strong> {matchingDebug.totalRulesChecked}</p>
                </div>
                
                <h4 className="font-semibold mt-4 mb-2">Dettagli Matching per Regola:</h4>
                <div className="space-y-3">
                  {matchingDebug.matchingResults.map((result: any, index: number) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded border ${result.matchesCategory ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{result.ruleName}</p>
                        <span className={`px-2 py-1 rounded text-sm ${result.matchesCategory ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                          {result.matchesCategory ? '✅ Match' : '❌ No Match'}
                        </span>
                      </div>
                      <p className="text-sm mt-1"><strong>Target Hours:</strong> {result.targetHours}</p>
                      <p className="text-sm mt-1"><strong>Categorie nella regola:</strong></p>
                      {result.categoriesInRule.length === 0 ? (
                        <p className="text-sm text-gray-600 ml-4">Nessuna (si applica a tutte)</p>
                      ) : (
                        <ul className="list-disc list-inside ml-4 text-sm font-mono">
                          {result.categoriesInRule.map((catId: string, i: number) => (
                            <li key={i} className={catId === matchingDebug.ticketCategoryId ? 'text-green-600 font-bold' : ''}>
                              {catId}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                
                <details className="mt-4">
                  <summary className="cursor-pointer font-semibold text-gray-700">
                    Mostra JSON completo
                  </summary>
                  <pre className="bg-white p-4 rounded border overflow-x-auto text-sm mt-2">
                    {JSON.stringify(matchingDebug, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Istruzioni */}
        <Card>
          <CardHeader>
            <CardTitle>Come usare questa pagina:</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>
                <strong>Sezione 1:</strong> Seleziona la regola SLA che hai creato per vedere esattamente cosa c'è dentro
              </li>
              <li>
                <strong>Sezione 2:</strong> Seleziona la categoria del ticket che dovrebbe triggerare l'SLA
              </li>
              <li>
                Controlla se l'ID della categoria del ticket è presente nell'array delle categorie della regola
              </li>
              <li>
                Se non c'è match, il problema è che gli ID non corrispondono
              </li>
            </ol>
            
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-900">
                <strong>💡 Suggerimento:</strong> Guarda nella console del browser (F12 → Console) per vedere i log dettagliati
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

