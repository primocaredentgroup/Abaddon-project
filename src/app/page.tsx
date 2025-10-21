'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LogIn } from 'lucide-react'
import { useEffect } from 'react'
import { useConvexAuth } from 'convex/react'
import { useAuth0 } from '@auth0/auth0-react'

export default function Home() {
  const { user, isLoading: userLoading, login } = useAuth()
  const { isAuthenticated, isLoading: convexAuthLoading } = useConvexAuth()
  const { user: auth0User, isAuthenticated: auth0IsAuthenticated, isLoading: auth0IsLoading } = useAuth0()
  const router = useRouter()


  // Redirect quando l'utente è autenticato con Convex e i dati sono caricati
  useEffect(() => {
    if (!convexAuthLoading && isAuthenticated && !userLoading && user) {
      
      // Redirect basato sul ruolo
      if (user.ruolo === 'agent' || user.roleName === 'Agente') {
        router.replace('/tickets/assigned')
      } else {
        router.replace('/dashboard')
      }
    }
  }, [isAuthenticated, convexAuthLoading, userLoading, user, router])

  // Mostra loading durante autenticazione o caricamento dati
  if (convexAuthLoading || (isAuthenticated && userLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">
            {convexAuthLoading ? 'Autenticazione Convex...' : 'Caricamento dati utente...'}
          </p>
        </div>
      </div>
    )
  }

  // Mostra loading durante redirect
  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Reindirizzamento...</p>
        </div>
      </div>
    )
  }

  // Mostra login se non autenticato
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center pb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900">HealthDesk</CardTitle>
          <CardDescription className="text-lg text-gray-600">
            Sistema di gestione ticket per cliniche sanitarie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <Button 
              onClick={login}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg"
            >
              <LogIn className="w-5 h-5 mr-3" />
              Accedi con Auth0
            </Button>
          </div>
          
          <div className="text-center text-sm text-gray-500">
            <p>Accedi con il tuo account Auth0 per iniziare</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}