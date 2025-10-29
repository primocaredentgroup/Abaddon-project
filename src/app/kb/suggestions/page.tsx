'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useRole } from '@/providers/RoleProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { 
  Lightbulb,
  CheckCircle,
  XCircle,
  Clock,
  User,
  MessageSquare
} from 'lucide-react';

type Suggestion = {
  _id: string;
  title: string;
  description: string;
  category: string;
  priority: 'Bassa' | 'Media' | 'Alta';
  status: 'pending' | 'approved' | 'rejected';
  suggestor?: { name: string; email: string };
  reviewer?: { name: string; email: string };
  reviewNotes?: string;
  _creationTime: number;
};

export default function KBSuggestionsPage() {
  const { user } = useRole();
  const { toast } = useToast();
  const router = useRouter();
  
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Verifica permessi
  const canManage = user?.roleName === 'Agente' || user?.roleName === 'Amministratore';

  // Query suggerimenti
  const clinicId = user?.clinicId;
  const allSuggestions = useQuery(
    api.kbArticles.getSuggestionsByClinic,
    clinicId && user?.email ? { 
      clinicId,
      userEmail: user.email,
      status: selectedStatus === 'all' ? undefined : selectedStatus
    } : "skip"
  );

  // Mutation
  const reviewSuggestion = useMutation(api.kbArticles.reviewSuggestion);

  // Redirect se non autorizzato
  if (!canManage) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-red-600 font-medium">
              ⛔ Accesso negato. Solo agenti e amministratori possono revisionare i suggerimenti.
            </p>
            <Button className="mt-4" onClick={() => router.push('/kb')}>
              Torna alla Knowledge Base
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const handleReview = async (suggestionId: string, action: 'approve' | 'reject') => {
    if (!user?.email) return;

    try {
      await reviewSuggestion({
        suggestionId: suggestionId as any,
        action,
        notes: reviewNotes,
        userEmail: user.email
      });

      toast({
        title: action === 'approve' ? '✅ Suggerimento approvato' : '❌ Suggerimento rifiutato',
        description: action === 'approve' 
          ? 'Ora puoi creare un articolo basato su questo suggerimento' 
          : 'Il suggerimento è stato rifiutato',
      });

      setReviewingId(null);
      setReviewNotes('');
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
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingCount = allSuggestions?.filter((s: Suggestion) => s.status === 'pending').length || 0;
  const approvedCount = allSuggestions?.filter((s: Suggestion) => s.status === 'approved').length || 0;
  const rejectedCount = allSuggestions?.filter((s: Suggestion) => s.status === 'rejected').length || 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Lightbulb className="h-6 w-6 mr-2 text-yellow-500" />
            Suggerimenti Articoli KB
          </h1>
          <p className="text-gray-600">Revisiona i suggerimenti degli utenti</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md" onClick={() => setSelectedStatus('all')}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-900">{allSuggestions?.length || 0}</div>
              <div className="text-sm text-gray-600">Totali</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md border-orange-200" onClick={() => setSelectedStatus('pending')}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
              <div className="text-sm text-gray-600">In Attesa</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md border-green-200" onClick={() => setSelectedStatus('approved')}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
              <div className="text-sm text-gray-600">Approvati</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md border-red-200" onClick={() => setSelectedStatus('rejected')}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
              <div className="text-sm text-gray-600">Rifiutati</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtri */}
        <div className="flex gap-2">
          <Button
            variant={selectedStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedStatus('all')}
          >
            Tutti
          </Button>
          <Button
            variant={selectedStatus === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedStatus('pending')}
          >
            In Attesa
          </Button>
          <Button
            variant={selectedStatus === 'approved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedStatus('approved')}
          >
            Approvati
          </Button>
          <Button
            variant={selectedStatus === 'rejected' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedStatus('rejected')}
          >
            Rifiutati
          </Button>
        </div>

        {/* Lista Suggerimenti */}
        <div className="space-y-4">
          {allSuggestions?.map((suggestion: Suggestion) => (
            <Card
              key={suggestion._id}
              className={
                suggestion.status === 'pending' ? 'border-orange-200' :
                suggestion.status === 'approved' ? 'border-green-200' :
                'border-red-200'
              }
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{suggestion.title}</h3>
                      <Badge variant="default" size="sm">{suggestion.category}</Badge>
                      <Badge 
                        variant={
                          suggestion.priority === 'Alta' ? 'danger' :
                          suggestion.priority === 'Media' ? 'warning' : 'default'
                        }
                        size="sm"
                      >
                        {suggestion.priority}
                      </Badge>
                      {suggestion.status === 'pending' && (
                        <Badge variant="warning" size="sm">
                          <Clock className="h-3 w-3 mr-1" />
                          In Attesa
                        </Badge>
                      )}
                      {suggestion.status === 'approved' && (
                        <Badge variant="success" size="sm">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approvato
                        </Badge>
                      )}
                      {suggestion.status === 'rejected' && (
                        <Badge variant="danger" size="sm">
                          <XCircle className="h-3 w-3 mr-1" />
                          Rifiutato
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-gray-700 mb-3 whitespace-pre-wrap">{suggestion.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        {suggestion.suggestor?.name || 'Utente'}
                      </span>
                      <span>{formatDate(suggestion._creationTime)}</span>
                      {suggestion.reviewer && (
                        <span className="flex items-center">
                          Revisionato da: {suggestion.reviewer.name}
                        </span>
                      )}
                    </div>

                    {suggestion.reviewNotes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-600 flex items-start">
                          <MessageSquare className="h-4 w-4 mr-2 mt-0.5" />
                          <span><strong>Note:</strong> {suggestion.reviewNotes}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Azioni per suggerimenti pending */}
                {suggestion.status === 'pending' && (
                  <div className="border-t pt-4">
                    {reviewingId === suggestion._id ? (
                      <div className="space-y-3">
                        <Textarea
                          placeholder="Note di revisione (opzionale)..."
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReviewingId(null);
                              setReviewNotes('');
                            }}
                          >
                            Annulla
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReview(suggestion._id, 'reject')}
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Rifiuta
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleReview(suggestion._id, 'approve')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approva
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewingId(suggestion._id)}
                        >
                          Revisiona
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {(!allSuggestions || allSuggestions.length === 0) && (
            <Card>
              <CardContent className="p-12 text-center">
                <Lightbulb className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nessun suggerimento {selectedStatus !== 'all' && selectedStatus}
                </h3>
                <p className="text-gray-600">
                  {selectedStatus === 'pending' 
                    ? 'Non ci sono suggerimenti da revisionare al momento'
                    : 'Non ci sono suggerimenti in questa categoria'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}



