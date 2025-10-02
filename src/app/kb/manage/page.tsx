'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useRole } from '@/providers/RoleProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { MarkdownEditor } from '@/components/kb/MarkdownEditor';
import { ImageUploader } from '@/components/kb/ImageUploader';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Star,
  FileText,
  Save,
  X
} from 'lucide-react';

type Article = {
  _id: string;
  title: string;
  content: string;
  excerpt: string;
  category: string;
  difficulty: 'Facile' | 'Medio' | 'Avanzato';
  featured: boolean;
  isActive: boolean;
  views: number;
  likes: number;
  tags?: string[];
  attachments?: { name: string; url: string; type: string; size: number }[];
};

const categories = ['Account', 'Hardware', 'Software', 'Rete', 'Sicurezza', 'Altro'];
const difficulties = ['Facile', 'Medio', 'Avanzato'];

export default function ManageKBPage() {
  const { user } = useRole();
  const { toast } = useToast();
  const router = useRouter();
  
  const [showEditor, setShowEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    excerpt: '',
    category: 'Account',
    difficulty: 'Facile' as 'Facile' | 'Medio' | 'Avanzato',
    featured: false,
    tags: [] as string[],
    attachments: [] as { name: string; url: string; type: string; size: number }[]
  });
  const [tagInput, setTagInput] = useState('');

  // Verifica permessi
  const canManage = user?.roleName === 'Agente' || user?.roleName === 'Amministratore';

  // Query articoli
  const clinicId = user?.clinicId;
  const articles = useQuery(
    api.kbArticles.getPublishedArticles,
    clinicId ? { clinicId } : "skip"
  );

  // Mutations
  const createArticle = useMutation(api.kbArticles.createArticle);
  const updateArticle = useMutation(api.kbArticles.updateArticle);
  const deleteArticle = useMutation(api.kbArticles.deleteArticle);

  // Redirect se non autorizzato
  if (!canManage) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-red-600 font-medium">
              ⛔ Accesso negato. Solo agenti e amministratori possono gestire la Knowledge Base.
            </p>
            <Button className="mt-4" onClick={() => router.push('/kb')}>
              Torna alla Knowledge Base
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const handleEdit = (article: any) => {
    setEditingArticle(article);
    setFormData({
      title: article.title,
      content: article.content,
      excerpt: article.excerpt,
      category: article.category,
      difficulty: article.difficulty,
      featured: article.featured,
      tags: article.tags || [],
      attachments: article.attachments || []
    });
    setShowEditor(true);
  };

  const handleNewArticle = () => {
    setEditingArticle(null);
    setFormData({
      title: '',
      content: '',
      excerpt: '',
      category: 'Account',
      difficulty: 'Facile',
      featured: false,
      tags: [],
      attachments: []
    });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!user?.email) return;

    if (!formData.title || !formData.content || !formData.excerpt) {
      toast({
        title: 'Errore',
        description: 'Compila tutti i campi obbligatori',
        variant: 'destructive'
      });
      return;
    }

    try {
      if (editingArticle) {
        await updateArticle({
          articleId: editingArticle._id as any,
          title: formData.title,
          content: formData.content,
          excerpt: formData.excerpt,
          category: formData.category,
          difficulty: formData.difficulty,
          featured: formData.featured,
          tags: formData.tags,
          attachments: formData.attachments,
          userEmail: user.email
        });
        toast({
          title: '✅ Articolo aggiornato!',
          description: 'Le modifiche sono state salvate con successo',
        });
      } else {
        await createArticle({
          title: formData.title,
          content: formData.content,
          excerpt: formData.excerpt,
          category: formData.category,
          difficulty: formData.difficulty,
          featured: formData.featured,
          tags: formData.tags,
          attachments: formData.attachments,
          userEmail: user.email
        });
        toast({
          title: '✅ Articolo creato!',
          description: 'Il nuovo articolo è stato pubblicato',
        });
      }
      setShowEditor(false);
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (articleId: string, title: string) => {
    if (!user?.email) return;
    
    if (!confirm(`Vuoi eliminare "${title}"?`)) return;

    try {
      await deleteArticle({
        articleId: articleId as any,
        userEmail: user.email
      });
      toast({
        title: '🗑️ Articolo eliminato',
        description: `"${title}" è stato rimosso dalla Knowledge Base`,
      });
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tag)
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <FileText className="h-6 w-6 mr-2 text-blue-600" />
              Gestione Knowledge Base
            </h1>
            <p className="text-gray-600">Crea, modifica ed elimina articoli</p>
          </div>
          <Button onClick={handleNewArticle}>
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Articolo
          </Button>
        </div>

        {/* Editor/Form */}
        {showEditor && (
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{editingArticle ? 'Modifica Articolo' : 'Nuovo Articolo'}</span>
                <Button variant="ghost" size="sm" onClick={() => setShowEditor(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titolo *
                </label>
                <Input
                  placeholder="Es: Come resettare la password"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estratto (breve descrizione) *
                </label>
                <Textarea
                  placeholder="Breve descrizione dell'articolo (max 2-3 righe)"
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contenuto completo *
                </label>
                <MarkdownEditor
                  value={formData.content}
                  onChange={(content) => setFormData({ ...formData, content })}
                  placeholder="Scrivi qui il contenuto completo dell'articolo usando Markdown..."
                  rows={12}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficoltà
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
                  >
                    {difficulties.map(diff => (
                      <option key={diff} value={diff}>{diff}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (opzionali)
                </label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Aggiungi tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" onClick={addTag}>Aggiungi</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map(tag => (
                    <Badge key={tag} variant="default">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 text-xs hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Immagini / Allegati
                </label>
                <ImageUploader
                  onImagesChange={(images) => setFormData({ ...formData, attachments: images })}
                  existingImages={formData.attachments}
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="featured"
                  checked={formData.featured}
                  onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor="featured" className="ml-2 text-sm text-gray-700">
                  Articolo in evidenza
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowEditor(false)}>
                  Annulla
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Salva Articolo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista Articoli */}
        <Card>
          <CardHeader>
            <CardTitle>Articoli Pubblicati ({articles?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {articles?.map((article: any) => (
                <div
                  key={article._id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{article.title}</h3>
                      {article.featured && (
                        <Badge variant="warning" size="sm">
                          <Star className="h-3 w-3 mr-1" />
                          In Evidenza
                        </Badge>
                      )}
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
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{article.excerpt}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Eye className="h-3 w-3 mr-1" />
                        {article.views} views
                      </span>
                      <span>👍 {article.likes} likes</span>
                      {article.tags && article.tags.length > 0 && (
                        <span className="flex gap-1">
                          {article.tags.map((tag: string) => (
                            <Badge key={tag} variant="outline" size="sm">{tag}</Badge>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(article)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(article._id, article.title)}
                    >
                      <Trash2 className="h-3 w-3 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}

              {(!articles || articles.length === 0) && (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>Nessun articolo pubblicato ancora.</p>
                  <p className="text-sm">Clicca su "Nuovo Articolo" per iniziare!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

