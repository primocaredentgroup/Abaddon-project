'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useRole } from '@/providers/RoleProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/use-toast';
import { 
  Search, 
  BookOpen, 
  Star, 
  Clock, 
  Eye, 
  ThumbsUp,
  Filter,
  Plus,
  ArrowRight
} from 'lucide-react';

const categories = ['Tutti', 'Account', 'Hardware', 'Software', 'Rete', 'Sicurezza', 'Altro'];

export default function KnowledgeBasePage() {
  const { user } = useRole();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tutti');
  const [sortBy, setSortBy] = useState('popular');
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestion, setSuggestion] = useState({
    title: '',
    description: '',
    category: 'Account',
    priority: 'Bassa' as 'Bassa' | 'Media' | 'Alta'
  });

  // Query articoli da Convex
  const clinicId = user?.clinicId;
  
  // Usa ricerca avanzata se c'è un termine di ricerca, altrimenti query normale
  const kbArticlesFromDB = useQuery(
    searchTerm.length > 2 ? api.kbArticles.searchArticles : api.kbArticles.getPublishedArticles,
    clinicId ? (searchTerm.length > 2 ? {
      clinicId,
      searchTerm,
      category: selectedCategory !== 'Tutti' ? selectedCategory : undefined
    } : { 
      clinicId,
      category: selectedCategory !== 'Tutti' ? selectedCategory : undefined 
    }) : "skip"
  );

  // Mutation per suggerimenti
  const createSuggestionMutation = useMutation(api.kbArticles.createSuggestion);

  // Usa articoli da Convex o array vuoto
  const kbArticles = kbArticlesFromDB || [];

  // Se stiamo usando la ricerca, gli articoli sono già ordinati per rilevanza
  const filteredArticles = searchTerm.length > 2 
    ? kbArticles 
    : kbArticles.sort((a, b) => {
        if (sortBy === 'popular') return b.views - a.views;
        if (sortBy === 'recent') return b.lastUpdatedAt - a.lastUpdatedAt;
        if (sortBy === 'liked') return b.likes - a.likes;
        return 0;
      });

  const featuredArticles = kbArticles.filter(article => article.featured);

  const handleSuggestArticle = async () => {
    if (!user?.email) {
      toast({ 
        title: 'Errore', 
        description: 'Devi essere autenticato per suggerire un articolo', 
        variant: 'destructive' 
      });
      return;
    }

    if (!suggestion.title || !suggestion.description) {
      toast({ 
        title: 'Errore', 
        description: 'Compila tutti i campi obbligatori', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      await createSuggestionMutation({
        title: suggestion.title,
        description: suggestion.description,
        category: suggestion.category,
        priority: suggestion.priority,
        userEmail: user.email
      });

      toast({
        title: '✅ Suggerimento inviato!',
        description: 'Il tuo suggerimento è stato inviato al team. Grazie!',
        variant: 'default'
      });

      // Reset form e chiudi modal
      setSuggestion({ title: '', description: '', category: 'Account', priority: 'Bassa' });
      setShowSuggestModal(false);
    } catch (error: any) {
      toast({ 
        title: 'Errore', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  // Helper per formattare la data
  const formatDate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Oggi';
    if (days === 1) return 'Ieri';
    if (days < 7) return `${days} giorni fa`;
    if (days < 30) return `${Math.floor(days / 7)} settimane fa`;
    if (days < 365) return `${Math.floor(days / 30)} mesi fa`;
    return `${Math.floor(days / 365)} anni fa`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <BookOpen className="h-6 w-6 mr-2 text-blue-600" />
              Knowledge Base
            </h1>
            <p className="text-gray-600">Trova risposte rapide ai problemi più comuni</p>
          </div>
          <div className="flex gap-2">
            {(user?.roleName === 'Agente' || user?.roleName === 'Amministratore') && (
              <>
                <Button variant="outline" onClick={() => window.location.href = '/kb/manage'}>
                  Gestisci Articoli
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/kb/suggestions'}>
                  Suggerimenti
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/kb/analytics'}>
                  Analytics
                </Button>
              </>
            )}
            <Button onClick={() => setShowSuggestModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Suggerisci Articolo
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Cerca articoli, guide, soluzioni... (min. 3 caratteri)"
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm.length > 2 && (
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-blue-600 font-medium">
                      🔍 Ricerca attiva
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <select 
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="popular">Più Popolari</option>
                  <option value="recent">Più Recenti</option>
                  <option value="liked">Più Apprezzati</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Featured Articles */}
        {searchTerm === '' && selectedCategory === 'Tutti' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Star className="h-5 w-5 mr-2 text-yellow-500" />
              Articoli in Evidenza
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredArticles.map((article) => (
                <Card 
                  key={article._id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => window.location.href = `/kb/article/${article._id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="warning" size="sm">In Evidenza</Badge>
                      <Badge 
                        variant={
                          article.difficulty === 'Facile' ? 'success' : 
                          article.difficulty === 'Medio' ? 'warning' : 'danger'
                        }
                        size="sm"
                      >
                        {article.difficulty}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{article.title}</h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{article.excerpt}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-3">
                        <span className="flex items-center">
                          <Eye className="h-3 w-3 mr-1" />
                          {article.views}
                        </span>
                        <span className="flex items-center">
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          {article.likes}
                        </span>
                      </div>
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(article.lastUpdatedAt)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All Articles */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {searchTerm || selectedCategory !== 'Tutti' ? 'Risultati' : 'Tutti gli Articoli'} 
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({filteredArticles.length} articoli)
              </span>
            </h2>
          </div>

          <div className="space-y-4">
            {filteredArticles.map((article) => (
              <Card 
                key={article._id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => window.location.href = `/kb/article/${article._id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="default" size="sm">{article.category}</Badge>
                        <Badge 
                          variant={
                            article.difficulty === 'Facile' ? 'success' : 
                            article.difficulty === 'Medio' ? 'warning' : 'danger'
                          }
                          size="sm"
                        >
                          {article.difficulty}
                        </Badge>
                        {article.featured && (
                          <Badge variant="warning" size="sm">
                            <Star className="h-3 w-3 mr-1" />
                            In Evidenza
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{article.title}</h3>
                      <p className="text-gray-600 mb-3">{article.excerpt}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Eye className="h-4 w-4 mr-1" />
                          {article.views} visualizzazioni
                        </span>
                        <span className="flex items-center">
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          {article.likes} mi piace
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          Aggiornato {formatDate(article.lastUpdatedAt)}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredArticles.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun articolo trovato</h3>
                <p className="text-gray-600 mb-4">
                  Non abbiamo trovato articoli che corrispondono ai tuoi criteri di ricerca.
                </p>
                <Button variant="outline" onClick={() => setShowSuggestModal(true)}>
                  Suggerisci un nuovo articolo
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Modal Suggerisci Articolo */}
        {showSuggestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Plus className="h-5 w-5 mr-2 text-blue-600" />
                    Suggerisci un Articolo
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowSuggestModal(false)}
                  >
                    ✕
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Hai un'idea per un nuovo articolo della Knowledge Base? Condividila con noi!
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titolo dell'articolo *
                  </label>
                  <Input
                    placeholder="Es: Come configurare la stampante WiFi"
                    value={suggestion.title}
                    onChange={(e) => setSuggestion({ ...suggestion, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrizione / Problema da risolvere *
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="Descrivi in dettaglio l'argomento che vorresti vedere trattato nella Knowledge Base..."
                    value={suggestion.description}
                    onChange={(e) => setSuggestion({ ...suggestion, description: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoria
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={suggestion.category}
                      onChange={(e) => setSuggestion({ ...suggestion, category: e.target.value })}
                    >
                      <option value="Account">Account</option>
                      <option value="Hardware">Hardware</option>
                      <option value="Software">Software</option>
                      <option value="Rete">Rete</option>
                      <option value="Sicurezza">Sicurezza</option>
                      <option value="Altro">Altro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priorità
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={suggestion.priority}
                      onChange={(e) => setSuggestion({ ...suggestion, priority: e.target.value })}
                    >
                      <option value="Bassa">Bassa</option>
                      <option value="Media">Media</option>
                      <option value="Alta">Alta</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowSuggestModal(false)}
                  >
                    Annulla
                  </Button>
                  <Button 
                    onClick={handleSuggestArticle}
                    disabled={!suggestion.title || !suggestion.description}
                  >
                    Invia Suggerimento
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}