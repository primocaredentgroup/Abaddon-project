'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/../convex/_generated/api';
import { Id } from '@/../convex/_generated/dataModel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useToast } from '@/components/ui/use-toast';
import { Tag, X, Plus, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface UserCompetenciesManagerProps {
  userId: Id<"users">;
  userName: string;
  userEmail: string;
  userClinicId: Id<"clinics">;
}

export function UserCompetenciesManager({ userId, userName, userEmail, userClinicId }: UserCompetenciesManagerProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Id<"categories">[]>([]);

  // Carica tutte le categorie disponibili della clinica dell'utente
  const allCategories = useQuery(
    api.categories.getAllCategories,
    { clinicId: userClinicId }
  ) || [];

  // Carica le competenze attuali dell'utente
  const userCompetencies = useQuery(
    api.userCompetencies.getUserCompetencies,
    { userId }
  ) || [];

  // Mutation per assegnare le competenze
  const assignCompetencies = useMutation(api.userCompetencies.assignCompetenciesToUser);

  // Inizializza le categorie selezionate quando inizia l'editing
  const handleStartEdit = () => {
    setSelectedCategories(userCompetencies.map(c => c._id));
    setIsEditing(true);
  };

  // Toggle selezione categoria
  const toggleCategory = (categoryId: Id<"categories">) => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter(id => id !== categoryId));
    } else {
      setSelectedCategories([...selectedCategories, categoryId]);
    }
  };

  // Salva le modifiche
  const handleSave = async () => {
    if (!currentUser?.email) {
      toast({
        title: 'Errore',
        description: 'Devi essere autenticato',
        variant: 'destructive'
      });
      return;
    }

    try {
      await assignCompetencies({
        userId,
        categoryIds: selectedCategories,
        adminEmail: currentUser.email
      });

      toast({
        title: 'Competenze aggiornate',
        description: `Assegnate ${selectedCategories.length} categorie a ${userName}`,
        variant: 'default'
      });

      setIsEditing(false);
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile aggiornare le competenze',
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Categorie di Competenza</CardTitle>
          </div>
          {!isEditing ? (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleStartEdit}
            >
              <Plus className="h-4 w-4 mr-2" />
              Modifica
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setIsEditing(false);
                  setSelectedCategories([]);
                }}
              >
                Annulla
              </Button>
              <Button 
                size="sm" 
                onClick={handleSave}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Salva
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          // Modalità editing: mostra tutte le categorie con checkbox
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-4">
              Seleziona le categorie in cui l'agente ha competenza. L'agente vedrà solo i ticket di queste categorie.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {allCategories.map((category) => {
                const isSelected = selectedCategories.includes(category._id);
                return (
                  <div
                    key={category._id}
                    onClick={() => toggleCategory(category._id)}
                    className={`
                      p-3 border-2 rounded-lg cursor-pointer transition-all
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{category.name}</span>
                      {isSelected && (
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    {category.description && (
                      <p className="text-xs text-gray-500 mt-1">{category.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="pt-2 text-sm text-gray-600">
              Selezionate: <strong>{selectedCategories.length}</strong> categorie
            </div>
          </div>
        ) : (
          // Modalità visualizzazione
          <div>
            {userCompetencies.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {userCompetencies.map((category) => (
                  <Badge 
                    key={category._id} 
                    variant="secondary"
                    className="px-3 py-1 text-sm"
                  >
                    {category.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nessuna competenza assegnata</p>
                <p className="text-xs mt-1">Questo agente non ha categorie di competenza specifiche</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

