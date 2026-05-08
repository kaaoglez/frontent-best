'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, TrendingUp, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function NewsWidget() {
  const [news, setNews] = useState<Array<{ title: string; source: string; url: string; snippet: string; time: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [countryLabel, setCountryLabel] = useState('');

  const loadNews = useCallback(async (cc: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/news?cc=${cc}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.news) setNews(data.news);
        if (data?.countryLabel) setCountryLabel(data.countryLabel);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    const cc = localStorage.getItem('weather_country_code') || '';
    loadNews(cc);
  }, [loadNews]);

  // Listen for country code changes (weather widget saves it)
  useEffect(() => {
    let lastCC = localStorage.getItem('weather_country_code') || '';
    const interval = setInterval(() => {
      const cc = localStorage.getItem('weather_country_code') || '';
      if (cc !== lastCC) {
        lastCC = cc;
        loadNews(cc);
      }
    }, 2000); // Check every 2 seconds
    return () => clearInterval(interval);
  }, [loadNews]);

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
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-xs font-medium text-muted-foreground">{countryLabel}</span>
        </div>
        <button
          onClick={() => loadNews(localStorage.getItem('weather_country_code') || '')}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        {news.map((item, i) => (
          <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
            <div className="flex gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <span className="text-xs font-bold text-muted-foreground/30 flex-shrink-0 w-4 text-right">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{item.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.source}</Badge>
                  {item.time && <span className="text-[10px] text-muted-foreground">{item.time}</span>}
                </div>
              </div>
              <ExternalLink className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
