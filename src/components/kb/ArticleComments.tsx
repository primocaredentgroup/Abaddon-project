'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useRole } from '@/providers/RoleProvider';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/use-toast';
import { MessageSquare, Send, Edit, Trash2, Reply } from 'lucide-react';

interface ArticleCommentsProps {
  articleId: string;
}

export function ArticleComments({ articleId }: ArticleCommentsProps) {
  const { user } = useRole();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Query commenti
  const comments = useQuery(
    api.kbComments.getCommentsByArticle,
    articleId ? { articleId: articleId as any } : "skip"
  );

  // Mutations
  const addComment = useMutation(api.kbComments.addComment);
  const editComment = useMutation(api.kbComments.editComment);
  const deleteComment = useMutation(api.kbComments.deleteComment);

  const handleAddComment = async () => {
    if (!user?.email || !newComment.trim()) return;

    try {
      await addComment({
        articleId: articleId as any,
        content: newComment,
        userEmail: user.email
      });
      setNewComment('');
      toast({
        title: '💬 Commento aggiunto!',
        description: 'Il tuo commento è stato pubblicato',
      });
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleReply = async (parentId: string) => {
    if (!user?.email || !replyContent.trim()) return;

    try {
      await addComment({
        articleId: articleId as any,
        content: replyContent,
        parentCommentId: parentId as any,
        userEmail: user.email
      });
      setReplyingTo(null);
      setReplyContent('');
      toast({
        title: '↩️ Risposta aggiunta!',
        description: 'La tua risposta è stata pubblicata',
      });
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleEdit = async (commentId: string) => {
    if (!user?.email || !editContent.trim()) return;

    try {
      await editComment({
        commentId: commentId as any,
        content: editContent,
        userEmail: user.email
      });
      setEditingId(null);
      setEditContent('');
      toast({
        title: '✏️ Commento modificato!',
        description: 'Le modifiche sono state salvate',
      });
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user?.email) return;
    if (!confirm('Vuoi eliminare questo commento?')) return;

    try {
      await deleteComment({
        commentId: commentId as any,
        userEmail: user.email
      });
      toast({
        title: '🗑️ Commento eliminato',
        description: 'Il commento è stato rimosso',
      });
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Oggi';
    if (days === 1) return 'Ieri';
    if (days < 7) return `${days} giorni fa`;
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Commenti ({comments?.length || 0})
        </h3>
      </div>

      {/* Nuovo Commento */}
      {user && (
        <div className="space-y-3">
          <Textarea
            placeholder="Aggiungi un commento..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={handleAddComment} disabled={!newComment.trim()}>
              <Send className="h-4 w-4 mr-2" />
              Pubblica
            </Button>
          </div>
        </div>
      )}

      {/* Lista Commenti */}
      <div className="space-y-4">
        {comments?.map((comment: any) => (
          <div key={comment._id} className="border rounded-lg p-4">
            {/* Commento Principale */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-semibold">
                  {comment.author?.name?.charAt(0) || '?'}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{comment.author?.name || 'Utente'}</span>
                  <span className="text-xs text-gray-500">{formatDate(comment._creationTime)}</span>
                  {comment.isEdited && (
                    <Badge variant="outline" size="sm">Modificato</Badge>
                  )}
                </div>
                
                {editingId === comment._id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleEdit(comment._id)}>
                        Salva
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Annulla
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                )}

                {/* Azioni */}
                {!editingId && (
                  <div className="flex items-center gap-3 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplyingTo(comment._id)}
                    >
                      <Reply className="h-3 w-3 mr-1" />
                      Rispondi
                    </Button>
                    {user?.email === comment.author?.email && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingId(comment._id);
                            setEditContent(comment.content);
                          }}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Modifica
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(comment._id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1 text-red-600" />
                          Elimina
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Form Risposta */}
                {replyingTo === comment._id && (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      placeholder="Scrivi una risposta..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleReply(comment._id)} disabled={!replyContent.trim()}>
                        Rispondi
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setReplyingTo(null)}>
                        Annulla
                      </Button>
                    </div>
                  </div>
                )}

                {/* Risposte */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-4 ml-6 space-y-3 border-l-2 border-gray-200 pl-4">
                    {comment.replies.map((reply: any) => (
                      <div key={reply._id} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-gray-600 font-semibold text-sm">
                            {reply.author?.name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-gray-900">{reply.author?.name || 'Utente'}</span>
                            <span className="text-xs text-gray-500">{formatDate(reply._creationTime)}</span>
                          </div>
                          <p className="text-sm text-gray-700">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {comments?.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            Nessun commento ancora. Sii il primo a commentare!
          </p>
        )}
      </div>
    </div>
  );
}


