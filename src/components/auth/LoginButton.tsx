'use client'

import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { LogIn, LogOut, User } from 'lucide-react'

export function LoginButton() {
  const { user, isLoading, login, logout } = useAuth()

  if (isLoading) {
    return (
      <Button variant="ghost" disabled>
        <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </Button>
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4" />
          <span className="hidden sm:inline">{user.email}</span>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={login}>
      <LogIn className="w-4 h-4 mr-2" />
      Login
    </Button>
  )
}