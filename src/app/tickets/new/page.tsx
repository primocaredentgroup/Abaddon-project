'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { useRouter } from 'next/navigation';
import { api } from '@/convex/_generated/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useRole } from '@/providers/RoleProvider';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { KBWidget } from '@/components/kb/KBWidget';
import { ArrowLeft, Upload, User, Tag, Sparkles, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useDebounce } from '@/hooks/useDebounce';


export default function NewTicketPage() {
  const { user } = useRole();
  const { user: authUser } = useAuth();
  const router = useRouter();
  
  // Mutation per creare il ticket con autenticazione
  const createTicket = useMutation(api.tickets.createWithAuth);
  
  // Ottieni l'email dell'utente corrente (necessario per le mutation)
  const currentUserEmail = authUser?.email || user?.email;
  
  // Estrai clinicId e userId in modo sicuro
  const clinicId = (authUser as any)?.clinicId || (authUser as any)?.clinic?._id
  const userId = (authUser as any)?.id // 🔥 FIX: useAuth ritorna "id" invece di "_id"
  
  // Query per ottenere le categorie pubbliche filtrate per società dell'utente
  const categoriesData = useQuery(
    api.categories.getPublicCategoriesByUserSocieties,
    (clinicId && userId) ? { clinicId, userId } : "skip"
  );
  
  // Trasforma le categorie nel formato atteso dal Select
  const categories = categoriesData 
    ? categoriesData.map(cat => ({ 
        value: cat._id, 
        label: cat.name 
      }))
    : [];
  
  // Stato di caricamento
  const isLoadingCategories = categoriesData === undefined;
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    visibility: 'public',
    tags: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 🤖 Agent AI States
  const [agentSuggestion, setAgentSuggestion] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  
  // 📝 Required Attributes States
  const [requiredAttributes, setRequiredAttributes] = useState<any[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, any>>({});
  
  // Actions & Mutations
  const suggestCategory = useAction(api.agent.suggestCategory);
  const saveAgentFeedback = useMutation(api.agent.saveAgentFeedback); // 🆕 Feedback agent
  const createTicketAttribute = useMutation(api.ticketAttributes.create);
  
  // Debounced description for agent analysis
  const debouncedDescription = useDebounce(formData.description, 2000);
  
  // Query per TUTTI gli attributi della categoria (per salvarli nel DB)
  const allCategoryAttributesForSaving = useQuery(
    api.categoryAttributes.getByCategory,
    formData.category ? { 
      categoryId: formData.category as any,
    } : "skip"
  );

  // Query per attributi da mostrare nel form (solo showInCreation: true)
  const allCategoryAttributes = useQuery(
    api.categoryAttributes.getByCategory,
    formData.category ? { 
      categoryId: formData.category as any,
      showInCreation: true 
    } : "skip"
  );

  // Filtra gli attributi in base al ruolo: rimuovi agentOnly se l'utente NON è agente
  const categoryAttributes = useMemo(() => {
    if (!allCategoryAttributes) return allCategoryAttributes;
    
    // Confronto case-insensitive con versioni italiane e inglesi
    const roleLower = user?.roleName?.toLowerCase();
    const isAgent = roleLower === 'agent' || roleLower === 'agente' || roleLower === 'admin' || roleLower === 'amministratore';
    
    // Se è agente, mostra tutti gli attributi
    if (isAgent) return allCategoryAttributes;
    
    // Se è utente normale, rimuovi gli attributi agentOnly
    return allCategoryAttributes.filter((attr: any) => !attr.agentOnly);
  }, [allCategoryAttributes, user?.roleName]);

  // 🤖 Effect: Analizza la descrizione con l'Agent AI
  useEffect(() => {
    const analyzeDescription = async () => {
      if (!debouncedDescription || debouncedDescription.length < 10 || !clinicId || !userId || !formData.title) {
        return;
      }
      
      setIsAnalyzing(true);
      try {
        const suggestion = await suggestCategory({
          title: formData.title,
          description: debouncedDescription,
          clinicId: clinicId as any,
          userId: userId as any // 🆕 Passa userId per filtro società
        });
        
        setAgentSuggestion(suggestion);
        setShowSuggestion(true);
      } catch (error) {
        console.error('❌ Error analyzing description:', error);
      } finally {
        setIsAnalyzing(false);
      }
    };
    
    analyzeDescription();
  }, [debouncedDescription, formData.title, clinicId, userId, suggestCategory]);
  
  // 📝 Effect: Carica attributi obbligatori quando cambia la categoria
  useEffect(() => {
    if (categoryAttributes) {
      const required = categoryAttributes.filter(attr => attr.required);
      setRequiredAttributes(required);
      
      // Reset attribute values when category changes
      const newValues: Record<string, any> = {};
      required.forEach(attr => {
        newValues[attr.slug] = '';
      });
      setAttributeValues(newValues);
    }
  }, [categoryAttributes]);
  
  // 🔒 Effect: Imposta la visibilità di default quando cambia la categoria
  // SOLO se l'utente non ha ancora scelto manualmente una visibilità
  const [visibilitySetByUser, setVisibilitySetByUser] = useState(false);
  const [previousCategory, setPreviousCategory] = useState('');
  
  useEffect(() => {
    // Imposta la visibilità di default SOLO quando cambia categoria per la prima volta
    // NON sovrascrivere se l'utente ha già fatto una scelta manuale
    if (formData.category && categoriesData && formData.category !== previousCategory && !visibilitySetByUser) {
      const selectedCategory = categoriesData.find(cat => cat._id === formData.category);
      if (selectedCategory && selectedCategory.defaultTicketVisibility) {
        setFormData(prev => ({
          ...prev,
          visibility: selectedCategory.defaultTicketVisibility
        }));
      }
      setPreviousCategory(formData.category);
    }
  }, [formData.category, categoriesData, previousCategory, visibilitySetByUser]);
  
  // 🎯 Handler: Applica suggerimento dell'agent
  const handleApplySuggestion = () => {
    if (agentSuggestion?.recommendedCategory) {
      setFormData({
        ...formData,
        category: agentSuggestion.recommendedCategory._id
      });
      setShowSuggestion(false);
    }
  };
  
  // 🚫 Handler: Rifiuta suggerimento dell'agent
  const handleRejectSuggestion = async () => {
    if (agentSuggestion?.recommendedCategory && userId && clinicId) {
      try {
        // Salva feedback negativo
        await saveAgentFeedback({
          userId: userId as any,
          clinicId: clinicId as any,
          suggestedCategoryId: agentSuggestion.recommendedCategory._id,
          suggestedCategoryName: agentSuggestion.recommendedCategory.name,
          ticketTitle: formData.title,
          ticketDescription: formData.description,
          feedbackType: "wrong_category" as const,
          confidence: agentSuggestion.confidence,
        });
        
        setShowSuggestion(false);
        setAgentSuggestion(null);
      } catch (error) {
        console.error('❌ Errore salvataggio feedback:', error);
      }
    } else {
      // Se non ci sono dati sufficienti, chiudi semplicemente il suggerimento
      setShowSuggestion(false);
      setAgentSuggestion(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // VALIDAZIONE: Verifica che l'utente sia autenticato
    if (!currentUserEmail) {
      alert('Errore: Utente non autenticato. Ricarica la pagina e riprova.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Validazioni
      if (!formData.title.trim()) {
        alert('Il titolo è obbligatorio');
        return;
      }
      
      if (!formData.description.trim()) {
        alert('La descrizione è obbligatoria');
        return;
      }
      
      if (!formData.category) {
        alert('Seleziona una categoria');
        return;
      }
      
      // 📝 Validazione attributi obbligatori
      const missingAttributes = requiredAttributes.filter(attr => {
        const value = attributeValues[attr.slug];
        return !value || (typeof value === 'string' && value.trim() === '');
      });
      
      if (missingAttributes.length > 0) {
        const missingNames = missingAttributes.map(attr => attr.name).join(', ');
        alert(`Per favore, compila i seguenti campi obbligatori: ${missingNames}`);
        return;
      }
      
      // Crea il ticket su Convex con autenticazione
      const result = await createTicket({
        title: formData.title.trim(),
        description: formData.description.trim(),
        categoryId: formData.category as any, // Cast necessario per TypeScript
        visibility: formData.visibility, // 🆕 Usa la visibilità selezionata dall'utente!
        userEmail: currentUserEmail, // Email utente autenticato (validato sopra)
      });
      
      
      // 💾 Salva TUTTI gli attributi della categoria (inclusi agentOnly con valore null)
      if (allCategoryAttributesForSaving && allCategoryAttributesForSaving.length > 0) {
        for (const attr of allCategoryAttributesForSaving) {
          // Prendi il valore dall'utente, oppure null se non compilato
          const value = attributeValues[attr.slug] !== undefined ? attributeValues[attr.slug] : null;
          
          await createTicketAttribute({
            ticketId: result.ticketId as any,
            attributeId: attr._id,
            value: value
          });
        }
      }
      
      // Mostra messaggio di successo con numero ticket
      alert(`Ticket #${result.ticketNumber} creato con successo!`);
      
      // Reindirizza alla pagina dei miei ticket
      router.push('/tickets/my');
      
    } catch (error) {
      console.error('❌ Errore creazione ticket:', error);
      alert('Errore durante la creazione del ticket: ' + (error instanceof Error ? error.message : 'Errore sconosciuto'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Torna alla Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nuovo Ticket</h1>
            <p className="text-gray-600">Crea una nuova richiesta di supporto</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Dettagli del Ticket</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Titolo *"
                    placeholder="Descrivi brevemente il problema..."
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                  
                  <Textarea
                    label="Descrizione *"
                    placeholder="Fornisci una descrizione dettagliata del problema, inclusi i passaggi per riprodurlo..."
                    rows={6}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    required
                  />
                  
                  {/* 🤖 Agent AI Suggestion */}
                  {isAnalyzing && (
                    <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" />
                      <span className="text-sm text-blue-700">L'Agent AI sta analizzando la tua richiesta...</span>
                    </div>
                  )}
                  
                  {showSuggestion && agentSuggestion?.recommendedCategory && (
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Sparkles className="h-5 w-5 text-purple-600" />
                          <h4 className="font-semibold text-purple-900">Suggerimento Agent AI</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowSuggestion(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <p className="text-sm text-purple-700 mb-3">
                        Ho analizzato la tua richiesta e suggerisco questa categoria:
                      </p>
                      
                      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-purple-200">
                        <div>
                          <p className="font-medium text-gray-900">{agentSuggestion.recommendedCategory.name}</p>
                          {agentSuggestion.recommendedCategory.description && (
                            <p className="text-sm text-gray-600">{agentSuggestion.recommendedCategory.description}</p>
                          )}
                          <div className="flex items-center space-x-2 mt-2">
                            <span className="text-xs text-gray-500">Confidenza:</span>
                            <div className="flex-1 h-2 bg-gray-200 rounded-full max-w-[100px]">
                              <div 
                                className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full"
                                style={{ width: `${agentSuggestion.confidence || 85}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700">{agentSuggestion.confidence || 85}%</span>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            type="button"
                            onClick={handleRejectSuggestion}
                            variant="outline"
                            size="sm"
                            className="flex items-center space-x-1"
                          >
                            <X className="h-4 w-4" />
                            <span>Rifiuta</span>
                          </Button>
                          <Button
                            type="button"
                            onClick={handleApplySuggestion}
                            variant="primary"
                            size="sm"
                            className="flex items-center space-x-1"
                          >
                            <Check className="h-4 w-4" />
                            <span>Applica</span>
                          </Button>
                        </div>
                      </div>
                      
                      {agentSuggestion.reasoning && (
                        <p className="text-xs text-purple-600 mt-2 italic">
                          💡 {agentSuggestion.reasoning}
                        </p>
                      )}
                    </div>
                  )}

                  <Select
                    label="Categoria *"
                    options={[
                      { 
                        value: '', 
                        label: isLoadingCategories ? 'Caricamento categorie...' : 'Seleziona categoria...' 
                      }, 
                      ...categories
                    ]}
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    required
                    disabled={isLoadingCategories}
                  />
                  
                  {/* 💡 Messaggio quando suggerimento è rifiutato */}
                  {agentSuggestion === null && formData.description.length > 10 && !formData.category && (
                    <p className="text-sm text-gray-600 italic mt-2">
                      💡 Seleziona manualmente la categoria più appropriata per la tua richiesta
                    </p>
                  )}
                  
                  {/* 📝 Dynamic Required Attributes */}
                  {requiredAttributes.length > 0 && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-4">
                      <div className="flex items-center space-x-2">
                        <Tag className="h-5 w-5 text-yellow-600" />
                        <h4 className="font-semibold text-yellow-900">Informazioni Aggiuntive Richieste</h4>
                      </div>
                      <p className="text-sm text-yellow-700">
                        Per questa categoria sono richieste le seguenti informazioni:
                      </p>
                      
                      <div className="space-y-3">
                        {requiredAttributes.map((attr) => (
                          <div key={attr._id}>
                            {attr.type === 'text' && (
                              <Input
                                label={`${attr.name} *`}
                                placeholder={attr.config?.placeholder || `Inserisci ${attr.name.toLowerCase()}...`}
                                value={attributeValues[attr.slug] || ''}
                                onChange={(e) => setAttributeValues({
                                  ...attributeValues,
                                  [attr.slug]: e.target.value
                                })}
                                required
                              />
                            )}
                            
                            {attr.type === 'number' && (
                              <Input
                                type="number"
                                label={`${attr.name} *`}
                                placeholder={attr.config?.placeholder || `Inserisci ${attr.name.toLowerCase()}...`}
                                value={attributeValues[attr.slug] || ''}
                                onChange={(e) => setAttributeValues({
                                  ...attributeValues,
                                  [attr.slug]: Number(e.target.value)
                                })}
                                min={attr.config?.min}
                                max={attr.config?.max}
                                required
                              />
                            )}
                            
                            {attr.type === 'select' && attr.config?.options && (
                              <Select
                                label={`${attr.name} *`}
                                options={[
                                  { value: '', label: 'Seleziona...' },
                                  ...attr.config.options.map((opt: string) => ({
                                    value: opt,
                                    label: opt
                                  }))
                                ]}
                                value={attributeValues[attr.slug] || ''}
                                onChange={(e) => setAttributeValues({
                                  ...attributeValues,
                                  [attr.slug]: e.target.value
                                })}
                                required
                              />
                            )}
                            
                            {attr.type === 'boolean' && (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={attr.slug}
                                  checked={attributeValues[attr.slug] || false}
                                  onChange={(e) => setAttributeValues({
                                    ...attributeValues,
                                    [attr.slug]: e.target.checked
                                  })}
                                  className="h-4 w-4 text-blue-600 rounded"
                                />
                                <label htmlFor={attr.slug} className="text-sm font-medium text-gray-700">
                                  {attr.name} *
                                </label>
                              </div>
                            )}
                            
                            {attr.type === 'date' && (
                              <Input
                                type="date"
                                label={`${attr.name} *`}
                                value={attributeValues[attr.slug] || ''}
                                onChange={(e) => setAttributeValues({
                                  ...attributeValues,
                                  [attr.slug]: e.target.value
                                })}
                                required
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Input
                    label="Tag"
                    placeholder="Aggiungi tag separati da virgola (es: urgente, server, database)"
                    value={formData.tags}
                    onChange={(e) => setFormData({...formData, tags: e.target.value})}
                    helperText="I tag aiutano a categorizzare e trovare i ticket più facilmente"
                  />
                </CardContent>
              </Card>

              {/* Allegati */}
              <Card>
                <CardHeader>
                  <CardTitle>Allegati</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Trascina i file qui o <span className="text-blue-600 font-medium">clicca per selezionare</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Supportati: PDF, DOC, DOCX, JPG, PNG (max 10MB)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Informazioni */}
              <Card>
                <CardHeader>
                  <CardTitle>Informazioni</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium">{user?.name || 'Caricamento...'}</p>
                      <p className="text-xs text-gray-500">{user?.clinic?.name || 'Caricamento...'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Visibilità</label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="visibility"
                          value="public"
                          checked={formData.visibility === 'public'}
                          onChange={(e) => {
                            setFormData({...formData, visibility: e.target.value});
                            setVisibilitySetByUser(true); // 🆕 Marca che l'utente ha fatto una scelta manuale
                          }}
                          className="text-blue-600"
                        />
                        <span className="text-sm">Pubblico - Visibile a tutta la clinica</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="visibility"
                          value="private"
                          checked={formData.visibility === 'private'}
                          onChange={(e) => {
                            setFormData({...formData, visibility: e.target.value});
                            setVisibilitySetByUser(true); // 🆕 Marca che l'utente ha fatto una scelta manuale
                          }}
                          className="text-blue-600"
                        />
                        <span className="text-sm">Privato - Solo per me</span>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* KB Widget - Articoli Correlati */}
              <KBWidget
                category={formData.category ? categoriesData?.find(c => c._id === formData.category)?.slug : undefined}
                searchTerm={formData.title + ' ' + formData.description}
                clinicId={clinicId}
              />

              {/* Preview */}
              {formData.visibility && (
                <Card>
                  <CardHeader>
                    <CardTitle>Anteprima</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={formData.visibility === 'public' ? 'success' : 'default'}>
                          {formData.visibility === 'public' ? 'Pubblico' : 'Privato'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={!formData.title || !formData.description || !formData.category || isSubmitting}
                >
                  {isSubmitting ? 'Creazione in corso...' : 'Crea Ticket'}
                </Button>
                <Link href="/dashboard" className="block">
                  <Button variant="outline" className="w-full">
                    Annulla
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}