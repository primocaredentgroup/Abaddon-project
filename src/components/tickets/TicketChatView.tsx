'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ChatMessage } from './ChatMessage'
import { EditableTitle } from './EditableTitle'
import { EditableDescription } from './EditableDescription'
import { CommentInput } from './CommentInput'
import { TicketAttributes } from './TicketAttributes'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'

interface TicketChatViewProps {
  ticketId: string
}

const STATUS_LABELS = {
  open: 'Aperto',
  in_progress: 'In Lavorazione',
  closed: 'Chiuso',
}

const STATUS_COLORS = {
  open: 'red',
  in_progress: 'yellow',
  closed: 'green',
}

export const TicketChatView: React.FC<TicketChatViewProps> = ({ ticketId }) => {
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Queries
  const currentUser = useQuery(api.users.getCurrentUser, {})
  const ticket = useQuery(
    api.tickets.getById, 
    currentUser?.email ? { id: ticketId as any, userEmail: currentUser.email } : "skip"
  )
  const comments = useQuery(api.comments.getByTicket, { ticketId: ticketId as any })

  // Mutations
  const updateTicket = useMutation(api.tickets.update)
  const addComment = useMutation(api.comments.create)
  const changeStatus = useMutation(api.tickets.changeStatus)
  const assignTicket = useMutation(api.tickets.assign)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isScrolledToBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments, isScrolledToBottom])

  // Handle scroll events to track if user is at bottom
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10 // 10px tolerance
      setIsScrolledToBottom(isAtBottom)
    }
  }

  if (!ticket || !currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-gray-600">Caricamento ticket...</div>
        </div>
      </div>
    )
  }

  const canEditTicket = ticket.creatorId === currentUser._id && ticket.status !== 'closed'
  const canManageTicket = 
    ticket.assigneeId === currentUser._id ||
    ticket.creatorId === currentUser._id
    // TODO: Add role-based check for agents/admins

  const handleTitleChange = async (newTitle: string) => {
    await updateTicket({
      ticketId: ticketId as any,
      title: newTitle,
    })
  }

  const handleDescriptionChange = async (newDescription: string) => {
    await updateTicket({
      ticketId: ticketId as any,
      description: newDescription,
    })
  }

  const handleStatusChange = async (newStatus: 'open' | 'in_progress' | 'closed') => {
    await changeStatus({
      ticketId: ticketId as any,
      status: newStatus,
    })
  }

  const handleAssigneeChange = async (assigneeId?: string) => {
    await assignTicket({
      ticketId: ticketId as any,
      assigneeId: assigneeId as any,
    })
  }

  const handleAddComment = async (content: string) => {
    await addComment({
      ticketId: ticketId as any,
      content,
      isInternal: false,
    })
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsScrolledToBottom(true)
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b bg-gray-50 p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {canEditTicket ? (
              <EditableTitle
                value={ticket.title}
                onChange={handleTitleChange}
              />
            ) : (
              <h1 className="text-xl font-semibold text-gray-900 break-words">
                {ticket.title}
              </h1>
            )}
            <div className="flex items-center space-x-2 mt-2 text-sm text-gray-600">
              <span>#{ticketId.slice(-8)}</span>
              <span>•</span>
              <span>Creato da {ticket.creator?.name}</span>
              <span>•</span>
              <span>{new Date(ticket._creationTime).toLocaleDateString('it-IT')}</span>
            </div>
          </div>

          {canManageTicket && (
            <div className="flex items-center space-x-2 ml-4">
              <Badge color={STATUS_COLORS[ticket.status]}>
                {STATUS_LABELS[ticket.status]}
              </Badge>
              
              {ticket.status !== 'closed' && (
                <div className="flex items-center space-x-1">
                  {ticket.status === 'open' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange('in_progress')}
                    >
                      Prendi in carico
                    </Button>
                  )}
                  {ticket.status === 'in_progress' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange('closed')}
                    >
                      Chiudi
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ticket attributes */}
        <TicketAttributes ticketId={ticketId} />
      </div>

      {/* Chat area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleScroll}
      >
        {/* Initial message with description */}
        <ChatMessage
          author={ticket.creator}
          timestamp={ticket._creationTime}
          isInitial={true}
        >
          {canEditTicket ? (
            <EditableDescription
              value={ticket.description}
              onChange={handleDescriptionChange}
            />
          ) : (
            <div className="prose prose-sm max-w-none">
              {ticket.description.split('\n').map((line, index) => (
                <React.Fragment key={index}>
                  {line}
                  {index < ticket.description.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          )}
        </ChatMessage>

        {/* Comments */}
        {comments?.map((comment) => (
          <ChatMessage
            key={comment._id}
            author={comment.author}
            timestamp={comment._creationTime}
          >
            <div className="prose prose-sm max-w-none">
              {comment.content.split('\n').map((line, index) => (
                <React.Fragment key={index}>
                  {line}
                  {index < comment.content.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          </ChatMessage>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {!isScrolledToBottom && (
        <div className="absolute bottom-20 right-4">
          <Button
            size="sm"
            onClick={scrollToBottom}
            className="rounded-full shadow-lg"
          >
            ↓ Vai in fondo
          </Button>
        </div>
      )}

      {/* Comment input */}
      {ticket.status !== 'closed' && (
        <div className="border-t bg-gray-50 p-4">
          <CommentInput
            onSubmit={handleAddComment}
            placeholder="Aggiungi un commento..."
          />
        </div>
      )}

      {ticket.status === 'closed' && (
        <div className="border-t bg-gray-100 p-4 text-center text-gray-600">
          <div className="text-sm">
            Questo ticket è stato chiuso. Non è possibile aggiungere nuovi commenti.
          </div>
        </div>
      )}
    </div>
  )
}


