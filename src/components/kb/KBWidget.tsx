'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { 
  Lightbulb, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BookOpen
} from 'lucide-react';

interface KBWidgetProps {
  category?: string;
  searchTerm?: string;
  clinicId?: string;
}

export function KBWidget({ category, searchTerm, clinicId }: KBWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [relevantArticles, setRelevantArticles] = useState<any[]>([]);

  // Query articoli
  const articles = useQuery(
    api.kbArticles.getPublishedArticles,
    clinicId ? { 
      clinicId,
      category: category || undefined
    } : "skip"
  );

  // Filtra articoli rilevanti in base al termine di ricerca
  useEffect(() => {
    if (!articles) return;

    if (searchTerm && searchTerm.length > 3) {
      const filtered = articles.filter(article =>
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setRelevantArticles(filtered.slice(0, 3));
    } else if (category) {
      // Mostra articoli della categoria
      setRelevantArticles(articles.slice(0, 3));
    } else {
      setRelevantArticles([]);
    }
  }, [articles, searchTerm, category]);

  if (relevantArticles.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <CardTitle className="flex items-center justify-between text-blue-900">
          <span className="flex items-center text-base">
            <Lightbulb className="h-5 w-5 mr-2 text-blue-600" />
            Articoli Correlati ({relevantArticles.length})
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </CardTitle>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <p className="text-sm text-blue-700 mb-3">
            Forse questi articoli possono aiutarti a risolvere il problema:
          </p>
          
          <div className="space-y-2">
            {relevantArticles.map((article) => (
              <div
                key={article._id}
                className="p-3 bg-white border border-blue-200 rounded-lg hover:shadow-md transition-all cursor-pointer"
                onClick={() => window.open(`/kb/article/${article._id}`, '_blank')}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">
                        {article.title}
                      </h4>
                      <Badge variant="default" size="sm">{article.category}</Badge>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                      {article.excerpt}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>👁️ {article.views} visualizzazioni</span>
                      <span>👍 {article.likes} utili</span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-blue-600 ml-2 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-blue-200">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-blue-700 hover:bg-blue-100"
              onClick={() => window.open('/kb', '_blank')}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Esplora Knowledge Base
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}


