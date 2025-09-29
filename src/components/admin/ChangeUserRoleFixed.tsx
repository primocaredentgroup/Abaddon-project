'use client'

import React, { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { User, UserCog, CheckCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export function ChangeUserRoleFixed() {
  const [isUpdating, setIsUpdating] = useState(false)
  const [success, setSuccess] = useState(false)

  // Usa la mutation semplificata che non richiede autenticazione
  const updateUserRole = useMutation("users:updateUserRoleByEmail")

  const handleChangeToAdmin = async () => {
    setIsUpdating(true)
    setSuccess(false)
    
    try {
      const result = await updateUserRole({
        email: "s.petretto@primogroup.it",
        newRoleName: "Amministratore"
      })
      
      console.log("✅ Ruolo aggiornato:", result)
      setSuccess(true)
      toast.success(`Ruolo cambiato con successo a ${result.newRoleName}!`)
      
      // Ricarica la pagina dopo 2 secondi per aggiornare la sidebar
      setTimeout(() => {
        window.location.reload()
      }, 2000)
      
    } catch (error) {
      console.error("❌ Errore cambio ruolo:", error)
      toast.error("Errore durante il cambio di ruolo")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card className="p-6 max-w-md mx-auto">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          {success ? (
            <CheckCircle className="h-16 w-16 text-green-500" />
          ) : (
            <UserCog className="h-16 w-16 text-blue-500" />
          )}
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {success ? "Ruolo Aggiornato!" : "Cambia Ruolo Utente"}
        </h3>
        
        <p className="text-gray-600 mb-4">
          {success 
            ? "Il tuo ruolo è stato cambiato ad Amministratore. La pagina si ricaricherà automaticamente."
            : "Clicca per cambiare il ruolo di s.petretto@primogroup.it ad Amministratore"
          }
        </p>
        
        {!success && (
          <Button
            onClick={handleChangeToAdmin}
            disabled={isUpdating}
            className="w-full flex items-center justify-center gap-2"
          >
            <User size={16} />
            {isUpdating ? "Aggiornamento..." : "Cambia a Amministratore"}
          </Button>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">
                Successo! Ora puoi accedere alle funzioni admin.
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export default ChangeUserRoleFixed

