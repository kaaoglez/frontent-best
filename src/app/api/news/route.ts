import { NextRequest, NextResponse } from 'next/server';

// ── Country config: display name + Google News locale ────────────────────────

const COUNTRY_CONFIG: Record<string, { name: string; hl: string; gl: string }> = {
  // Latin America
  CU: { name: 'Cuba', hl: 'es', gl: 'CU' },
  MX: { name: 'México', hl: 'es', gl: 'MX' },
  AR: { name: 'Argentina', hl: 'es', gl: 'AR' },
  CO: { name: 'Colombia', hl: 'es', gl: 'CO' },
  PE: { name: 'Perú', hl: 'es', gl: 'PE' },
  CL: { name: 'Chile', hl: 'es', gl: 'CL' },
  EC: { name: 'Ecuador', hl: 'es', gl: 'EC' },
  VE: { name: 'Venezuela', hl: 'es', gl: 'VE' },
  GT: { name: 'Guatemala', hl: 'es', gl: 'GT' },
  DO: { name: 'Rep. Dominicana', hl: 'es', gl: 'DO' },
  UY: { name: 'Uruguay', hl: 'es', gl: 'UY' },
  PY: { name: 'Paraguay', hl: 'es', gl: 'PY' },
  BO: { name: 'Bolivia', hl: 'es', gl: 'BO' },
  CR: { name: 'Costa Rica', hl: 'es', gl: 'CR' },
  PA: { name: 'Panamá', hl: 'es', gl: 'PA' },
  HN: { name: 'Honduras', hl: 'es', gl: 'HN' },
  SV: { name: 'El Salvador', hl: 'es', gl: 'SV' },
  NI: { name: 'Nicaragua', hl: 'es', gl: 'NI' },
  BR: { name: 'Brasil', hl: 'pt-BR', gl: 'BR' },
  // Caribbean
  PR: { name: 'Puerto Rico', hl: 'es', gl: 'PR' },
  JM: { name: 'Jamaica', hl: 'en', gl: 'JM' },
  HT: { name: 'Haití', hl: 'fr', gl: 'HT' },
  // North America
  US: { name: 'Estados Unidos', hl: 'en', gl: 'US' },
  CA: { name: 'Canadá', hl: 'en', gl: 'CA' },
  // Europe
  ES: { name: 'España', hl: 'es', gl: 'ES' },
  GB: { name: 'Reino Unido', hl: 'en-GB', gl: 'GB' },
  DE: { name: 'Alemania', hl: 'de', gl: 'DE' },
  FR: { name: 'Francia', hl: 'fr', gl: 'FR' },
  IT: { name: 'Italia', hl: 'it', gl: 'IT' },
  PT: { name: 'Portugal', hl: 'pt-PT', gl: 'PT' },
  NL: { name: 'Países Bajos', hl: 'nl', gl: 'NL' },
  BE: { name: 'Bélgica', hl: 'nl', gl: 'BE' },
  CH: { name: 'Suiza', hl: 'de', gl: 'CH' },
  AT: { name: 'Austria', hl: 'de', gl: 'AT' },
  SE: { name: 'Suecia', hl: 'sv', gl: 'SE' },
  NO: { name: 'Noruega', hl: 'no', gl: 'NO' },
  DK: { name: 'Dinamarca', hl: 'da', gl: 'DK' },
  FI: { name: 'Finlandia', hl: 'fi', gl: 'FI' },
  PL: { name: 'Polonia', hl: 'pl', gl: 'PL' },
  CZ: { name: 'Rep. Checa', hl: 'cs', gl: 'CZ' },
  IE: { name: 'Irlanda', hl: 'en-GB', gl: 'IE' },
  GR: { name: 'Grecia', hl: 'el', gl: 'GR' },
  HU: { name: 'Hungría', hl: 'hu', gl: 'HU' },
  RO: { name: 'Rumanía', hl: 'ro', gl: 'RO' },
  BG: { name: 'Bulgaria', hl: 'bg', gl: 'BG' },
  HR: { name: 'Croacia', hl: 'hr', gl: 'HR' },
  SK: { name: 'Eslovaquia', hl: 'sk', gl: 'SK' },
  SI: { name: 'Eslovenia', hl: 'sl', gl: 'SI' },
  LT: { name: 'Lituania', hl: 'lt', gl: 'LT' },
  LV: { name: 'Letonia', hl: 'lv', gl: 'LV' },
  EE: { name: 'Estonia', hl: 'et', gl: 'EE' },
  RS: { name: 'Serbia', hl: 'sr', gl: 'RS' },
  UA: { name: 'Ucrania', hl: 'uk', gl: 'UA' },
  RU: { name: 'Rusia', hl: 'ru', gl: 'RU' },
  LU: { name: 'Luxemburgo', hl: 'de', gl: 'LU' },
  // Asia
  JP: { name: 'Japón', hl: 'ja', gl: 'JP' },
  CN: { name: 'China', hl: 'zh-CN', gl: 'CN' },
  IN: { name: 'India', hl: 'hi', gl: 'IN' },
  KR: { name: 'Corea del Sur', hl: 'ko', gl: 'KR' },
  TH: { name: 'Tailandia', hl: 'th', gl: 'TH' },
  VN: { name: 'Vietnam', hl: 'vi', gl: 'VN' },
  PH: { name: 'Filipinas', hl: 'en', gl: 'PH' },
  ID: { name: 'Indonesia', hl: 'id', gl: 'ID' },
  MY: { name: 'Malasia', hl: 'ms', gl: 'MY' },
  SG: { name: 'Singapur', hl: 'en', gl: 'SG' },
  TW: { name: 'Taiwán', hl: 'zh-TW', gl: 'TW' },
  TR: { name: 'Turquía', hl: 'tr', gl: 'TR' },
  AE: { name: 'Emiratos Árabes', hl: 'ar', gl: 'AE' },
  SA: { name: 'Arabia Saudita', hl: 'ar', gl: 'SA' },
  IL: { name: 'Israel', hl: 'he', gl: 'IL' },
  // Oceania
  AU: { name: 'Australia', hl: 'en-AU', gl: 'AU' },
  NZ: { name: 'Nueva Zelanda', hl: 'en-NZ', gl: 'NZ' },
  // Africa
  ZA: { name: 'Sudáfrica', hl: 'en', gl: 'ZA' },
  NG: { name: 'Nigeria', hl: 'en', gl: 'NG' },
  EG: { name: 'Egipto', hl: 'ar', gl: 'EG' },
  MA: { name: 'Marruecos', hl: 'fr', gl: 'MA' },
  DZ: { name: 'Argelia', hl: 'fr', gl: 'DZ' },
  KE: { name: 'Kenia', hl: 'en', gl: 'KE' },
};

