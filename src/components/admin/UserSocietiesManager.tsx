'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/../convex/_generated/api';
import { Id } from '@/../convex/_generated/dataModel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Building2, X, Plus, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface UserSocietiesManagerProps {
  userId: Id<"users">;
  userName: string;
  userEmail: string;
}

export function UserSocietiesManager({ userId, userName, userEmail }: UserSocietiesManagerProps) {
  
  const { user: currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSocieties, setSelectedSocieties] = useState<Id<"societies">[]>([]);

  // Carica tutte le società disponibili
  const allSocieties = useQuery(
    api.societies.getAllSocieties,
    { activeOnly: true }
  ) || [];

  // Carica le società attuali dell'utente
  const userSocieties = useQuery(
    api.societies.getUserSocieties,
    { userId, activeOnly: true }
  ) || [];

  // Mutations per assegnare/rimuovere società
  const assignSociety = useMutation(api.societies.assignSocietyToUser);
  const removeSociety = useMutation(api.societies.removeSocietyFromUser);

  // Inizializza le società selezionate quando inizia l'editing
  const handleStartEdit = () => {
    setSelectedSocieties(userSocieties.map((s: any) => s._id));
    setIsEditing(true);
  };

  // Toggle selezione società
  const toggleSociety = (societyId: Id<"societies">) => {
    if (selectedSocieties.includes(societyId)) {
      setSelectedSocieties(selectedSocieties.filter(id => id !== societyId));
    } else {
      setSelectedSocieties([...selectedSocieties, societyId]);
    }
  };

  // Salva le modifiche
  const handleSave = async () => {
    if (!currentUser?.email) {
      toast.error('Devi essere autenticato');
      return;
    }

    try {
      // Identifica società da aggiungere e da rimuovere
      const currentSocietyIds = userSocieties.map((s: any) => s._id);
      const toAdd = selectedSocieties.filter(id => !currentSocietyIds.includes(id));
      const toRemove = currentSocietyIds.filter(id => !selectedSocieties.includes(id));

      // Esegui le operazioni
      for (const societyId of toAdd) {
        await assignSociety({ userId, societyId });
      }

      for (const societyId of toRemove) {
        await removeSociety({ userId, societyId });
      }

      toast.success(`Società di ${userName} aggiornate con successo!`);
      setIsEditing(false);
    } catch (error: any) {
      console.error('Errore aggiornamento società:', error);
      toast.error(error.message || 'Impossibile aggiornare le società');
    }
  };

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">Gestione Società</CardTitle>
          </div>
          {!isEditing ? (
            <Button 
              size="sm" 
              onClick={handleStartEdit}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Modifica Società
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setIsEditing(false);
                  setSelectedSocieties(userSocieties.map((s: any) => s._id));
                }}
              >
                Annulla
              </Button>
              <Button 
                size="sm" 
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Salva
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Info utente */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm text-purple-900">
              <span className="font-semibold">Utente:</span> {userName} ({userEmail})
            </p>
            <p className="text-sm text-purple-700 mt-1">
              Società assegnate: <span className="font-bold">{userSocieties.length}</span>
            </p>
          </div>

          {/* Modalità visualizzazione */}
          {!isEditing && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Società Assegnate:</p>
              {userSocieties.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Nessuna società assegnata</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {userSocieties.map((society: any) => (
                    <Badge 
                      key={society._id} 
                      variant="default"
                      className="bg-purple-100 text-purple-800 px-3 py-1"
                    >
                      <Building2 className="h-3 w-3 mr-1" />
                      {society.name} ({society.code})
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Modalità editing */}
          {isEditing && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">
                Seleziona le società da assegnare a {userName}:
              </p>
              
              {allSocieties.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Nessuna società disponibile</p>
                  <p className="text-sm">Crea prima delle società per poterle assegnare</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                  {allSocieties.map((society: any) => {
                    const isSelected = selectedSocieties.includes(society._id);
                    return (
                      <div
                        key={society._id}
                        onClick={() => toggleSociety(society._id)}
                        className={`
                          flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all
                          ${isSelected 
                            ? 'border-purple-500 bg-purple-50' 
                            : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                          }
                        `}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`
                            w-5 h-5 rounded border-2 flex items-center justify-center
                            ${isSelected 
                              ? 'border-purple-600 bg-purple-600' 
                              : 'border-gray-300'
                            }
                          `}>
                            {isSelected && (
                              <CheckCircle className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{society.name}</p>
                            <p className="text-xs text-gray-500">Codice: {society.code}</p>
                            {society.description && (
                              <p className="text-xs text-gray-400 mt-1">{society.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 border-t">
                <p className="text-xs text-gray-500">
                  Selezionate: <span className="font-bold text-purple-600">{selectedSocieties.length}</span> / {allSocieties.length}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

