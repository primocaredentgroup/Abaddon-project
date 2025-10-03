'use client'

import React, { useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/hooks/useAuth'
import { UserCompetenciesManager } from '@/components/admin/UserCompetenciesManager'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

export default function UsersPage() {
  const { user: currentUser, refreshUser } = useAuth() // Ottieni l'utente corrente e la funzione refresh
  const users = useQuery(api.users.getAllUsers, {})
  const roles = useQuery(api.roles.getAllRoles, { includeSystem: true })

  const createUser = useMutation(api.users.createUser)
  const updateUser = useMutation(api.users.updateUserSimple) // Usa la versione Simple per lo sviluppo
  const createPermissions = useMutation(api.roles.createSystemPermissions)
  const createSystemRoles = useMutation(api.roles.createSystemRoles)

  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', roleId: '' })
  const [saving, setSaving] = useState(false)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  const roleOptions = useMemo(() => (roles || []).map((r: any) => ({ value: r._id, label: r.name })), [roles])

  if (!users || !roles) return null

  const resetForm = () => setForm({ name: '', email: '', roleId: roleOptions[0]?.value || '' })

  const handleCreate = async () => {
    if (!form.email || !form.name || !form.roleId) return
    setSaving(true)
    try {
      // auth0Id placeholder: sarà collegato al primo login tramite email
      await createUser({
        email: form.email,
        name: form.name,
        roleId: form.roleId as any,
        auth0Id: `pending:${form.email}`,
      })
      setIsOpen(false)
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (user: any) => {
    await updateUser({ userId: user._id, isActive: !user.isActive })
    
    // Se stai modificando te stesso, ricarica i dati
    if (currentUser && user.email === currentUser.email) {
      toast.success('Ruolo aggiornato! Ricaricando i tuoi dati...')
      setTimeout(() => refreshUser(), 500)
    }
  }

  const handleChangeRole = async (user: any, newRoleId: string) => {
    try {
      await updateUser({ userId: user._id, roleId: newRoleId as any })
      
      // Se stai modificando il TUO ruolo, ricarica i dati
      if (currentUser && user.email === currentUser.email) {
        toast.success('Ruolo aggiornato! Ricaricando i tuoi dati...')
        // Aspetta un attimo e poi ricarica per dare tempo al database di aggiornarsi
        setTimeout(() => {
          refreshUser()
        }, 800)
      } else {
        toast.success(`Ruolo di ${user.name} aggiornato con successo!`)
      }
    } catch (error) {
      console.error('Errore cambio ruolo:', error)
      toast.error('Errore durante l\'aggiornamento del ruolo')
    }
  }

  return (
    <AppLayout>
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Utenti</h1>
        <Button onClick={() => { resetForm(); setIsOpen(true) }}>Nuovo utente</Button>
      </div>

      {/* Avviso se mancano i ruoli di sistema */}
      {roleOptions.length === 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Nessun ruolo trovato</p>
              <p className="text-sm text-gray-600">Crea i ruoli di sistema (Utente, Agente, Amministratore) per procedere.</p>
            </div>
            <Button onClick={async () => { await createPermissions({}); await createSystemRoles({}); }}>Inizializza ruoli</Button>
          </div>
        </Card>
      )}

      {/* Lista utenti */}
      <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Ruolo</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Stato</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Azioni</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((u) => {
              const isCurrentUser = currentUser && u.email === currentUser.email
              const currentRole = roles?.find((r) => r._id === u.roleId)
              // Mostra competenze per Agenti e Admin, ma non per Utenti
              const canManageCompetencies = currentRole?.name === 'Agente' || currentRole?.name === 'Amministratore'
              const isExpanded = expandedUserId === u._id
              
              return (
                <React.Fragment key={u._id}>
                  <tr className={`hover:bg-gray-50 transition-colors ${isCurrentUser ? 'bg-blue-50 hover:bg-blue-100' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{u.name}</span>
                            {isCurrentUser && (
                              <Badge variant="default" className="text-xs">Tu</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">{u.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        className={`border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${isCurrentUser ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}`}
                        value={u.roleId as any}
                        onChange={(e) => handleChangeRole(u, e.target.value)}
                        disabled={roleOptions.length === 0}
                        title={isCurrentUser ? 'Stai modificando il TUO ruolo' : ''}
                      >
                        {roleOptions.map((r: any) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge 
                        variant={u.isActive ? 'default' : 'secondary'}
                        className="px-3 py-1"
                      >
                        {u.isActive ? '✓ Attivo' : '✗ Disattivo'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex gap-2 justify-end">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleToggleActive(u)}
                          className="hover:bg-gray-100"
                        >
                          {u.isActive ? 'Disattiva' : 'Attiva'}
                        </Button>
                        {canManageCompetencies && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setExpandedUserId(isExpanded ? null : u._id)}
                            className={`transition-all ${isExpanded ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                            title="Gestisci competenze categorie"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Riga espansa per gestione competenze (Agenti e Admin) */}
                  {canManageCompetencies && isExpanded && (
                    <tr className="bg-gradient-to-b from-gray-50 to-white">
                      <td colSpan={5} className="px-6 py-6">
                        <UserCompetenciesManager 
                          userId={u._id}
                          userName={u.name}
                          userEmail={u.email}
                          userClinicId={u.clinicId}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal semplice per nuovo utente */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md p-4 space-y-4 bg-white">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Nuovo utente</h2>
              <button className="text-gray-500" onClick={() => setIsOpen(false)}>✕</button>
            </div>
            <Input
              label="Nome"
              placeholder="Mario Rossi"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="Email"
              placeholder="mario.rossi@clinica.it"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Select
              label="Ruolo"
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
              options={roleOptions}
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Annulla</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Salvataggio...' : 'Crea utente'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
    </AppLayout>
  )
}