// ── Additional RSS feeds per country (supplementary to Google News) ──────────

const EXTRA_FEEDS: Record<string, string[]> = {
  ES: ['https://feeds.elpais.com/rss/elpais/comunes/', 'https://www.abc.es/rss/feeds/Portada.xml'],
  MX: ['https://www.milenio.com/rss/portada'],
  AR: ['https://www.clarin.com/rss/', 'https://feeds.contenidos.lanacion.com.ar/hd_rss/ultimas-noticias'],
  CO: ['https://www.eltiempo.com/rss/colombia.xml'],
  CL: ['https://feeds.emol.com/emol/todas.xml'],
  VE: ['https://runrun.es/feed/'],
  BR: ['https://feeds.folha.uol.com.br/emcimadahora/rss091.xml'],
  GB: ['https://feeds.bbci.co.uk/news/rss.xml'],
  US: ['https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml'],
  CU: ['https://feeds.bbci.co.uk/mundo/america_latina/rss.xml'],
  DO: ['https://www.listindiario.com/rss/'],
  GT: ['https://www.prensalibre.com/rss/'],
  CR: ['https://www.nacion.com/rss/'],
  CA: ['https://www.cbc.ca/cmlink/rss-topstories'],
};

// ── In-memory cache ────────────────────────────────────────────────────────

const cache = new Map<string, { data: { news: any[]; countryLabel: string }; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ── Source label extraction from URL ────────────────────────────────────────

function sourceLabelFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '').replace('feeds.', '');
    const parts = hostname.split('.');
    const name = parts[0];
    const map: Record<string, string> = {
      'elpais': 'El País', 'abc': 'ABC', 'milenio': 'Milenio',
      'clarin': 'Clarín', 'lanacion': 'La Nación', 'eltiempo': 'El Tiempo',
      'emol': 'Emol', 'peru21': 'Perú21', 'elnacional': 'El Nacional',
      'runrun': 'Runrunes', 'listindiario': 'Listín Diario',
      'prensalibre': 'Prensa Libre', 'nacion': 'La Nación (CR)',
      'folha': 'Folha', 'nytimes': 'NYT', 'bbci': 'BBC',
      'cbc': 'CBC', 'theguardian': 'The Guardian',
      'france24': 'France24', 'paginadoce': 'Página12',
      'bbc': 'BBC', 'eluniversal': 'El Universal',
      'news': 'Google News',
    };
    return map[name] || name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return 'News';
  }
}

// ── RSS Feed parsing ───────────────────────────────────────────────────────

