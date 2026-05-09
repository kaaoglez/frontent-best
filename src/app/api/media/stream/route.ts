import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, IMAGE_EXTENSIONS, getExtensionsForType } from '@/lib/constants';
import { streamFileResponse, streamRangeResponse, parseRangeHeader } from '@/lib/stream-helpers';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dirPath = searchParams.get('path') || '/home/z';
  const mediaType = searchParams.get('type') || 'audio';

  try {
    const normalized = path.normalize(dirPath);
    if (normalized.includes('..')) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 400 });
    }

    if (!fs.existsSync(normalized)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const stat = fs.statSync(normalized);

    if (stat.isFile()) {
      const fileSize = stat.size;
      const range = parseRangeHeader(request.headers.get('range'), fileSize);
      if (range) {
        return streamRangeResponse(normalized, fileSize, range.start, range.end);
      }
      return streamFileResponse(normalized, fileSize);
    }

    if (!stat.isDirectory()) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const entries = fs.readdirSync(normalized, { withFileTypes: true });
    const allowedExts = getExtensionsForType(mediaType);

    const folders: Array<{ name: string; path: string; itemCount: number; subFolderCount: number }> = [];
    const files: Array<{ name: string; path: string; size: number; modifiedAt: string; extension: string }> = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(normalized, entry.name);

      try {
        const itemStat = fs.statSync(fullPath);
        if (entry.isDirectory()) {
          let count = 0;
          let subCount = 0;
          try {
            const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
            for (const sub of subEntries) {
              if (sub.name.startsWith('.')) continue;
              if (sub.isDirectory()) {
                subCount++;
              } else {
                const subExt = path.extname(sub.name).toLowerCase().replace('.', '');
                if (allowedExts.has(subExt)) count++;
              }
            }
          } catch { /* skip */ }
          folders.push({ name: entry.name, path: fullPath, itemCount: count, subFolderCount: subCount });
        } else {
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          if (allowedExts.has(ext)) {
            files.push({
              name: entry.name,
              path: fullPath,
              size: itemStat.size,
              modifiedAt: itemStat.mtime.toISOString(),
              extension: ext,
            });
          }
        }
      } catch { /* skip inaccessible files */ }
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const totalDurationEstimate = files.length > 0 ? Math.round(totalSize / (5 * 1024 * 1024)) : 0;

    return NextResponse.json({
      path: normalized,
      parentPath: path.dirname(normalized),
      folders,
      files,
      totalFiles: files.length,
      totalFolders: folders.length,
      totalSize,
      estimatedDuration: totalDurationEstimate,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read media', details: String(error) },
      { status: 500 }
    );
  }
}
