'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
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
import { ArrowLeft, Upload, User, Tag } from 'lucide-react';
import Link from 'next/link';


export default function NewTicketPage() {
  const { user } = useRole();
  const { user: authUser } = useAuth();
  const router = useRouter();
  
  // Mutation per creare il ticket con autenticazione
  const createTicket = useMutation(api.tickets.createWithAuth);
  
  // Ottieni l'email dell'utente corrente (necessario per le mutation)
  const currentUserEmail = authUser?.email || user?.email;
  
  // Estrai clinicId in modo sicuro (potrebbe essere authUser.clinicId o authUser.clinic._id)
  const clinicId = (authUser as any)?.clinicId || (authUser as any)?.clinic?._id
  
  // Query per ottenere le categorie pubbliche da Convex
  const categoriesData = useQuery(
    api.categories.getPublicCategories,
    clinicId ? { clinicId } : "skip"
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
      
      console.log('🎫 Creando ticket con dati:', {
        title: formData.title,
        description: formData.description,
        categoryId: formData.category,
      });
      
      // Crea il ticket su Convex con autenticazione
      const result = await createTicket({
        title: formData.title.trim(),
        description: formData.description.trim(),
        categoryId: formData.category as any, // Cast necessario per TypeScript
        visibility: 'private', // Default a privato
        userEmail: currentUserEmail, // Email utente autenticato (validato sopra)
      });
      
      console.log('✅ Ticket creato:', result);
      
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
                          onChange={(e) => setFormData({...formData, visibility: e.target.value})}
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
                          onChange={(e) => setFormData({...formData, visibility: e.target.value})}
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