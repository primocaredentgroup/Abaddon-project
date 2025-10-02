'use client';

import React, { useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useRole } from '@/providers/RoleProvider';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MarkdownRenderer } from '@/components/kb/MarkdownEditor';
import { ArticleComments } from '@/components/kb/ArticleComments';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft,
  Eye,
  ThumbsUp,
  Clock,
  User,
  Star,
  Share2
} from 'lucide-react';

export default function ArticleDetailPage() {
  const { user } = useRole();
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;

  // Query articolo
  const article = useQuery(
    api.kbArticles.getArticleById,
    articleId ? { articleId: articleId as any } : "skip"
  );

  // Mutations
  const incrementViews = useMutation(api.kbArticles.incrementViews);
  const toggleLike = useMutation(api.kbArticles.toggleLike);

  // State per like
  const [isLiked, setIsLiked] = React.useState(false);

  // Incrementa views al caricamento
  useEffect(() => {
    if (articleId) {
      incrementViews({ articleId: articleId as any });
    }
  }, [articleId]);

  const handleLike = async () => {
    if (!articleId) return;
    
    try {
      await toggleLike({
        articleId: articleId as any,
        increment: !isLiked
      });
      setIsLiked(!isLiked);
    } catch (error) {
      console.error('Errore nel like:', error);
    }
  };

  const handleShare = () => {
    if (navigator.share && article) {
      navigator.share({
        title: article.title,
        text: article.excerpt,
        url: window.location.href
      });
    } else {
      // Fallback: copia URL
      navigator.clipboard.writeText(window.location.href);
      alert('Link copiato negli appunti!');
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  if (!article) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Caricamento articolo...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/kb')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna alla Knowledge Base
        </Button>

        {/* Article Header */}
        <Card>
          <CardContent className="p-8">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge variant="default">{article.category}</Badge>
              <Badge 
                variant={
                  article.difficulty === 'Facile' ? 'success' : 
                  article.difficulty === 'Medio' ? 'warning' : 'danger'
                }
              >
                {article.difficulty}
              </Badge>
              {article.featured && (
                <Badge variant="warning">
                  <Star className="h-3 w-3 mr-1" />
                  In Evidenza
                </Badge>
              )}
              {article.tags && article.tags.map((tag: string) => (
                <Badge key={tag} variant="outline" size="sm">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {article.title}
            </h1>

            {/* Meta Info */}
            <div className="flex items-center gap-6 text-sm text-gray-600 mb-6 pb-6 border-b">
              <span className="flex items-center">
                <User className="h-4 w-4 mr-1" />
                {article.author?.name || 'Autore'}
              </span>
              <span className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {formatDate(article.lastUpdatedAt)}
              </span>
              <span className="flex items-center">
                <Eye className="h-4 w-4 mr-1" />
                {article.views} visualizzazioni
              </span>
              <span className="flex items-center">
                <ThumbsUp className="h-4 w-4 mr-1" />
                {article.likes} mi piace
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-8">
              <Button
                variant={isLiked ? 'default' : 'outline'}
                size="sm"
                onClick={handleLike}
              >
                <ThumbsUp className={`h-4 w-4 mr-2 ${isLiked ? 'fill-current' : ''}`} />
                {isLiked ? 'Ti piace' : 'Mi piace'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Condividi
              </Button>
            </div>

            {/* Excerpt */}
            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg mb-8">
              <p className="text-blue-900 font-medium">{article.excerpt}</p>
            </div>

            {/* Content */}
            <div className="prose prose-lg max-w-none">
              <MarkdownRenderer content={article.content} />
            </div>

            {/* Attachments (immagini) */}
            {article.attachments && article.attachments.length > 0 && (
              <div className="mt-8">
                <h3 className="font-semibold text-gray-900 mb-3">Allegati</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {article.attachments.map((attachment: any, index: number) => (
                    <a
                      key={index}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group"
                    >
                      <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="w-full h-48 object-cover rounded-lg border group-hover:shadow-lg transition-shadow"
                      />
                      <p className="text-xs text-gray-600 mt-1 truncate">{attachment.name}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Info */}
            <div className="mt-12 pt-6 border-t">
              <p className="text-sm text-gray-600">
                Ultimo aggiornamento: {formatDate(article.lastUpdatedAt)}
              </p>
              {article.author && (
                <p className="text-sm text-gray-600 mt-1">
                  Autore: {article.author.name} ({article.author.email})
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Commenti */}
        <Card>
          <CardContent className="p-8">
            <ArticleComments articleId={articleId} />
          </CardContent>
        </Card>

        {/* Helpful? */}
        <Card className="bg-gray-50">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Questo articolo ti è stato utile?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Aiutaci a migliorare la Knowledge Base
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleLike}>
                👍 Sì, utile
              </Button>
              <Button variant="outline">
                👎 No, poco chiaro
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

