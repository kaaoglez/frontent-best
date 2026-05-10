/**
 * Language code to display label mapping.
 */
export const LANGUAGE_MAP: Record<string, string> = {
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

/**
 * Extended language code mapping (3-letter ISO 639-2/B codes to 2-letter codes).
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
 * Detects the subtitle format of the given content.
 *
 * @param content - The raw subtitle file content.
 * @returns `'vtt'` if content starts with WEBVTT, `'srt'` if it matches SRT pattern, or `null`.
 */
export function detectSubtitleFormat(content: string): 'srt' | 'vtt' | null {
  // Strip BOM and leading whitespace
  const trimmed = content.replace(/^\uFEFF/, '').trimStart();

  // VTT starts with "WEBVTT"
  if (trimmed.startsWith('WEBVTT')) {
    return 'vtt';
  }

  // SRT pattern: a sequence of lines where the first is a number,
  // the second is a timestamp line (HH:MM:SS,mmm --> HH:MM:SS,mmm),
  // and the third+ lines are subtitle text.
  // We check for at least one timestamp line pattern.
  const srtTimestampPattern = /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/m;
  const srtSequencePattern = /^\d+\s*\n\s*\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/m;

  if (srtSequencePattern.test(trimmed) || srtTimestampPattern.test(trimmed)) {
    return 'srt';
  }

  return null;
}

/**
 * Converts SRT subtitle content to WebVTT format.
 *
 * Handles:
 * - Adding WEBVTT header
 * - Converting comma decimal separators to periods in timestamps
 * - Normalizing line endings (\r\n → \n)
 * - Stripping BOM characters
 * - Removing HTML tags from subtitle text for safety
 *
 * @param srtContent - Raw SRT file content.
 * @returns WebVTT formatted string.
 */
export function srtToVtt(srtContent: string): string {
  // Strip BOM
  let content = srtContent.replace(/^\uFEFF/, '');

  // Normalize line endings: \r\n → \n
  content = content.replace(/\r\n/g, '\n');

  // Split into blocks separated by double newlines (or more)
  const blocks = content.split(/\n\n+/).filter((block) => block.trim().length > 0);

  const vttBlocks: string[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

    // Find the timestamp line
    let timestampIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timestampIdx = i;
        break;
      }
    }

    if (timestampIdx === -1) {
      // No timestamp found, skip this block
      continue;
    }

    // Extract the text lines (everything after the timestamp)
    const textLines = lines.slice(timestampIdx + 1).map((line) => {
      // Strip HTML tags for safety
      return line.replace(/<[^>]*>/g, '');
    });

    const text = textLines.join('\n');
    if (!text) continue;

    // Convert timestamp: replace comma with period in decimal
    const timestamp = lines[timestampIdx].replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

    vttBlocks.push(`${timestamp}\n${text}`);
  }

  return `WEBVTT\n\n${vttBlocks.join('\n\n')}\n`;
}

/**
 * Resolves a language code (potentially 3-letter) to a 2-letter code and label.
 *
 * @param code - A 2-letter or 3-letter language code.
 * @returns An object with `language` (2-letter code) and `label`.
 */
export function resolveLanguage(code: string): { language: string; label: string } {
  // Check if it's a 3-letter code first
  const twoLetter = EXTENDED_LANG_MAP[code.toLowerCase()] || code.toLowerCase();

  return {
    language: twoLetter,
    label: LANGUAGE_MAP[twoLetter] || LANGUAGE_MAP[code.toLowerCase()] || code,
  };
}
