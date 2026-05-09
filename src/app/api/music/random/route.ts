import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'm4b', 'wma', 'opus', 'webm', 'aiff',
]);

function scanRecursive(dirPath: string, maxTracks: number): Array<{ name: string; path: string; size: number; extension: string; type: string }> {
  const tracks: Array<{ name: string; path: string; size: number; extension: string; type: string }> = [];

  function walk(currentPath: string) {
    if (tracks.length >= maxTracks) return;
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (tracks.length >= maxTracks) break;
        const fullPath = path.join(currentPath, entry.name);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath);
          } else {
            const ext = path.extname(entry.name).toLowerCase().replace('.', '');
            if (AUDIO_EXTENSIONS.has(ext)) {
              tracks.push({
                name: entry.name,
                path: fullPath,
                size: stat.size,
                extension: ext,
                type: 'audio',
              });
            }
          }
        } catch { /* skip inaccessible files */ }
      }
    } catch { /* skip inaccessible directories */ }
  }

  walk(dirPath);
  return tracks;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dirPath = searchParams.get('path') || '/home/z';

  try {
    const normalized = path.normalize(dirPath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const stat = fs.statSync(normalized);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: 'Not a directory' }, { status: 400 });
    }

    const MAX_TRACKS = 200;
    const tracks = scanRecursive(normalized, MAX_TRACKS);

    // Shuffle using Fisher-Yates
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }

    return NextResponse.json({
      path: normalized,
      totalFound: tracks.length,
      tracks,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to scan music', details: String(error) },
      { status: 500 }
    );
  }
}
