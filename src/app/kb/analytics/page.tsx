'use client';

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useRole } from '@/providers/RoleProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  TrendingUp, 
  Eye, 
  ThumbsUp,
  Star,
  Users,
  FileText
} from 'lucide-react';

export default function KBAnalyticsPage() {
  const { user } = useRole();
  const router = useRouter();

  // Verifica permessi
  const canView = user?.roleName === 'Agente' || user?.roleName === 'Amministratore';

  // Query articoli
  const clinicId = user?.clinicId;
  const articles = useQuery(
    api.kbArticles.getPublishedArticles,
    clinicId ? { clinicId } : "skip"
  );

  if (!canView) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-red-600 font-medium">
              ⛔ Accesso negato. Solo agenti e amministratori possono vedere le analytics.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  // Calcoli statistiche
  const totalArticles = articles?.length || 0;
  const totalViews = articles?.reduce((sum, a) => sum + a.views, 0) || 0;
  const totalLikes = articles?.reduce((sum, a) => sum + a.likes, 0) || 0;
  const featuredCount = articles?.filter(a => a.featured).length || 0;

  // Articoli più visti
  const topViewed = [...(articles || [])].sort((a, b) => b.views - a.views).slice(0, 5);

  // Articoli più apprezzati
  const topLiked = [...(articles || [])].sort((a, b) => b.likes - a.likes).slice(0, 5);

  // Per categoria
  const byCategory: Record<string, { count: number; views: number; likes: number }> = {};
  articles?.forEach(article => {
    if (!byCategory[article.category]) {
      byCategory[article.category] = { count: 0, views: 0, likes: 0 };
    }
    byCategory[article.category].count++;
    byCategory[article.category].views += article.views;
    byCategory[article.category].likes += article.likes;
  });

  const avgEngagement = totalArticles > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="h-6 w-6 mr-2 text-purple-600" />
            Analytics Knowledge Base
          </h1>
          <p className="text-gray-600">Statistiche e performance degli articoli</p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Articoli Totali</p>
                  <p className="text-3xl font-bold text-gray-900">{totalArticles}</p>
                </div>
                <FileText className="h-10 w-10 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Visualizzazioni</p>
                  <p className="text-3xl font-bold text-gray-900">{totalViews}</p>
                </div>
                <Eye className="h-10 w-10 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Mi Piace</p>
                  <p className="text-3xl font-bold text-gray-900">{totalLikes}</p>
                </div>
                <ThumbsUp className="h-10 w-10 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Engagement</p>
                  <p className="text-3xl font-bold text-gray-900">{avgEngagement}%</p>
                </div>
                <TrendingUp className="h-10 w-10 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Articles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Viewed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Eye className="h-5 w-5 mr-2 text-green-600" />
                Articoli Più Visti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topViewed.map((article, index) => (
                  <div
                    key={article._id}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => router.push(`/kb/article/${article._id}`)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                        <span className="text-sm font-medium text-gray-900 line-clamp-1">
                          {article.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" size="sm">{article.category}</Badge>
                        <span className="text-xs text-gray-600 flex items-center">
                          <Eye className="h-3 w-3 mr-1" />
                          {article.views}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {topViewed.length === 0 && (
                  <p className="text-center text-gray-500 py-4">Nessun articolo ancora</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Liked */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ThumbsUp className="h-5 w-5 mr-2 text-purple-600" />
                Articoli Più Apprezzati
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topLiked.map((article, index) => (
                  <div
                    key={article._id}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => router.push(`/kb/article/${article._id}`)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                        <span className="text-sm font-medium text-gray-900 line-clamp-1">
                          {article.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" size="sm">{article.category}</Badge>
                        <span className="text-xs text-gray-600 flex items-center">
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          {article.likes}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {topLiked.length === 0 && (
                  <p className="text-center text-gray-500 py-4">Nessun articolo ancora</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle>Performance per Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(byCategory).map(([category, stats]) => (
                <div key={category} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">{category}</h3>
                    <Badge variant="default">{stats.count} articoli</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Visualizzazioni</p>
                      <p className="text-lg font-bold text-green-600">{stats.views}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Mi Piace</p>
                      <p className="text-lg font-bold text-purple-600">{stats.likes}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Engagement</p>
                      <p className="text-lg font-bold text-orange-600">
                        {stats.views > 0 ? ((stats.likes / stats.views) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {Object.keys(byCategory).length === 0 && (
                <p className="text-center text-gray-500 py-4">Nessuna categoria ancora</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}


