'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LogIn } from 'lucide-react'

export default function Home() {
  const { user, login, isLoading } = useAuth()
  const router = useRouter()

  // Reindirizza alla dashboard se autenticato
  useEffect(() => {
    if (user) {
      router.push('/dashboard')
    }
  }, [user, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    )
  }

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