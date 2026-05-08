'use client';

import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function NewsWidget() {
  const [news, setNews] = useState<Array<{ title: string; source: string; url: string; snippet: string; time: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.news) setNews(data.news); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
      </div>
    );
  }

  if (news.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No se pudieron cargar las noticias</p>;
  }

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto">
      {news.map((item, i) => (
        <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
          <div className="flex gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <ExternalLink className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{item.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.source}</Badge>
                {item.time && <span className="text-[10px] text-muted-foreground">{item.time}</span>}
              </div>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
