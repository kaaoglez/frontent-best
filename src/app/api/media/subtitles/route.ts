import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SUBTITLE_EXTENSIONS = new Set(['.srt', '.vtt']);

/**
 * Extended language code mapping (3-letter ISO 639-2/B to 2-letter).
 */
const EXTENDED_LANG_MAP: Record<string, string> = {
  eng: 'en',
  spa: 'es',
  fre: 'fr',
  fra: 'fr',
  por: 'pt',
  ger: 'de',
  deu: 'de',
  ita: 'it',
  jpn: 'ja',
  kor: 'ko',
  chi: 'zh',
  zho: 'zh',
  rus: 'ru',
  ara: 'ar',
};

/**
 * Language code to display label mapping.
 */
const LANGUAGE_MAP: Record<string, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  pt: 'Português',
  de: 'Deutsch',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  ru: 'Русский',
  ar: 'العربية',
};

function resolveLanguage(code: string): { language: string; label: string } {
  const twoLetter = EXTENDED_LANG_MAP[code.toLowerCase()] || code.toLowerCase();
  return {
    language: twoLetter,
    label: LANGUAGE_MAP[twoLetter] || LANGUAGE_MAP[code.toLowerCase()] || code,
  };
}

/**
 * Extract language info from a subtitle filename relative to the video base name.
 *
 * Patterns:
 *   VideoName.srt          → und (no language)
 *   VideoName.en.srt       → en, "English"
 *   VideoName.eng.srt      → en, "English"
 *   VideoName.es.srt       → es, "Español"
 *   VideoName.spa.srt      → es, "Español"
 *   VideoName.en.cc.srt    → en, "English"  (multiple suffixes)
 */
function extractLanguageInfo(videoBaseName: string, subtitleFileName: string): {
  language: string;
  label: string;
  exactMatch: boolean;
} | null {
  const subName = subtitleFileName;
  const subExt = path.extname(subName).toLowerCase();
  const subWithoutExt = subName.slice(0, -subExt.length); // e.g., "MyMovie.en" or "MyMovie"

  if (!SUBTITLE_EXTENSIONS.has(subExt)) return null;

  // Exact match: VideoName.srt (subtitle filename without ext === video base name)
  if (subWithoutExt === videoBaseName) {
    return { language: 'und', label: 'Sin idioma', exactMatch: true };
  }

  // Check if it starts with the video base name followed by a dot
  if (!subWithoutExt.startsWith(videoBaseName + '.')) return null;

  // Extract the suffix part between videoBaseName and the extension
  const suffix = subWithoutExt.slice(videoBaseName.length + 1); // e.g., "en" or "eng" or "en.cc"

  // The first part of the suffix is the language code
  const langPart = suffix.split('.')[0].toLowerCase();
  if (!langPart) return null;

  const { language, label } = resolveLanguage(langPart);
  return { language, label, exactMatch: true };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoPath = searchParams.get('path');

  if (!videoPath) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  try {
    const normalized = path.normalize(videoPath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: 'Video file not found' }, { status: 404 });
    }

    const videoDir = path.dirname(normalized);
    const videoBaseName = path.basename(normalized, path.extname(normalized));

    // Read all files in the video directory
    let entries: string[];
    try {
      entries = fs.readdirSync(videoDir);
    } catch {
      return NextResponse.json({ subtitles: [] });
    }

    const subtitles: Array<{
      name: string;
      path: string;
      language: string;
      label: string;
    }> = [];

    const exactMatches: typeof subtitles = [];
    const otherMatches: typeof subtitles = [];

    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase();
      if (!SUBTITLE_EXTENSIONS.has(ext)) continue;

      const info = extractLanguageInfo(videoBaseName, entry);
      if (!info) continue;

      const subtitle = {
        name: entry,
        path: path.join(videoDir, entry),
        language: info.language,
        label: info.label,
      };

      if (info.exactMatch) {
        exactMatches.push(subtitle);
      } else {
        otherMatches.push(subtitle);
      }
    }

    // Sort: exact matches first, then others
    const allSubtitles = [...exactMatches, ...otherMatches];

    return NextResponse.json({ subtitles: allSubtitles });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to find subtitles', details: String(error) },
      { status: 500 }
    );
  }
}
