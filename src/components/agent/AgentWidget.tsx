'use client'

import React, { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, User, Minimize2, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface AgentWidgetProps {
  className?: string
}

export function AgentWidget({ className }: AgentWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [inputMessage, setInputMessage] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll ai nuovi messaggi
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input quando aperto
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, isMinimized])

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const message = inputMessage.trim()
    setInputMessage('')
    setIsLoading(true)

    // Aggiungi messaggio utente
    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now()
    }
    
    setMessages(prev => [...prev, userMessage])

    // Simula risposta di Ermes
    setTimeout(() => {
      const botMessage = {
        id: `bot_${Date.now()}`,
        role: 'assistant',
        content: `Ciao! Sono Ermes 🤖 
        
Il tuo messaggio è stato: "${message}"

Al momento sto ancora imparando, ma presto potrò aiutarti con:
• 🔍 Ricerca ticket per ID, titolo o descrizione
• 💡 Suggerire categorie per nuovi ticket  
• ➕ Creare ticket automaticamente
• 🧭 Navigare nell'applicazione

Continua a testare le mie funzionalità! ✨`,
        timestamp: Date.now()
      }
      
      setMessages(prev => [...prev, botMessage])
      setIsLoading(false)
    }, 1500)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatMessage = (content: string) => {
    return content.replace(/\n/g, '<br/>')
  }

  const renderMessage = (message: any, index: number) => {
    const isUser = message.role === 'user'
    const timestamp = new Date(message.timestamp).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    })

    return (
      <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-2`}>
          {/* Avatar */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser 
              ? 'bg-blue-500 text-white' 
              : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
          }`}>
            {isUser ? <User size={16} /> : <Bot size={16} />}
          </div>

          {/* Messaggio */}
          <div className={`rounded-lg px-3 py-2 ${
            isUser 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-900'
          }`}>
            <div 
              className="text-sm leading-relaxed whitespace-pre-line"
              dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
            />
            <div className={`text-xs mt-1 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
              {timestamp}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Widget Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group ${className || ''}`}
          title="Apri Ermes AI"
        >
          <MessageCircle size={24} className="group-hover:scale-110 transition-transform" />
          {/* Badge notifica per nuovo utente */}
          {messages.length === 0 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            </div>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`fixed bottom-6 right-6 z-50 ${className || ''}`}>
          <div className={`bg-white rounded-lg shadow-2xl border transition-all duration-300 ${
            isMinimized 
              ? 'w-80 h-16' 
              : 'w-96 h-[600px]'
          }`}>
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-t-lg">
              <div className="flex items-center gap-2">
                <Bot size={20} />
                <div>
                  <h3 className="font-semibold text-sm">Ermes AI</h3>
                  {!isMinimized && (
                    <p className="text-xs opacity-90">
                      🟢 Online
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {/* Minimizza/Espandi */}
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title={isMinimized ? "Espandi" : "Minimizza"}
                >
                  {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
                
                {/* Chiudi */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title="Chiudi"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Contenuto */}
            {!isMinimized && (
              <>
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 h-[calc(600px-140px)]">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                      <Bot size={48} className="mb-4 text-gray-300" />
                      <h4 className="font-medium mb-2">Ciao! Sono Ermes 🤖</h4>
                      <p className="text-sm leading-relaxed">
                        Il tuo assistente intelligente! Posso aiutarti a:
                        <br />• 🔍 Cercare ticket per ID, titolo o descrizione
                        <br />• 💡 Suggerire categorie per nuovi ticket
                        <br />• ➕ Creare ticket automaticamente
                        <br />• 🧭 Navigare nell'applicazione
                      </p>
                      <p className="text-xs mt-4 text-gray-400">
                        Scrivi un messaggio per iniziare!
                      </p>
                    </div>
                  ) : (
                    <>
                      {messages.map(renderMessage)}
                      {isLoading && (
                        <div className="flex justify-start mb-4">
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center">
                              <Bot size={16} />
                            </div>
                            <div className="bg-gray-100 rounded-lg px-3 py-2">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t bg-gray-50">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Scrivi un messaggio a Ermes..."
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isLoading}
                      size="sm"
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      <Send size={16} />
                    </Button>
                  </div>
                  
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Ermes AI - Il tuo assistente intelligente
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}