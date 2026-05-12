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
 * Shows ALL .srt/.vtt files in the directory, with smart sorting:
 *   - Exact matches first (VideoName.srt, VideoName.es.srt, etc.)
 *   - Other subtitle files in the same folder second
 *
 * Patterns:
 *   VideoName.srt          → und (no language), exact
 *   VideoName.en.srt       → en, "English", exact
 *   VideoName.eng.srt      → en, "English", exact
 *   OtherFile.es.srt       → es, "Español", not exact
 */
function extractSubtitleInfo(videoBaseName: string, subtitleFileName: string): {
  language: string;
  label: string;
  exactMatch: boolean;
} | null {
  const subExt = path.extname(subtitleFileName).toLowerCase();
  if (!SUBTITLE_EXTENSIONS.has(subExt)) return null;

  const subWithoutExt = subtitleFileName.slice(0, -subExt.length); // e.g., "MyMovie.en" or "MyMovie"

  let isExact = false;
  let language = 'und';
  let label = subtitleFileName; // Default: show filename

  // Exact match: VideoName.srt
  if (subWithoutExt === videoBaseName) {
    isExact = true;
    label = 'Sin idioma';
  }
  // Starts with video base name: VideoName.en.srt
  else if (subWithoutExt.startsWith(videoBaseName + '.')) {
    isExact = true;
    const suffix = subWithoutExt.slice(videoBaseName.length + 1);
    const langPart = suffix.split('.')[0].toLowerCase();
    if (langPart) {
      const resolved = resolveLanguage(langPart);
      language = resolved.language;
      label = resolved.label;
    }
  }
  // Not related to video name but still a subtitle — try to extract language anyway
  else {
    // Try to find a language code in the filename (last 2-3 chars before extension)
    const parts = subWithoutExt.split('.');
    const lastPart = parts[parts.length - 1].toLowerCase();
    if (lastPart.length <= 3 && lastPart.length >= 2) {
      const resolved = resolveLanguage(lastPart);
      // Only use if it resolved to a known language
      if (LANGUAGE_MAP[resolved.language]) {
        language = resolved.language;
        label = resolved.label;
      }
    }
  }

  return { language, label, exactMatch: isExact };
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

      const info = extractSubtitleInfo(videoBaseName, entry);
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
