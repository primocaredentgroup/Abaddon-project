'use client'

import React, { useState, useRef, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useAuth } from '@/hooks/useAuth'
import { 
  MessageSquare,
  Send,
  Bot,
  Search,
  HelpCircle,
  Navigation,
  Ticket,
  Lightbulb,
  User,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  type?: 'text' | 'ticket_search' | 'category_suggestion' | 'action_advice' | 'navigation_help'
  data?: any
}

interface TicketInfo {
  _id: string
  ticketNumber: string
  title: string
  status: string
  priority: string
  category: string
  assignee?: string
  createdAt: string
}

export default function AgentPage() {
  const { user } = useAuth()
  const [inputMessage, setInputMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Ciao! Sono il tuo assistente AI per il portale ticket. Posso aiutarti a:\n\n🔍 **Ricercare ticket** - Dimmi il numero di ticket che cerchi\n📂 **Categorizzare problemi** - Descrivimi il tuo problema e ti suggerirò la categoria giusta\n💡 **Consigliare azioni** - Posso guidarti sulle migliori pratiche per risolvere i problemi\n🧭 **Navigare l\'app** - Chiedimi come trovare qualsiasi funzionalità\n\nCome posso aiutarti oggi?',
      timestamp: new Date(),
      type: 'text'
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get clinic ID from user
  const clinicId = (user as any)?.clinic?._id

  // Simulazione ricerca ticket (da sostituire con query Convex reali)
  const searchTickets = async (query: string): Promise<TicketInfo[]> => {
    // Simulazione - in futuro useremo useQuery(api.tickets.search)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const mockTickets: TicketInfo[] = [
      { _id: '1', ticketNumber: 'TK-001', title: 'Problema accesso software', status: 'open', priority: 'high', category: 'software', assignee: 'Mario Rossi', createdAt: '2024-01-15' },
      { _id: '2', ticketNumber: 'TK-002', title: 'Stampante non funziona', status: 'in_progress', priority: 'medium', category: 'hardware', assignee: 'Laura Bianchi', createdAt: '2024-01-14' },
      { _id: '3', ticketNumber: 'TK-003', title: 'Reset password', status: 'resolved', priority: 'urgent', category: 'account', assignee: 'Paolo Verdi', createdAt: '2024-01-13' }
    ]
    
    return mockTickets.filter(ticket => 
      ticket.ticketNumber.toLowerCase().includes(query.toLowerCase()) ||
      ticket.title.toLowerCase().includes(query.toLowerCase())
    )
  }

  // Funzione per inviare messaggio all'agente
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
      type: 'text'
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      // Simulazione risposta dell'agente (da sostituire con chiamata Convex reale)
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const response = await generateAgentResponse(inputMessage)
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        type: response.type,
        data: response.data
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Errore nella comunicazione con l\'agente:', error)
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Mi dispiace, ho riscontrato un problema. Per favore riprova più tardi.',
        timestamp: new Date(),
        type: 'text'
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Funzione per generare risposta dell'agente (simulazione)
  const generateAgentResponse = async (userInput: string): Promise<{ content: string; type: Message['type']; data?: any }> => {
    const input = userInput.toLowerCase()
    
    // Ricerca ticket
    if (input.includes('tk-') || input.includes('ticket') || input.includes('cerca')) {
      const ticketNumber = input.match(/tk-\d+/i)?.[0]
      if (ticketNumber) {
        const tickets = await searchTickets(ticketNumber)
        if (tickets.length > 0) {
          return {
            content: `Ho trovato ${tickets.length} ticket corrispondenti alla tua ricerca:\n\n${tickets.map(ticket => 
              `**${ticket.ticketNumber}** - ${ticket.title}\n   📊 Stato: ${ticket.status}\n   ⚡ Priorità: ${ticket.priority}\n   📂 Categoria: ${ticket.category}\n   👤 Assegnato a: ${ticket.assignee || 'Nessuno'}`
            ).join('\n\n')}`,
            type: 'ticket_search',
            data: { tickets }
          }
        }
      }
      return {
        content: 'Non ho trovato ticket corrispondenti alla tua ricerca. Prova con un numero di ticket diverso o descrivi meglio cosa stai cercando.',
        type: 'ticket_search'
      }
    }
    
    // Suggerimento categoria
    if (input.includes('categoria') || input.includes('dove') || input.includes('aprire') || input.includes('problema')) {
      return {
        content: 'Base sulla tua descrizione, ti suggerisco queste categorie:\n\n🔧 **Hardware** - Se il problema riguarda dispositivi fisici, stampanti, computer\n💻 **Software** - Per problemi con programmi, applicazioni, accessi\n🔐 **Sicurezza** - Issue di sicurezza, accessi non autorizzati, virus\n🌐 **Rete** - Problemi di connessione, WiFi, internet\n📊 **Account** - Reset password, creazione utenti, permessi\n🔧 **Manutenzione** - Interventi programmati, aggiornamenti\n\nPosso aiutarti a scegliere la categoria giusta se mi dai più dettagli sul problema!',
        type: 'category_suggestion'
      }
    }
    
    // Consiglio azioni
    if (input.includes('fare') || input.includes('come') || input.includes('risolvere')) {
      return {
        content: 'Ecco alcuni consigli per gestire al meglio i ticket:\n\n📋 **Prima di aprire un ticket:**\n- Controlla se il problema è già noto\n- Riavvia il dispositivo o applicazione\n- Raccogli tutte le informazioni rilevanti (errori, screenshot)\n\n⚡ **Durante la gestione:**\n- Aggiorna regolarmente lo stato del ticket\n- Comunica con l\'utente per avere maggiori dettagli\n- Documenta tutte le azioni performed\n\n✅ **Per chiudere un ticket:**\n- Assicurati che il problema sia risolto\n- Chiedi conferma all\'utente\n- Documenta la soluzione implementata\n\nHai bisogno di consigli più specifici per una situazione particolare?',
        type: 'action_advice'
      }
    }
    
    // Aiuto navigazione
    if (input.includes('navigare') || input.includes('trovare') || input.includes('dove è') || input.includes('come arrivo')) {
      return {
        content: 'Posso aiutarti a navigare nel portale! Ecco le principali sezioni:\n\n🎫 **I miei ticket** - Per vedere i ticket assegnati a te\n🏥 **Ticket clinica** - Tutti i ticket della tua clinica\n⏱️ **SLA Monitor** - Gestisci le regole Service Level Agreement\n🤖 **Automation** - Macro e trigger automatici\n📚 **Knowledge Base** - Articoli e documentazione\n👥 **Utenti** - Gestione utenti e permessi\n\n**Per accedere velocemente:**\n- Usa la barra di ricerca in alto\n- I link nella sidebar a sinistra\n- I breadcrumb nella parte superiore della pagina\n\nDove vuoi andare o cosa vuoi trovare?',
        type: 'navigation_help'
      }
    }
    
    // Risposta di default
    return {
      content: 'Sono qui per aiutarti! Posso:\n\n🔍 **Ricercare ticket** - Dimmi il numero di ticket che cerchi\n📂 **Suggerire categorie** - Descrivi il problema e ti aiuterò a scegliere\n💡 **Consigliare azioni** - Chiedimi come gestire situazioni specifiche\n🧭 **Aiutarti a navigare** - Indicami dove vuoi andare\n\nCosa di cui hai bisogno proprio in questo momento?',
      type: 'text'
    }
  }

  // Auto-scroll all'ultimo messaggio
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Gestisci invio con Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!user) {
    return <div>Caricamento...</div>
  }

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Bot className="h-8 w-8 mr-3 text-blue-600" />
              Assistente AI
            </h1>
            <p className="text-gray-600 mt-2">
              Il tuo assistente intelligente per la gestione dei ticket e la navigazione del portale
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setInputMessage('Cerca il ticket TK-')}>
            <CardContent className="p-4 text-center">
              <Search className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p className="text-sm font-medium">Ricerca Ticket</p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setInputMessage('Ho un problema con il computer, in quale categoria devo aprire il ticket?')}>
            <CardContent className="p-4 text-center">
              <HelpCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm font-medium">Suggerisci Categoria</p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setInputMessage('Come gestisco un ticket urgente?')}>
            <CardContent className="p-4 text-center">
              <Lightbulb className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-sm font-medium">Consigli Azioni</p>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setInputMessage('Come trovo i ticket della mia clinica?')}>
            <CardContent className="p-4 text-center">
              <Navigation className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <p className="text-sm font-medium">Aiuto Navigazione</p>
            </CardContent>
          </Card>
        </div>

        {/* Chat Container */}
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Chat con l'Assistente
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-3xl rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : message.type === 'ticket_search'
                        ? 'bg-green-50 border border-green-200'
                        : message.type === 'category_suggestion'
                        ? 'bg-yellow-50 border border-yellow-200'
                        : message.type === 'action_advice'
                        ? 'bg-purple-50 border border-purple-200'
                        : message.type === 'navigation_help'
                        ? 'bg-indigo-50 border border-indigo-200'
                        : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      {message.role === 'assistant' && (
                        <div className="flex-shrink-0">
                          <Bot className="h-5 w-5 text-blue-600" />
                        </div>
                      )}
                      <div className="flex-1">
                        {message.type === 'ticket_search' && message.data?.tickets && (
                          <div className="mb-3">
                            <Badge className="bg-green-100 text-green-800 border-green-300">
                              <Search className="h-3 w-3 mr-1" />
                              Risultati ricerca
                            </Badge>
                          </div>
                        )}
                        
                        {message.type === 'category_suggestion' && (
                          <div className="mb-3">
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                              <HelpCircle className="h-3 w-3 mr-1" />
                              Suggerimenti categoria
                            </Badge>
                          </div>
                        )}
                        
                        {message.type === 'action_advice' && (
                          <div className="mb-3">
                            <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                              <Lightbulb className="h-3 w-3 mr-1" />
                              Consigli operativi
                            </Badge>
                          </div>
                        )}
                        
                        {message.type === 'navigation_help' && (
                          <div className="mb-3">
                            <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">
                              <Navigation className="h-3 w-3 mr-1" />
                              Aiuto navigazione
                            </Badge>
                          </div>
                        )}
                        
                        <div className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs opacity-60">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                          {message.role === 'user' && (
                            <User className="h-3 w-3" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-3xl">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-gray-600">L\'assistente sta scrivendo...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input */}
            <div className="border-t p-4">
              <div className="flex space-x-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Chiedimi anything: cerca un ticket, suggerisci una categoria, chiedi consigli..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button 
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="mt-2 text-xs text-gray-500">
                💡 Prova a chiedere: "Cerca il ticket TK-001", "Ho un problema con la stampante", "Come gestisco un ticket urgente?"
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
