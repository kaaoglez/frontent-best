import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, IMAGE_EXTENSIONS } from '@/lib/constants';

interface CacheEntry {
  data: Record<string, unknown>;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000;
let cacheData: CacheEntry | null = null;

function getCached(): CacheEntry['data'] | null {
  if (cacheData && Date.now() - cacheData.timestamp < CACHE_TTL) {
    return cacheData.data;
  }
  return null;
}

function setCached(data: CacheEntry['data']) {
  cacheData = { data, timestamp: Date.now() };
}

const MAX_DEPTH = 8;

async function scanDirectory(
  dir: string,
  allowedExts: Set<string>,
  depth: number = 0,
): Promise<{ totalFiles: number; totalFolders: number; totalSize: number }> {
  let totalFiles = 0;
  let totalFolders = 0;
  let totalSize = 0;

  if (depth > MAX_DEPTH) return { totalFiles, totalFolders, totalSize };

  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const subScanPromises: Promise<{ totalFiles: number; totalFolders: number; totalSize: number }>[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);

      try {
        if (entry.isDirectory()) {
          totalFolders++;
          subScanPromises.push(scanDirectory(fullPath, allowedExts, depth + 1));
        } else {
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          if (allowedExts.has(ext)) {
            totalFiles++;
            try {
              const stat = await fsp.stat(fullPath);
              totalSize += stat.size;
            } catch {
              // skip stat errors
            }
          }
        }
      } catch {
        // skip inaccessible entries
      }
    }

    if (subScanPromises.length > 0) {
      const results = await Promise.all(subScanPromises);
      for (const sub of results) {
        totalFiles += sub.totalFiles;
        totalFolders += sub.totalFolders;
        totalSize += sub.totalSize;
      }
    }
  } catch {
    // skip inaccessible root
  }

  return { totalFiles, totalFolders, totalSize };
}

async function aggregatePaths(dirs: string[], allowedExts: Set<string>) {
  let totalFiles = 0;
  let totalFolders = 0;
  let totalSize = 0;

  const scanPromises = dirs.map(async (dir) => {
    const norm = path.normalize(dir);
    try {
      await fsp.access(norm);
    } catch {
      return { totalFiles: 0, totalFolders: 0, totalSize: 0 };
    }
    return scanDirectory(norm, allowedExts);
  });

  const results = await Promise.all(scanPromises);
  for (const result of results) {
    totalFiles += result.totalFiles;
    totalFolders += result.totalFolders;
    totalSize += result.totalSize;
  }

  return { totalFiles, totalFolders, totalSize };
}

async function getJsonArraySetting(key: string, fallback: string[]): Promise<string[]> {
  try {
    const row = await db.setting.findUnique({ where: { key } });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // malformed JSON – fall through
  }
  return fallback;
}

export async function GET() {
  try {
    const cached = getCached();
    if (cached) {
      return NextResponse.json(cached);
    }

    const [musicPaths, moviePaths, imagePaths] = await Promise.all([
      getJsonArraySetting('musicLibraryPaths', ['/home/z']),
      getJsonArraySetting('movieLibraryPaths', ['/home/z']),
      getJsonArraySetting('imageLibraryPaths', ['/mnt/Canal', '/mnt/Tools']),
    ]);

    const [music, movies, images] = await Promise.all([
      aggregatePaths(musicPaths, AUDIO_EXTENSIONS),
      aggregatePaths(moviePaths, VIDEO_EXTENSIONS),
      aggregatePaths(imagePaths, IMAGE_EXTENSIONS),
    ]);

    const [totalBooks, booksRead, totalPagesResult, uniqueAuthorsResult] = await Promise.all([
      db.book.count(),
      db.book.count({ where: { status: 'Leído' } }),
      db.book.aggregate({ _sum: { pages: true } }),
      db.book.groupBy({ by: ['author'] }),
    ]);

    const library = {
      totalBooks,
      booksRead,
      totalPages: totalPagesResult._sum.pages ?? 0,
      uniqueAuthors: uniqueAuthorsResult.length,
    };

    const result = { library, music, movies, images };
    setCached(result);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats', details: String(error) },
      { status: 500 },
    );
  }
}
