'use client'

import { useState, useCallback } from 'react'
import { useAuth } from './useAuth'

export function useAgent() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Per ora semplifichiamo al massimo
  const isAgentEnabled = true
  const canUseAgent = true
  const hasActiveThread = true

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    setIsLoading(true)
    
    // Aggiungi messaggio utente
    const userMessage = {
      _id: `user_${Date.now()}`,
      role: 'user' as const,
      content: content.trim(),
      _creationTime: Date.now()
    }
    
    setMessages(prev => [...prev, userMessage])
    
    // Simula risposta di Ermes dopo un delay
    setTimeout(() => {
      const botMessage = {
        _id: `bot_${Date.now()}`,
        role: 'assistant' as const,
        content: `Ciao! Sono Ermes 🤖 Il tuo messaggio è stato: "${content}". Al momento sto ancora imparando, ma presto potrò aiutarti con la ricerca ticket, suggerire categorie e molto altro! ✨`,
        _creationTime: Date.now()
      }
      
      setMessages(prev => [...prev, botMessage])
      setIsLoading(false)
    }, 1000)
  }, [])

  const startNewConversation = useCallback(() => {
    setMessages([])
  }, [])

  const initializeThread = useCallback(() => {
    // Per ora non fa nulla, ma è necessario per il widget
  }, [])

  return {
    messages,
    isLoading,
    isAgentEnabled,
    canUseAgent,
    hasActiveThread,
    sendMessage,
    startNewConversation,
    initializeThread,
  }
}