async function fetchRSSFeed(
  feedUrl: string,
  maxItems: number = 8,
  sourceOverride?: string
): Promise<Array<{ title: string; source: string; url: string; snippet: string; time: string }>> {
  try {
    const res = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MiServidor/1.0)',
        'Accept': 'application/rss+xml, text/xml, application/xml, text/html, */*',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const text = await res.text();
    const items: Array<{ title: string; source: string; url: string; snippet: string; time: string }> = [];
    const label = sourceOverride || sourceLabelFromUrl(feedUrl);

    // Parse <entry> (Atom) and <item> (RSS 2.0)
    const allMatches = [
      ...(text.match(/<entry>([\s\S]*?)<\/entry>/gi) || []),
      ...(text.match(/<item>([\s\S]*?)<\/item>/gi) || []),
    ];

    for (let i = 0; i < Math.min(allMatches.length, maxItems); i++) {
      const entry = allMatches[i];

      const titleMatch = entry.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i);
      const linkMatch = entry.match(/<link[^>]*href="([^"]+)"[^>]*\/?>|<link[^>]*>(.*?)<\/link>/i);
      const descMatch = entry.match(/<content[^>]*><!\[CDATA\[(.*?)\]\]><\/content>|<summary[^>]*><!\[CDATA\[(.*?)\]\]><\/summary>|<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>|<media:description><!\[CDATA\[(.*?)\]\]><\/media:description>/i);
      const pubDateMatch = entry.match(/<published>(.*?)<\/published>|<pubDate>(.*?)<\/pubDate>|<updated>(.*?)<\/updated>|<dc:date>(.*?)<\/dc:date>/i);

      if (titleMatch) {
        const title = (titleMatch[1] || titleMatch[2] || '').trim();
        let url = (linkMatch?.[1] || linkMatch?.[2] || '').trim();
        url = url.replace('<![CDATA[', '').replace(']]>', '').trim();
        let snippet = (descMatch?.[1] || descMatch?.[2] || descMatch?.[3] || descMatch?.[4] || descMatch?.[5] || '').trim();
        snippet = snippet.replace(/<[^>]*>/g, '').substring(0, 200);
        const pubDate = pubDateMatch?.[1] || pubDateMatch?.[2] || pubDateMatch?.[3] || pubDateMatch?.[4] || '';

        let time = '';
        if (pubDate) {
          try {
            const d = new Date(pubDate);
            const diffH = Math.floor((Date.now() - d.getTime()) / 3600000);
            if (diffH < 1) time = 'hace ' + Math.max(1, Math.floor((Date.now() - d.getTime()) / 60000)) + 'm';
            else if (diffH < 24) time = `hace ${diffH}h`;
            else if (diffH < 48) time = 'ayer';
            else time = `hace ${Math.floor(diffH / 24)}d`;
          } catch { /* ignore */ }
        }

        if (title && url) {
          items.push({ title, source: label, url, snippet, time });
        }
      }
    }

    return items;
  } catch {
    return [];
  }
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const cc = (request.nextUrl.searchParams.get('cc') || '').toUpperCase();
  const cacheKey = `news_${cc || 'global'}`;

  try {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    let news: Array<{ title: string; source: string; url: string; snippet: string; time: string }> = [];
    let countryLabel = 'Tendencias Globales';
    const feedPromises: Promise<Array<{ title: string; source: string; url: string; snippet: string; time: string }>>[] = [];

    if (cc && cc.length === 2) {
      const config = COUNTRY_CONFIG[cc];
      if (config) {
        countryLabel = `Tendencias · ${config.name}`;

        // 1. Google News RSS as PRIMARY source (most reliable worldwide)
        const gnUrl = `https://news.google.com/rss?hl=${config.hl}&gl=${config.gl}&ceid=${config.gl}:${config.hl}`;
        feedPromises.push(fetchRSSFeed(gnUrl, 12, 'Google News'));

        // 2. Additional country-specific feeds (supplementary)
        const extra = EXTRA_FEEDS[cc];
        if (extra) {
          for (const url of extra) {
            feedPromises.push(fetchRSSFeed(url, 5));
          }
        }
      } else {
        // Unknown country code — use global sources but mention the country
        countryLabel = 'Tendencias Globales';

        // Try Google News with generic Spanish as fallback
        feedPromises.push(
          fetchRSSFeed('https://news.google.com/rss?hl=es-419&gl=US&ceid=US:es-419', 10, 'Google News'),
        );
      }
    }

    // Global fallback
    if (feedPromises.length === 0) {
      countryLabel = 'Tendencias Globales';
      feedPromises.push(
        fetchRSSFeed('https://news.google.com/rss?hl=es-419&gl=US&ceid=US:es-419', 10, 'Google News'),
        fetchRSSFeed('https://feeds.bbci.co.uk/mundo/rss.xml', 5),
      );
    }

    // Fetch all feeds in parallel
    const results = await Promise.allSettled(feedPromises);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        news.push(...result.value);
      }
    }

    // Remove duplicates by title (first 60 chars)
    const seen = new Set<string>();
    news = news.filter(item => {
      const key = item.title.toLowerCase().substring(0, 60).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 15);

    const data = { news, countryLabel };
    cache.set(cacheKey, { data, timestamp: Date.now() });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch news', details: String(error) },
      { status: 500 },
    );
  }
}